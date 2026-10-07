"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase-server";
import { containsProfanity } from "@/lib/profanity-filter";
import { gate, ratelimits } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/safe-error";
import { sanitizePostHtml, htmlToText } from "@/lib/sanitize-html";
import { PostInputSchema } from "@/lib/schemas/community";
import type { CommunityPost, TopicTag, ResultCard, ScoreCard, PollOption } from "@/types/community";
import { CAPS, canAccessGroup, isBlockedBetween, canAccessPost, enrichPosts } from "./_shared";


// ─── Resume helpers ───────────────────────────────────────────────────────────

export async function fetchUserResumesAction(): Promise<
  { id: string; title: string }[]
> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("resumes")
    .select("id, title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, title: r.title ?? "Untitled" }));
}


export async function fetchResumeForViewAction(resumeId: string): Promise<{
  title: string | null;
  sections:
    | {
        id: string;
        type: string;
        label: string;
        mode: string;
        contentHtml: string;
        structuredData?: Record<string, unknown>;
      }[]
    | null;
  error: string | null;
}> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: null, sections: null, error: "Not signed in" };

  const { data: resume } = await supabase
    .from("resumes")
    .select("id, title")
    .eq("id", resumeId)
    .maybeSingle();
  if (!resume)
    return { title: null, sections: null, error: "Resume not found" };

  const { data: rows } = await supabase
    .from("resume_sections")
    .select("*")
    .eq("resume_id", resumeId)
    .order("sort_order", { ascending: true });

  return {
    title: resume.title,
    sections: (rows ?? []).map((row) => ({
      id: row.id as string,
      type: row.section_key as string,
      label: row.label as string,
      mode: row.mode as string,
      contentHtml: row.content_html as string,
      structuredData:
        (row.structured_data as Record<string, unknown>) ?? undefined,
    })),
    error: null,
  };
}


// ─── School search ────────────────────────────────────────────────────────────

export async function searchSchoolsAction(
  query: string,
): Promise<{ id: number; name: string }[]> {
  if (!query.trim()) return [];
  // I1 — escape PostgREST LIKE wildcards.
  const safe = query.trim().replace(/[\\%_]/g, "\\$&");
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("schools")
    .select("id, name")
    .ilike("name", `%${safe}%`)
    .limit(8);
  return (data ?? []) as { id: number; name: string }[];
}


// ─── Post creation ────────────────────────────────────────────────────────────

export async function createPostAction(input: {
  content: string;
  topic_tag: TopicTag;
  result_card?: ResultCard | null;
  score_card?: ScoreCard | null;
  resume_id?: string | null;
  is_anonymous?: boolean;
  university_id?: number | null;
  poll_options?: PollOption[] | null;
  group_id?: string | null;
}): Promise<{ post: CommunityPost | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { post: null, error: "Not signed in" };

  const rl = await gate(ratelimits.postCreate, `post:${user.id}`);
  if (!rl.ok) return { post: null, error: rl.error };

  // P2.8 — lifetime + daily caps per user.
  const { count: lifetime } = await supabase
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((lifetime ?? 0) >= CAPS.postsLifetime) {
    return { post: null, error: "You've reached the lifetime post limit." };
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: today } = await supabase
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", dayAgo);
  if ((today ?? 0) >= CAPS.postsPerDay) {
    return {
      post: null,
      error: "Daily post limit reached. Try again tomorrow.",
    };
  }

  // P2.7 — schema validation runs before any DB writes.
  const parsed = PostInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      post: null,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const content = sanitizePostHtml(data.content);
  const plain = htmlToText(content);
  const hasAttachment = !!(
    data.resume_id ||
    data.score_card ||
    data.result_card ||
    data.poll_options?.length
  );
  if (!plain && !hasAttachment)
    return {
      post: null,
      error: "Add some text, a score, result, resume, or poll before posting",
    };
  if (plain.length > 2000)
    return { post: null, error: "Post exceeds 2000 characters" };
  if (containsProfanity(plain))
    return { post: null, error: "Post contains prohibited language" };

  if (data.resume_id) {
    const { data: resume } = await supabase
      .from("resumes")
      .select("id")
      .eq("id", data.resume_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!resume) return { post: null, error: "Resume not found" };
  }

  // A2 — verify membership when posting to a group (gates private and public alike).
  if (data.group_id) {
    const allowed = await canAccessGroup(supabase, data.group_id, user.id);
    if (!allowed)
      return { post: null, error: "Not authorized to post in this community" };
  }

  const { data: row, error: insertError } = await supabase
    .from("community_posts")
    .insert({
      user_id: user.id,
      content,
      topic_tag: data.topic_tag,
      result_card: data.result_card ?? null,
      score_card: data.score_card ?? null,
      resume_link: data.resume_id ?? null,
      is_anonymous: data.is_anonymous ?? false,
      university_id: data.university_id ?? null,
      poll_options: data.poll_options ?? null,
      group_id: data.group_id ?? null,
    })
    .select(
      "*, likes:community_likes(count), comments:community_comments(count)",
    )
    .single();

  if (insertError || !row)
    return { post: null, error: "Failed to create post" };

  const posts = await enrichPosts(
    supabase,
    [row as Record<string, unknown>],
    user.id,
  );
  return { post: posts[0] ?? null, error: null };
}


// ─── Post editing ─────────────────────────────────────────────────────────────

export async function updatePostAction(
  postId: string,
  content: string,
): Promise<{ error: string | null; content?: string }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const sanitized = sanitizePostHtml(content);
  const plain = htmlToText(sanitized);
  if (!plain) return { error: "Post cannot be empty" };
  if (plain.length > 2000) return { error: "Post exceeds 2000 characters" };
  if (containsProfanity(plain))
    return { error: "Post contains prohibited language" };

  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id, created_at")
    .eq("id", postId)
    .single();
  if (!post || post.user_id !== user.id) return { error: "Not authorized" };

  const hoursDiff =
    (Date.now() - new Date(post.created_at as string).getTime()) / 3_600_000;
  if (hoursDiff > 24)
    return { error: "Posts can only be edited within 24 hours" };

  const { data: updated, error } = await supabase
    .from("community_posts")
    .update({ content: sanitized, edited_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("user_id", user.id)
    .select("id");

  if (error) return { error: sanitizeError(error, "Could not update post.") };
  if (!updated?.length) return { error: "Could not update post. Please try again." };

  return {
    error: null,
    // Return the server-sanitized HTML so the client renders the trusted
    // version optimistically without re-running sanitize-html in the browser (C4).
    content: sanitized,
  };
}


// B7 — after a like/save/vote write, revalidate the surfaces that render a
// post so the server-provided base props (which seed useOptimistic in PostCard)
// refresh. Without this the optimistic like/save/vote snaps back on next render.
function revalidatePostSurfaces(postId: string) {
  revalidatePath("/communities");
  revalidatePath(`/communities/${postId}`);
  revalidatePath("/communities/saved");
}


// ─── Likes ───────────────────────────────────────────────────────────────────

export async function toggleLikeAction(
  postId: string,
): Promise<{ liked: boolean; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { liked: false, error: "Not signed in" };

  const rl = await gate(ratelimits.likeAction, `like:${user.id}`);
  if (!rl.ok) return { liked: false, error: rl.error };

  const { data: existing, error: lookupError } = await supabase
    .from("community_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) return { liked: false, error: sanitizeError(lookupError, "Could not update like.") };

  if (existing) {
    const { error: unlikeError } = await supabase
      .from("community_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (unlikeError) return { liked: true, error: sanitizeError(unlikeError, "Could not update like.") };
    revalidatePostSurfaces(postId);
    return { liked: false, error: null };
  }

  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .single();
  if (await isBlockedBetween(supabase, user.id, post?.user_id as string))
    return { liked: false, error: "This post isn't available" };

  const { error: likeError } = await supabase
    .from("community_likes")
    .insert({ post_id: postId, user_id: user.id });
  // A duplicate means it is already liked (a double tap or another tab).
  if (likeError && likeError.code !== "23505")
    return { liked: false, error: sanitizeError(likeError, "Could not update like.") };

  if (post && post.user_id !== user.id) {
    await supabase
      .from("notifications")
      .insert({
        user_id: post.user_id,
        actor_id: user.id,
        type: "like",
        post_id: postId,
      });
  }
  revalidatePostSurfaces(postId);
  return { liked: true, error: null };
}


// ─── Saves ───────────────────────────────────────────────────────────────────

export async function toggleSaveAction(
  postId: string,
): Promise<{ saved: boolean; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { saved: false, error: "Not signed in" };

  const rl = await gate(ratelimits.saveAction, `save:${user.id}`);
  if (!rl.ok) return { saved: false, error: rl.error };

  const { data: existing, error: lookupError } = await supabase
    .from("community_saves")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) return { saved: false, error: sanitizeError(lookupError, "Could not save post.") };

  if (existing) {
    const { error: unsaveError } = await supabase
      .from("community_saves")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (unsaveError) return { saved: true, error: sanitizeError(unsaveError, "Could not save post.") };
    revalidatePostSurfaces(postId);
    return { saved: false, error: null };
  }
  const { error: saveError } = await supabase
    .from("community_saves")
    .insert({ post_id: postId, user_id: user.id });
  // A duplicate means it is already saved (a double tap or another tab).
  if (saveError && saveError.code !== "23505")
    return { saved: false, error: sanitizeError(saveError, "Could not save post.") };
  revalidatePostSurfaces(postId);
  return { saved: true, error: null };
}


// ─── Poll voting ──────────────────────────────────────────────────────────────

export async function castPollVoteAction(
  postId: string,
  optionId: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const rl = await gate(ratelimits.likeAction, `pollvote:${user.id}`);
  if (!rl.ok) return { error: rl.error };

  // Inherit the post's privacy gate (private-group polls), and block enforcement.
  if (!(await canAccessPost(supabase, postId, user.id)))
    return { error: "Not authorized to vote on this poll" };
  const { data: pollPost } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .maybeSingle();
  if (await isBlockedBetween(supabase, user.id, pollPost?.user_id as string))
    return { error: "This poll isn't available" };

  if (optionId === null) {
    await supabase
      .from("community_poll_votes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("community_poll_votes")
      .upsert(
        { post_id: postId, user_id: user.id, option_id: optionId },
        { onConflict: "post_id,user_id" },
      );
  }
  revalidatePostSurfaces(postId);
  return { error: null };
}


export async function deletePostAction(
  postId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { data: deleted, error } = await supabase
    .from("community_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: sanitizeError(error, "Could not delete post.") };
  // A delete that affects zero rows (e.g. RLS) returns no error — surface it
  // instead of falsely reporting success.
  if (!deleted || deleted.length === 0)
    return { error: "Could not delete post. Please try again." };
  return { error: null };
}


export async function pinPostAction(
  postId: string | null,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (postId) {
    const { data: post } = await supabase
      .from("community_posts")
      .select("user_id")
      .eq("id", postId)
      .single();
    if (!post || post.user_id !== user.id) return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("community_profile_settings")
    .upsert({
      user_id: user.id,
      pinned_post_id: postId,
      updated_at: new Date().toISOString(),
    });
  return { error: error ? sanitizeError(error, "Could not pin post.") : null };
}
