"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import { containsProfanity } from "@/lib/profanity-filter";
import { gate, ratelimits } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/safe-error";
import { sanitizePostHtml, looksLikeHtml } from "@/lib/sanitize-html";
import { CommentInputSchema } from "@/lib/schemas/community";
import type { CommunityComment, PostAuthor } from "@/types/community";
import { isBlockedBetween, canAccessPost } from "./_shared";


// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchCommentsAction(
  postId: string,
): Promise<{ comments: CommunityComment[]; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A3 — comments inherit their parent post's privacy gate.
  if (!(await canAccessPost(supabase, postId, user?.id))) {
    return { comments: [], error: null };
  }

  const { data: rows, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !rows)
    return {
      comments: [],
      error: error
        ? sanitizeError(error, "Could not load comments.")
        : "Could not load comments.",
    };

  const commentIds = rows.map((r) => r.id as string);
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];

  const [profilesRes, likesRes, userLikesRes] = await Promise.all([
    userIds.length
      ? supabase.rpc("get_public_profiles", { user_ids: userIds })
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? supabase
          .from("community_comment_likes")
          .select("comment_id")
          .in("comment_id", commentIds)
      : Promise.resolve({ data: [] }),
    user && commentIds.length
      ? supabase
          .from("community_comment_likes")
          .select("comment_id")
          .eq("user_id", user.id)
          .in("comment_id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, PostAuthor>(
    ((profilesRes.data ?? []) as PostAuthor[]).map((p) => [p.id, p]),
  );

  const likeCountMap = new Map<string, number>();
  for (const l of (likesRes.data ?? []) as { comment_id: string }[]) {
    likeCountMap.set(l.comment_id, (likeCountMap.get(l.comment_id) ?? 0) + 1);
  }
  const userLikedSet = new Set(
    ((userLikesRes.data ?? []) as { comment_id: string }[]).map(
      (l) => l.comment_id,
    ),
  );

  const allComments: CommunityComment[] = rows.map((row) => ({
    ...(row as unknown as CommunityComment),
    author: profileMap.get(row.user_id as string) ?? null,
    likes_count: likeCountMap.get(row.id as string) ?? 0,
    is_liked_by_user: userLikedSet.has(row.id as string),
    replies: [],
  }));

  const topLevel: CommunityComment[] = [];
  const byId = new Map(allComments.map((c) => [c.id, c]));
  for (const comment of allComments) {
    if (comment.parent_comment_id)
      byId.get(comment.parent_comment_id)?.replies.push(comment);
    else topLevel.push(comment);
  }
  return { comments: topLevel, error: null };
}


export async function addCommentAction(
  postId: string,
  content: string,
  parentCommentId?: string,
): Promise<{ comment: CommunityComment | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { comment: null, error: "Not signed in" };

  const rl = await gate(ratelimits.commentCreate, `comment:${user.id}`);
  if (!rl.ok) return { comment: null, error: rl.error };

  const parsed = CommentInputSchema.safeParse({
    postId,
    content,
    parentCommentId,
  });
  if (!parsed.success) {
    return {
      comment: null,
      error: parsed.error.issues[0]?.message ?? "Invalid comment",
    };
  }
  const text = parsed.data.content;
  if (containsProfanity(text))
    return { comment: null, error: "Comment contains prohibited language" };

  // A3 — comments inherit their parent post's privacy gate.
  if (!(await canAccessPost(supabase, postId, user.id))) {
    return { comment: null, error: "Not authorized to comment on this post" };
  }

  if (parentCommentId) {
    const { data: parentComment } = await supabase
      .from("community_comments")
      .select("post_id")
      .eq("id", parentCommentId)
      .maybeSingle();
    if (!parentComment || parentComment.post_id !== postId)
      return { comment: null, error: "Parent comment not found on this post" };
  }

  // Block enforcement — a blocked user can't comment on the post author's content.
  const { data: postAuthor } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .maybeSingle();
  if (await isBlockedBetween(supabase, user.id, postAuthor?.user_id as string))
    return { comment: null, error: "You can't comment on this post" };

  // P2.4 — per-user-per-post comment cap (10/hour) so a single account can't
  // dump comments on a target post even within the global rate limit.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCommentCount } = await supabase
    .from("community_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .gte("created_at", oneHourAgo);
  if ((recentCommentCount ?? 0) >= 10) {
    return {
      comment: null,
      error: "You've commented a lot on this post recently. Try again later.",
    };
  }

  const { data: row, error: insertError } = await supabase
    .from("community_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      // A7 — comments render as escaped text today, but sanitize any HTML markup on
      // store so a future switch to HTML rendering can't become stored XSS. Plain
      // text (the common case) is stored verbatim to avoid entity double-encoding.
      content: looksLikeHtml(text) ? sanitizePostHtml(text) : text,
      parent_comment_id: parentCommentId ?? null,
    })
    .select("*")
    .single();

  if (insertError || !row)
    return { comment: null, error: "Failed to post comment" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single();
  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (post && post.user_id !== user.id) {
    await supabase
      .from("notifications")
      .insert({
        user_id: post.user_id,
        actor_id: user.id,
        type: parentCommentId ? "reply" : "comment",
        post_id: postId,
        comment_id: row.id,
      });
  }
  if (parentCommentId) {
    const { data: parentComment } = await supabase
      .from("community_comments")
      .select("user_id")
      .eq("id", parentCommentId)
      .single();
    if (
      parentComment &&
      parentComment.user_id !== user.id &&
      parentComment.user_id !== post?.user_id
    ) {
      await supabase
        .from("notifications")
        .insert({
          user_id: parentComment.user_id,
          actor_id: user.id,
          type: "reply",
          post_id: postId,
          comment_id: row.id,
        });
    }
  }

  return {
    comment: {
      ...(row as unknown as CommunityComment),
      author: (profile as PostAuthor) ?? null,
      likes_count: 0,
      is_liked_by_user: false,
      replies: [],
    },
    error: null,
  };
}


// ─── Comment edit / delete ─────────────────────────────────────────────────────

export async function updateCommentAction(
  commentId: string,
  content: string,
): Promise<{ error: string | null; edited_at: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in", edited_at: null };

  const text = content.trim();
  if (!text) return { error: "Comment cannot be empty", edited_at: null };
  if (text.length > 1000)
    return { error: "Comment exceeds 1000 characters", edited_at: null };
  if (containsProfanity(text))
    return { error: "Comment contains prohibited language", edited_at: null };

  const { data: comment } = await supabase
    .from("community_comments")
    .select("user_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment || comment.user_id !== user.id)
    return { error: "Not authorized", edited_at: null };

  const editedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("community_comments")
    // A7 — sanitize HTML markup on store (see addCommentAction); plain text verbatim.
    .update({
      content: looksLikeHtml(text) ? sanitizePostHtml(text) : text,
      edited_at: editedAt,
    })
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select("id");

  if (error) return { error: sanitizeError(error, "Could not update comment."), edited_at: null };
  if (!updated?.length)
    return { error: "Could not update comment. Please try again.", edited_at: null };

  return {
    error: null,
    edited_at: editedAt,
  };
}


export async function deleteCommentAction(
  commentId: string,
): Promise<{ mode: "soft" | "hard" | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { mode: null, error: "Not signed in" };

  const { data: comment } = await supabase
    .from("community_comments")
    .select("user_id, post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment || comment.user_id !== user.id)
    return { mode: null, error: "Not authorized" };

  // If the comment has replies, soft-delete so the thread structure survives;
  // otherwise remove it outright.
  const { count: replyCount, error: replyCountError } = await supabase
    .from("community_comments")
    .select("id", { count: "exact", head: true })
    .eq("parent_comment_id", commentId);
  if (replyCountError || replyCount == null)
    return { mode: null, error: "Could not check comment replies. Please try again." };

  if ((replyCount ?? 0) > 0) {
    const { data: updated, error } = await supabase
      .from("community_comments")
      .update({ is_deleted: true, content: "[deleted]" })
      .eq("id", commentId)
      .eq("user_id", user.id)
      .select("id");
    if (error) return { mode: null, error: sanitizeError(error, "Could not delete comment.") };
    if (!updated?.length) return { mode: null, error: "Could not delete comment. Please try again." };
    return {
      mode: "soft",
      error: null,
    };
  }

  // The comment-like FK cascades in the same transaction as a hard delete.
  const { data: deleted, error } = await supabase
    .from("community_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { mode: null, error: sanitizeError(error, "Could not delete comment.") };
  if (!deleted?.length) return { mode: null, error: "Could not delete comment. Please try again." };
  return {
    mode: "hard",
    error: null,
  };
}


// ─── Comment Likes ────────────────────────────────────────────────────────────

export async function toggleCommentLikeAction(
  commentId: string,
): Promise<{ liked: boolean; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { liked: false, error: "Not signed in" };

  const { data: existing } = await supabase
    .from("community_comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("community_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
    return { liked: false, error: null };
  }

  // Block enforcement — can't like a comment by someone you've blocked / who blocked you.
  const { data: comment } = await supabase
    .from("community_comments")
    .select("user_id, post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (await isBlockedBetween(supabase, user.id, comment?.user_id as string))
    return { liked: false, error: "This comment isn't available" };

  await supabase
    .from("community_comment_likes")
    .insert({ comment_id: commentId, user_id: user.id });

  // Notify the comment author (not on self-like).
  if (comment && comment.user_id !== user.id) {
    await supabase.from("notifications").insert({
      user_id: comment.user_id,
      actor_id: user.id,
      type: "comment_like",
      post_id: comment.post_id,
      comment_id: commentId,
    });
  }
  return { liked: true, error: null };
}
