"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase-server";
import { containsProfanity } from "@/lib/profanity-filter";
import { gate, ratelimits } from "@/lib/rate-limit";
import type {
  CommunityPost, CommunityComment, CommunityGroup, NotificationItem, PostAuthor,
  TopicTag, ResultCard, ScoreCard, PollOption, PrivacySettings, CommunityProfileData,
} from "@/types/community";

const VALID_TOPICS: TopicTag[] = [
  "APPLICATION_RESULTS", "ESSAYS", "TEST_SCORES",
  "EXTRACURRICULARS", "ADVICE", "SCHOLARSHIPS",
];

// ─── Shared enrichment helper ─────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServer>>;

/**
 * Verifies the caller is allowed to read posts/comments in a given group (A1, A3).
 * Public groups are always readable. Private groups require an active membership
 * row or the caller being the creator. Returns false for unknown groups.
 */
async function canAccessGroup(
  supabase: SupabaseClient,
  groupId: string,
  userId: string | undefined
): Promise<boolean> {
  const { data: group } = await supabase
    .from("community_groups")
    .select("is_private, creator_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return false;
  if (!group.is_private) return true;
  if (!userId) return false;
  if (userId === group.creator_id) return true;

  const { data: membership } = await supabase
    .from("community_group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!membership;
}

/**
 * Verifies the caller can read/comment on a given post (A3).
 * Posts not in a group are accessible per existing RLS. Posts in a group inherit
 * that group's privacy gate.
 */
async function canAccessPost(
  supabase: SupabaseClient,
  postId: string,
  userId: string | undefined
): Promise<boolean> {
  const { data: post } = await supabase
    .from("community_posts")
    .select("group_id, is_hidden")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return false;
  if (post.is_hidden) return false;
  if (!post.group_id) return true;
  return canAccessGroup(supabase, post.group_id as string, userId);
}

async function enrichPosts(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  currentUserId?: string
): Promise<CommunityPost[]> {
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const resumeIds = rows.map((r) => r.resume_link as string | null).filter((id): id is string => !!id);
  const universityIds = rows.map((r) => r.university_id as number | null).filter((id): id is number => id != null);
  const pollPostIds = rows.filter((r) => r.poll_options != null).map((r) => r.id as string);

  const postIds = rows.map((r) => r.id as string);

  const [profilesRes, resumesRes, schoolsRes, pollVotesRes, userVotesRes, savesRes] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, avatar_url, is_verified").in("id", userIds),
    resumeIds.length
      ? supabase.from("resumes").select("id, title").in("id", resumeIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    universityIds.length
      ? supabase.from("schools").select("id, name").in("id", universityIds)
      : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    pollPostIds.length
      ? supabase.from("community_poll_votes").select("post_id, option_id").in("post_id", pollPostIds)
      : Promise.resolve({ data: [] as { post_id: string; option_id: string }[] }),
    currentUserId && pollPostIds.length
      ? supabase.from("community_poll_votes").select("post_id, option_id").eq("user_id", currentUserId).in("post_id", pollPostIds)
      : Promise.resolve({ data: [] as { post_id: string; option_id: string }[] }),
    supabase.from("community_saves").select("post_id").in("post_id", postIds),
  ]);

  type ProfileRow = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; is_verified: boolean };
  const profileMap = new Map<string, ProfileRow>(
    ((profilesRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );
  const resumeTitleMap = new Map(
    ((resumesRes.data ?? []) as { id: string; title: string }[]).map((r) => [r.id, r.title])
  );
  const schoolNameMap = new Map(
    ((schoolsRes.data ?? []) as { id: number; name: string }[]).map((s) => [s.id, s.name])
  );

  const pollCountMap = new Map<string, Record<string, number>>();
  for (const v of (pollVotesRes.data ?? []) as { post_id: string; option_id: string }[]) {
    if (!pollCountMap.has(v.post_id)) pollCountMap.set(v.post_id, {});
    const m = pollCountMap.get(v.post_id)!;
    m[v.option_id] = (m[v.option_id] ?? 0) + 1;
  }
  const userVoteMap = new Map(
    ((userVotesRes.data ?? []) as { post_id: string; option_id: string }[]).map((v) => [v.post_id, v.option_id])
  );

  const savesCountMap = new Map<string, number>();
  for (const s of (savesRes.data ?? []) as { post_id: string }[]) {
    savesCountMap.set(s.post_id, (savesCountMap.get(s.post_id) ?? 0) + 1);
  }

  return rows.map((row) => {
    const isAnon = (row.is_anonymous as boolean | null) ?? false;
    const realUserId = row.user_id as string;
    const isOwnPost = !!currentUserId && currentUserId === realUserId;
    const p = profileMap.get(realUserId) ?? null;
    const author: PostAuthor | null = isAnon ? null : (p ? { id: p.id, first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url, is_verified: p.is_verified ?? false } : null);
    return {
      id: row.id as string,
      // B1 — anonymise user_id in API responses. Owner still sees their real id
      // so they can edit/delete their own anonymous post; everyone else sees a
      // stable but non-reversible token derived from the post id.
      user_id: isAnon && !isOwnPost ? `anon:${row.id as string}` : realUserId,
      content: row.content as string,
      topic_tag: row.topic_tag as TopicTag,
      group_id: (row.group_id as string | null) ?? null,
      university_id: (row.university_id as number | null) ?? null,
      school_name: row.university_id ? (schoolNameMap.get(row.university_id as number) ?? null) : null,
      major_id: (row.major_id as string | null) ?? null,
      result_card: (row.result_card as ResultCard | null) ?? null,
      score_card: (row.score_card as ScoreCard | null) ?? null,
      resume_id: (row.resume_link as string | null) ?? null,
      resume_title: row.resume_link ? (resumeTitleMap.get(row.resume_link as string) ?? null) : null,
      is_anonymous: isAnon,
      is_hidden: (row.is_hidden as boolean) ?? false,
      edited_at: (row.edited_at as string | null) ?? null,
      poll_options: (row.poll_options as PollOption[] | null) ?? null,
      poll_votes: pollCountMap.get(row.id as string) ?? null,
      user_vote: userVoteMap.get(row.id as string) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      likes_count: ((row.likes as { count: number }[] | undefined)?.[0]?.count) ?? 0,
      comments_count: ((row.comments as { count: number }[] | undefined)?.[0]?.count) ?? 0,
      saves_count: savesCountMap.get(row.id as string) ?? 0,
      author,
    };
  });
}

// ─── Resume helpers ───────────────────────────────────────────────────────────

export async function fetchUserResumesAction(): Promise<{ id: string; title: string }[]> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("resumes").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({ id: r.id, title: r.title ?? "Untitled" }));
}

export async function fetchResumeForViewAction(resumeId: string): Promise<{
  title: string | null;
  sections: { id: string; type: string; label: string; mode: string; contentHtml: string; structuredData?: Record<string, unknown> }[] | null;
  error: string | null;
}> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { title: null, sections: null, error: "Not signed in" };

  const { data: resume } = await supabase.from("resumes").select("id, title").eq("id", resumeId).maybeSingle();
  if (!resume) return { title: null, sections: null, error: "Resume not found" };

  const { data: rows } = await supabase
    .from("resume_sections").select("*").eq("resume_id", resumeId).order("sort_order", { ascending: true });

  return {
    title: resume.title,
    sections: (rows ?? []).map((row) => ({
      id: row.id as string,
      type: row.section_key as string,
      label: row.label as string,
      mode: row.mode as string,
      contentHtml: row.content_html as string,
      structuredData: (row.structured_data as Record<string, unknown>) ?? undefined,
    })),
    error: null,
  };
}

// ─── School search ────────────────────────────────────────────────────────────

export async function searchSchoolsAction(query: string): Promise<{ id: number; name: string }[]> {
  if (!query.trim()) return [];
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("schools").select("id, name").ilike("name", `%${query.trim()}%`).limit(8);
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
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { post: null, error: "Not signed in" };

  const rl = await gate(ratelimits.postCreate, `post:${user.id}`);
  if (!rl.ok) return { post: null, error: rl.error };

  const content = input.content.trim();
  const hasAttachment = !!(input.resume_id || input.score_card || input.result_card || input.poll_options?.length);
  if (!content && !hasAttachment) return { post: null, error: "Add some text, a score, result, resume, or poll before posting" };
  if (content.length > 2000) return { post: null, error: "Post exceeds 2000 characters" };
  if (!VALID_TOPICS.includes(input.topic_tag)) return { post: null, error: "Invalid topic" };
  if (containsProfanity(content)) return { post: null, error: "Post contains prohibited language" };

  if (input.resume_id) {
    const { data: resume } = await supabase.from("resumes").select("id").eq("id", input.resume_id).eq("user_id", user.id).maybeSingle();
    if (!resume) return { post: null, error: "Resume not found" };
  }

  if (input.poll_options) {
    if (input.poll_options.length < 2) return { post: null, error: "Polls need at least 2 options" };
    if (input.poll_options.some((o) => !o.text.trim())) return { post: null, error: "All poll options must have text" };
  }

  // A2 — verify membership when posting to a group (gates private and public alike).
  if (input.group_id) {
    const allowed = await canAccessGroup(supabase, input.group_id, user.id);
    if (!allowed) return { post: null, error: "Not authorized to post in this community" };
  }

  const { data: row, error: insertError } = await supabase
    .from("community_posts")
    .insert({
      user_id: user.id,
      content,
      topic_tag: input.topic_tag,
      result_card: input.result_card ?? null,
      score_card: input.score_card ?? null,
      resume_link: input.resume_id ?? null,
      is_anonymous: input.is_anonymous ?? false,
      university_id: input.university_id ?? null,
      poll_options: input.poll_options ?? null,
      group_id: input.group_id ?? null,
    })
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .single();

  if (insertError || !row) return { post: null, error: "Failed to create post" };

  const posts = await enrichPosts(supabase, [row as Record<string, unknown>], user.id);
  return { post: posts[0] ?? null, error: null };
}

// ─── Post editing ─────────────────────────────────────────────────────────────

export async function updatePostAction(
  postId: string,
  content: string
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const text = content.trim();
  if (!text) return { error: "Post cannot be empty" };
  if (text.length > 2000) return { error: "Post exceeds 2000 characters" };
  if (containsProfanity(text)) return { error: "Post contains prohibited language" };

  const { data: post } = await supabase
    .from("community_posts").select("user_id, created_at").eq("id", postId).single();
  if (!post || post.user_id !== user.id) return { error: "Not authorized" };

  const hoursDiff = (Date.now() - new Date(post.created_at as string).getTime()) / 3_600_000;
  if (hoursDiff > 24) return { error: "Posts can only be edited within 24 hours" };

  const { error } = await supabase
    .from("community_posts")
    .update({ content: text, edited_at: new Date().toISOString() })
    .eq("id", postId).eq("user_id", user.id);

  return { error: error?.message ?? null };
}

// ─── Feed (all / following) ───────────────────────────────────────────────────

export async function fetchPostsAction(
  cursor?: string,
  followingOnly?: boolean
): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let followeeIds: string[] | null = null;
  if (followingOnly) {
    if (!user) return { posts: [], nextCursor: null };
    const { data: follows } = await supabase
      .from("community_follows").select("followee_id").eq("follower_id", user.id);
    followeeIds = (follows ?? []).map((f) => f.followee_id as string);
    if (followeeIds.length === 0) return { posts: [], nextCursor: null };
  }

  // Exclude posts from users blocked by or who blocked the viewer
  let blockedIds: string[] = [];
  if (user) {
    const [blockedByMe, blockedMe] = await Promise.all([
      supabase.from("community_blocks").select("blocked_id").eq("blocker_id", user.id),
      supabase.from("community_blocks").select("blocker_id").eq("blocked_id", user.id),
    ]);
    blockedIds = [
      ...((blockedByMe.data ?? []).map((r) => r.blocked_id as string)),
      ...((blockedMe.data ?? []).map((r) => r.blocker_id as string)),
    ];
  }

  let query = supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("is_hidden", false)
    .is("group_id", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (cursor) query = query.lt("created_at", cursor);
  if (followeeIds) query = query.in("user_id", followeeIds);
  if (blockedIds.length) query = query.not("user_id", "in", `(${blockedIds.join(",")})`);

  const { data: rows, error } = await query;
  if (error || !rows) return { posts: [], nextCursor: null };

  const posts = await enrichPosts(supabase, rows as Record<string, unknown>[], user?.id);
  const nextCursor = rows.length === 20 ? rows[rows.length - 1].created_at as string : null;
  return { posts, nextCursor };
}

// ─── Feed (trending — top 20 by engagement in last 7 days) ───────────────────

export async function fetchTrendingPostsAction(): Promise<{ posts: CommunityPost[] }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("is_hidden", false)
    .gte("created_at", sevenDaysAgo)
    .limit(50);

  if (!rows?.length) return { posts: [] };

  const sorted = [...rows].sort((a, b) => {
    const aScore = ((a.likes as { count: number }[])?.[0]?.count ?? 0) + ((a.comments as { count: number }[])?.[0]?.count ?? 0);
    const bScore = ((b.likes as { count: number }[])?.[0]?.count ?? 0) + ((b.comments as { count: number }[])?.[0]?.count ?? 0);
    return bScore - aScore;
  }).slice(0, 20);

  const posts = await enrichPosts(supabase, sorted as Record<string, unknown>[], user?.id);
  return { posts };
}

// ─── Feed (user profile) ─────────────────────────────────────────────────────

export async function fetchPostsByUserAction(
  userId: string,
  cursor?: string
): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("is_hidden", false).eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(20);

  // B1 — hide anonymous posts on someone else's profile, otherwise the profile
  // page itself de-anonymises them. Owner still sees their own anonymous posts.
  if (user?.id !== userId) {
    query = query.eq("is_anonymous", false);
  }

  if (cursor) query = query.lt("created_at", cursor);
  const { data: rows, error } = await query;
  if (error || !rows) return { posts: [], nextCursor: null };

  const posts = await enrichPosts(supabase, rows as Record<string, unknown>[], user?.id);
  return { posts, nextCursor: rows.length === 20 ? rows[rows.length - 1].created_at as string : null };
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchPostsAction(
  query: string,
  topicFilter?: TopicTag
): Promise<{ posts: CommunityPost[] }> {
  if (!query.trim() && !topicFilter) return { posts: [] };
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let q = supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(30);

  if (query.trim()) q = q.ilike("content", `%${query.trim()}%`);
  if (topicFilter) q = q.eq("topic_tag", topicFilter);

  const { data: rows } = await q;
  if (!rows?.length) return { posts: [] };
  const posts = await enrichPosts(supabase, rows as Record<string, unknown>[], user?.id);
  return { posts };
}

// ─── Saved posts ──────────────────────────────────────────────────────────────

export async function fetchSavedPostsAction(
  cursor?: string
): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { posts: [], nextCursor: null };

  let savesQuery = supabase
    .from("community_saves")
    .select("post_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (cursor) savesQuery = savesQuery.lt("created_at", cursor);
  const { data: saves } = await savesQuery;
  if (!saves?.length) return { posts: [], nextCursor: null };

  const postIds = saves.map((s) => s.post_id as string);
  const { data: rows } = await supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("is_hidden", false)
    .in("id", postIds);

  if (!rows?.length) return { posts: [], nextCursor: null };

  const postMap = new Map((rows as Record<string, unknown>[]).map((r) => [r.id as string, r]));
  const orderedRows = postIds.map((id) => postMap.get(id)).filter(Boolean) as Record<string, unknown>[];

  const posts = await enrichPosts(supabase, orderedRows, user.id);
  const nextCursor = saves.length === 20 ? saves[saves.length - 1].created_at as string : null;
  return { posts, nextCursor };
}

// ─── Follows ─────────────────────────────────────────────────────────────────

export async function followUserAction(targetUserId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (user.id === targetUserId) return { error: "Cannot follow yourself" };

  const rl = await gate(ratelimits.followAction, `follow:${user.id}`);
  if (!rl.ok) return { error: rl.error };

  await supabase.from("community_follows").insert({ follower_id: user.id, followee_id: targetUserId });
  await supabase.from("notifications").insert({ user_id: targetUserId, actor_id: user.id, type: "follow", post_id: null });
  return { error: null };
}

export async function unfollowUserAction(targetUserId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  await supabase.from("community_follows").delete().eq("follower_id", user.id).eq("followee_id", targetUserId);
  return { error: null };
}

// ─── Privacy settings ────────────────────────────────────────────────────────

export async function updatePrivacySettingsAction(settings: PrivacySettings): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("community_profile_settings")
    .upsert({ user_id: user.id, ...settings, updated_at: new Date().toISOString() });
  return { error: error?.message ?? null };
}

// ─── Community profile ────────────────────────────────────────────────────────

export async function fetchCommunityProfileAction(
  targetUserId: string
): Promise<{ profile: CommunityProfileData | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const [profileResult, settingsResult, followerResult, followingResult, isFollowingResult] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, avatar_url, graduation_year, school_name, preferred_countries, target_majors").eq("id", targetUserId).single(),
    supabase.from("community_profile_settings").select("*").eq("user_id", targetUserId).maybeSingle(),
    supabase.from("community_follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", targetUserId),
    supabase.from("community_follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", targetUserId),
    user
      ? supabase.from("community_follows").select("followee_id").eq("follower_id", user.id).eq("followee_id", targetUserId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!profileResult.data) return { profile: null, error: "User not found" };
  const p = profileResult.data;
  const s = settingsResult.data ?? { show_graduation_year: true, show_school_name: true, show_preferred_countries: false, show_target_majors: false };

  return {
    profile: {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      avatar_url: p.avatar_url,
      graduation_year: s.show_graduation_year ? p.graduation_year : null,
      school_name: s.show_school_name ? p.school_name : null,
      preferred_countries: s.show_preferred_countries ? (p.preferred_countries ?? []) : [],
      target_majors: s.show_target_majors ? (p.target_majors ?? []) : [],
      follower_count: followerResult.count ?? 0,
      following_count: followingResult.count ?? 0,
      is_following: !!isFollowingResult.data,
      is_own_profile: user?.id === targetUserId,
      privacy: { show_graduation_year: s.show_graduation_year, show_school_name: s.show_school_name, show_preferred_countries: s.show_preferred_countries, show_target_majors: s.show_target_majors },
    },
    error: null,
  };
}

// ─── Likes ───────────────────────────────────────────────────────────────────

export async function toggleLikeAction(postId: string): Promise<{ liked: boolean; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { liked: false, error: "Not signed in" };

  const rl = await gate(ratelimits.likeAction, `like:${user.id}`);
  if (!rl.ok) return { liked: false, error: rl.error };

  const { data: existing } = await supabase.from("community_likes").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();

  if (existing) {
    await supabase.from("community_likes").delete().eq("post_id", postId).eq("user_id", user.id);
    return { liked: false, error: null };
  }

  await supabase.from("community_likes").insert({ post_id: postId, user_id: user.id });

  const { data: post } = await supabase.from("community_posts").select("user_id").eq("id", postId).single();
  if (post && post.user_id !== user.id) {
    await supabase.from("notifications").insert({ user_id: post.user_id, actor_id: user.id, type: "like", post_id: postId });
  }
  return { liked: true, error: null };
}

// ─── Saves ───────────────────────────────────────────────────────────────────

export async function toggleSaveAction(postId: string): Promise<{ saved: boolean; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { saved: false, error: "Not signed in" };

  const rl = await gate(ratelimits.saveAction, `save:${user.id}`);
  if (!rl.ok) return { saved: false, error: rl.error };

  const { data: existing } = await supabase.from("community_saves").select("post_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();

  if (existing) {
    await supabase.from("community_saves").delete().eq("post_id", postId).eq("user_id", user.id);
    return { saved: false, error: null };
  }
  await supabase.from("community_saves").insert({ post_id: postId, user_id: user.id });
  return { saved: true, error: null };
}

// ─── Poll voting ──────────────────────────────────────────────────────────────

export async function castPollVoteAction(
  postId: string,
  optionId: string | null
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (optionId === null) {
    await supabase.from("community_poll_votes").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("community_poll_votes").upsert(
      { post_id: postId, user_id: user.id, option_id: optionId },
      { onConflict: "post_id,user_id" }
    );
  }
  return { error: null };
}

// ─── Comments ────────────────────────────────────────────────────────────────

export async function fetchCommentsAction(postId: string): Promise<{ comments: CommunityComment[]; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // A3 — comments inherit their parent post's privacy gate.
  if (!(await canAccessPost(supabase, postId, user?.id))) {
    return { comments: [], error: null };
  }

  const { data: rows, error } = await supabase
    .from("community_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });

  if (error || !rows) return { comments: [], error: error?.message ?? "Failed to load" };

  const commentIds = rows.map((r) => r.id as string);
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];

  const [profilesRes, likesRes, userLikesRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", userIds)
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? supabase.from("community_comment_likes").select("comment_id").in("comment_id", commentIds)
      : Promise.resolve({ data: [] }),
    user && commentIds.length
      ? supabase.from("community_comment_likes").select("comment_id").eq("user_id", user.id).in("comment_id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = new Map<string, PostAuthor>(((profilesRes.data ?? []) as PostAuthor[]).map((p) => [p.id, p]));

  const likeCountMap = new Map<string, number>();
  for (const l of (likesRes.data ?? []) as { comment_id: string }[]) {
    likeCountMap.set(l.comment_id, (likeCountMap.get(l.comment_id) ?? 0) + 1);
  }
  const userLikedSet = new Set(((userLikesRes.data ?? []) as { comment_id: string }[]).map((l) => l.comment_id));

  const allComments: CommunityComment[] = rows.map((row) => ({
    ...row as CommunityComment,
    author: profileMap.get(row.user_id as string) ?? null,
    likes_count: likeCountMap.get(row.id as string) ?? 0,
    is_liked_by_user: userLikedSet.has(row.id as string),
    replies: [],
  }));

  const topLevel: CommunityComment[] = [];
  const byId = new Map(allComments.map((c) => [c.id, c]));
  for (const comment of allComments) {
    if (comment.parent_comment_id) byId.get(comment.parent_comment_id)?.replies.push(comment);
    else topLevel.push(comment);
  }
  return { comments: topLevel, error: null };
}

export async function addCommentAction(
  postId: string,
  content: string,
  parentCommentId?: string
): Promise<{ comment: CommunityComment | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { comment: null, error: "Not signed in" };

  const rl = await gate(ratelimits.commentCreate, `comment:${user.id}`);
  if (!rl.ok) return { comment: null, error: rl.error };

  const text = content.trim();
  if (!text) return { comment: null, error: "Comment cannot be empty" };
  if (text.length > 1000) return { comment: null, error: "Comment too long" };
  if (containsProfanity(text)) return { comment: null, error: "Comment contains prohibited language" };

  // A3 — comments inherit their parent post's privacy gate.
  if (!(await canAccessPost(supabase, postId, user.id))) {
    return { comment: null, error: "Not authorized to comment on this post" };
  }

  const { data: row, error: insertError } = await supabase
    .from("community_comments")
    .insert({ post_id: postId, user_id: user.id, content: text, parent_comment_id: parentCommentId ?? null })
    .select("*").single();

  if (insertError || !row) return { comment: null, error: "Failed to post comment" };

  const { data: profile } = await supabase.from("profiles").select("id, first_name, last_name, avatar_url").eq("id", user.id).single();
  const { data: post } = await supabase.from("community_posts").select("user_id").eq("id", postId).single();

  if (post && post.user_id !== user.id) {
    await supabase.from("notifications").insert({ user_id: post.user_id, actor_id: user.id, type: parentCommentId ? "reply" : "comment", post_id: postId, comment_id: row.id });
  }
  if (parentCommentId) {
    const { data: parentComment } = await supabase.from("community_comments").select("user_id").eq("id", parentCommentId).single();
    if (parentComment && parentComment.user_id !== user.id && parentComment.user_id !== post?.user_id) {
      await supabase.from("notifications").insert({ user_id: parentComment.user_id, actor_id: user.id, type: "reply", post_id: postId, comment_id: row.id });
    }
  }

  return { comment: { ...(row as CommunityComment), author: (profile as PostAuthor) ?? null, likes_count: 0, is_liked_by_user: false, replies: [] }, error: null };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotificationsAction(limit = 20): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { notifications: [], unreadCount: 0 };

  const { data: rows } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
  if (!rows?.length) return { notifications: [], unreadCount: 0 };

  const actorIds = [...new Set(rows.map((r) => r.actor_id as string).filter(Boolean))];
  const postIds  = [...new Set(rows.map((r) => r.post_id as string).filter(Boolean))];

  const [profilesResult, postsResult] = await Promise.all([
    actorIds.length ? supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", actorIds) : Promise.resolve({ data: [] }),
    postIds.length  ? supabase.from("community_posts").select("id, content").in("id", postIds) : Promise.resolve({ data: [] }),
  ]);

  const actorMap = new Map(((profilesResult.data ?? []) as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[]).map((p) => [p.id, { name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Someone", avatar: p.avatar_url }]));
  const postMap  = new Map(((postsResult.data ?? []) as { id: string; content: string }[]).map((p) => [p.id, p.content.slice(0, 60)]));

  const notifications: NotificationItem[] = rows.map((row) => ({
    id: row.id as string,
    type: row.type as NotificationItem["type"],
    actor_name: actorMap.get(row.actor_id as string)?.name ?? "Someone",
    actor_avatar: actorMap.get(row.actor_id as string)?.avatar ?? null,
    post_id: (row.post_id as string | null) ?? null,
    post_snippet: postMap.get(row.post_id as string) ?? "",
    is_read: row.is_read as boolean,
    created_at: row.created_at as string,
  }));

  return { notifications, unreadCount: notifications.filter((n) => !n.is_read).length };
}

export async function markNotificationsReadAction(): Promise<void> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
}

// ─── Moderation ───────────────────────────────────────────────────────────────

export async function reportPostAction(postId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const rl = await gate(ratelimits.reportAction, `report:${user.id}`);
  if (!rl.ok) return { error: rl.error };

  await supabase.from("community_reports").upsert({ post_id: postId, reporter_id: user.id });
  return { error: null };
}

export async function deletePostAction(postId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase.from("community_posts").delete().eq("id", postId).eq("user_id", user.id);
  return { error: error?.message ?? null };
}

// ─── Topic Stats (for sidebar) ───────────────────────────────────────────────

export async function fetchTopicStatsAction(): Promise<{ tag: TopicTag; count: number }[]> {
  const supabase = await createSupabaseServer();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("community_posts")
    .select("topic_tag")
    .eq("is_hidden", false)
    .gte("created_at", sevenDaysAgo);

  if (!data?.length) return [];

  const counts = new Map<TopicTag, number>();
  for (const row of data) {
    const tag = row.topic_tag as TopicTag;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag, count]) => ({ tag, count }));
}

// ─── Comment Likes ────────────────────────────────────────────────────────────

export async function toggleCommentLikeAction(commentId: string): Promise<{ liked: boolean; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { liked: false, error: "Not signed in" };

  const { data: existing } = await supabase
    .from("community_comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("community_comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
    return { liked: false, error: null };
  }
  await supabase.from("community_comment_likes").insert({ comment_id: commentId, user_id: user.id });
  return { liked: true, error: null };
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export async function blockUserAction(targetUserId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (user.id === targetUserId) return { error: "Cannot block yourself" };

  const rl = await gate(ratelimits.blockAction, `block:${user.id}`);
  if (!rl.ok) return { error: rl.error };

  await supabase.from("community_blocks").upsert({ blocker_id: user.id, blocked_id: targetUserId });
  // Also unfollow both ways
  await Promise.all([
    supabase.from("community_follows").delete().eq("follower_id", user.id).eq("followee_id", targetUserId),
    supabase.from("community_follows").delete().eq("follower_id", targetUserId).eq("followee_id", user.id),
  ]);
  return { error: null };
}

export async function unblockUserAction(targetUserId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  await supabase.from("community_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", targetUserId);
  return { error: null };
}

// ─── Followers / Following ────────────────────────────────────────────────────

export async function fetchFollowersAction(userId: string): Promise<{ users: PostAuthor[] }> {
  const supabase = await createSupabaseServer();
  const { data: rows } = await supabase
    .from("community_follows")
    .select("follower_id")
    .eq("followee_id", userId)
    .limit(100);

  if (!rows?.length) return { users: [] };
  const ids = rows.map((r) => r.follower_id as string);
  const { data: profiles } = await supabase
    .from("profiles").select("id, first_name, last_name, avatar_url").in("id", ids);
  return { users: (profiles ?? []) as PostAuthor[] };
}

export async function fetchFollowingAction(userId: string): Promise<{ users: PostAuthor[] }> {
  const supabase = await createSupabaseServer();
  const { data: rows } = await supabase
    .from("community_follows")
    .select("followee_id")
    .eq("follower_id", userId)
    .limit(100);

  if (!rows?.length) return { users: [] };
  const ids = rows.map((r) => r.followee_id as string);
  const { data: profiles } = await supabase
    .from("profiles").select("id, first_name, last_name, avatar_url").in("id", ids);
  return { users: (profiles ?? []) as PostAuthor[] };
}

// ─── Recommended Users ────────────────────────────────────────────────────────

export async function fetchRecommendedUsersAction(): Promise<{ users: PostAuthor[] }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { users: [] };

  // Exclude people already followed + blocked
  const [followingRes, blocksRes] = await Promise.all([
    supabase.from("community_follows").select("followee_id").eq("follower_id", user.id),
    supabase.from("community_blocks").select("blocked_id").eq("blocker_id", user.id),
  ]);
  const excludeIds = new Set([
    user.id,
    ...((followingRes.data ?? []).map((r) => r.followee_id as string)),
    ...((blocksRes.data ?? []).map((r) => r.blocked_id as string)),
  ]);

  // Pick most active recent posters
  const { data: rows } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("is_hidden", false)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200);

  if (!rows?.length) return { users: [] };

  const freq = new Map<string, number>();
  for (const r of rows) {
    const id = r.user_id as string;
    if (!excludeIds.has(id)) freq.set(id, (freq.get(id) ?? 0) + 1);
  }

  const topIds = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
  if (!topIds.length) return { users: [] };

  const { data: profiles } = await supabase
    .from("profiles").select("id, first_name, last_name, avatar_url").in("id", topIds);
  return { users: (profiles ?? []) as PostAuthor[] };
}

// ─── Pin Post ─────────────────────────────────────────────────────────────────

// ─── Community Groups ─────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export async function createGroupAction(input: {
  name: string;
  description?: string;
  is_private: boolean;
}): Promise<{ group: CommunityGroup | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { group: null, error: "Not signed in" };

  const rl = await gate(ratelimits.groupCreate, `groupcreate:${user.id}`);
  if (!rl.ok) return { group: null, error: rl.error };

  const name = input.name.trim();
  if (!name || name.length < 3) return { group: null, error: "Name must be at least 3 characters" };
  if (name.length > 50) return { group: null, error: "Name too long" };

  const slug = slugify(name);
  if (slug.length < 3) return { group: null, error: "Name produces an invalid slug" };

  const { data: existing } = await supabase.from("community_groups").select("id").eq("slug", slug).maybeSingle();
  if (existing) return { group: null, error: "A community with that name already exists" };

  const { data: row, error: insertError } = await supabase
    .from("community_groups")
    .insert({ name, slug, description: input.description?.trim() || null, creator_id: user.id, is_private: input.is_private })
    .select("*").single();

  if (insertError || !row) return { group: null, error: "Failed to create community" };

  // Creator auto-joins as owner
  await supabase.from("community_group_members").insert({ group_id: row.id, user_id: user.id, role: "owner" });

  revalidatePath("/communities/groups");
  revalidatePath("/communities");

  return {
    group: { ...(row as CommunityGroup), member_count: 1, post_count: 0, is_member: true, is_owner: true },
    error: null,
  };
}

export async function fetchGroupsAction(query?: string): Promise<{ groups: CommunityGroup[] }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  let q = supabase.from("community_groups").select("*").eq("is_private", false).order("created_at", { ascending: false }).limit(50);
  if (query?.trim()) q = q.ilike("name", `%${query.trim()}%`);

  const { data: rows } = await q;
  if (!rows?.length) return { groups: [] };

  const groupIds = rows.map((r) => r.id as string);
  const [memberCountsRes, postCountsRes, myMembershipsRes] = await Promise.all([
    supabase.from("community_group_members").select("group_id").in("group_id", groupIds),
    supabase.from("community_posts").select("group_id").eq("is_hidden", false).in("group_id", groupIds),
    user ? supabase.from("community_group_members").select("group_id, role").eq("user_id", user.id).in("group_id", groupIds) : Promise.resolve({ data: [] }),
  ]);

  const memberMap = new Map<string, number>();
  for (const r of (memberCountsRes.data ?? []) as { group_id: string }[]) memberMap.set(r.group_id, (memberMap.get(r.group_id) ?? 0) + 1);
  const postMap = new Map<string, number>();
  for (const r of (postCountsRes.data ?? []) as { group_id: string }[]) postMap.set(r.group_id, (postMap.get(r.group_id) ?? 0) + 1);
  const myMemberMap = new Map(((myMembershipsRes.data ?? []) as { group_id: string; role: string }[]).map((r) => [r.group_id, r.role]));

  return {
    groups: rows.map((r) => ({
      id: r.id as string, slug: r.slug as string, name: r.name as string,
      description: (r.description as string | null) ?? null,
      creator_id: (r.creator_id as string | null) ?? null,
      is_private: r.is_private as boolean,
      icon_url: (r.icon_url as string | null) ?? null,
      banner_url: (r.banner_url as string | null) ?? null,
      created_at: r.created_at as string,
      member_count: memberMap.get(r.id as string) ?? 0,
      post_count: postMap.get(r.id as string) ?? 0,
      is_member: myMemberMap.has(r.id as string),
      is_owner: myMemberMap.get(r.id as string) === "owner",
    })),
  };
}

export async function fetchGroupAction(slug: string): Promise<{ group: CommunityGroup | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: row } = await supabase.from("community_groups").select("*").eq("slug", slug).maybeSingle();
  if (!row) return { group: null, error: "Community not found" };

  const groupId = row.id as string;
  const [memberCountRes, postCountRes, myMemberRes, requestRes] = await Promise.all([
    supabase.from("community_group_members").select("user_id", { count: "exact", head: true }).eq("group_id", groupId),
    supabase.from("community_posts").select("id", { count: "exact", head: true }).eq("group_id", groupId).eq("is_hidden", false),
    user ? supabase.from("community_group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("community_group_requests").select("status").eq("group_id", groupId).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const myRole = (myMemberRes.data as { role: string } | null)?.role ?? null;
  const requestStatus = (requestRes.data as { status: string } | null)?.status ?? null;

  return {
    group: {
      id: groupId, slug: row.slug as string, name: row.name as string,
      description: (row.description as string | null) ?? null,
      creator_id: (row.creator_id as string | null) ?? null,
      is_private: row.is_private as boolean,
      icon_url: (row.icon_url as string | null) ?? null,
      banner_url: (row.banner_url as string | null) ?? null,
      created_at: row.created_at as string,
      member_count: memberCountRes.count ?? 0,
      post_count: postCountRes.count ?? 0,
      is_member: !!myRole,
      is_owner: myRole === "owner",
      has_requested: requestStatus === "pending",
    },
    error: null,
  };
}

export async function requestJoinGroupAction(groupId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Check if already a member
  const { data: existing } = await supabase
    .from("community_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { error: null };

  // Upsert request
  await supabase.from("community_group_requests").upsert({ group_id: groupId, user_id: user.id, status: "pending" });

  // Notify group owner
  const { data: groupRow } = await supabase.from("community_groups").select("creator_id, name").eq("id", groupId).maybeSingle();
  if (groupRow?.creator_id && groupRow.creator_id !== user.id) {
    const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
    const requesterName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Someone" : "Someone";
    await supabase.from("notifications").insert({
      user_id: groupRow.creator_id,
      actor_id: user.id,
      type: "join_request",
      post_id: null,
      message: `${requesterName} requested to join ${groupRow.name as string}`,
    });
  }

  return { error: null };
}

export async function joinGroupAction(groupId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  await supabase.from("community_group_members").upsert({ group_id: groupId, user_id: user.id, role: "member" });
  revalidatePath("/communities");
  revalidatePath("/communities/groups");
  return { error: null };
}

export async function leaveGroupAction(groupId: string): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  await supabase.from("community_group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
  revalidatePath("/communities");
  revalidatePath("/communities/groups");
  return { error: null };
}

export async function fetchGroupPostsAction(
  groupId: string,
  cursor?: string
): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // A1 — gate at the action layer; UI cannot be the only privacy boundary.
  const allowed = await canAccessGroup(supabase, groupId, user?.id);
  if (!allowed) return { posts: [], nextCursor: null };

  let query = supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("group_id", groupId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (cursor) query = query.lt("created_at", cursor);

  const { data: rows, error } = await query;
  if (error || !rows) return { posts: [], nextCursor: null };

  const posts = await enrichPosts(supabase, rows as Record<string, unknown>[], user?.id);
  return { posts, nextCursor: rows.length === 20 ? rows[rows.length - 1].created_at as string : null };
}

export async function fetchMyGroupsAction(): Promise<{ groups: CommunityGroup[] }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { groups: [] };

  const { data: memberships } = await supabase
    .from("community_group_members")
    .select("group_id, role")
    .eq("user_id", user.id);

  if (!memberships?.length) return { groups: [] };
  const groupIds = memberships.map((m) => m.group_id as string);
  const roleMap = new Map(memberships.map((m) => [m.group_id as string, m.role as string]));

  const { data: rows } = await supabase.from("community_groups").select("*").in("id", groupIds).order("name");
  if (!rows?.length) return { groups: [] };

  return {
    groups: rows.map((r) => ({
      id: r.id as string, slug: r.slug as string, name: r.name as string,
      description: (r.description as string | null) ?? null,
      creator_id: (r.creator_id as string | null) ?? null,
      is_private: r.is_private as boolean,
      icon_url: (r.icon_url as string | null) ?? null,
      banner_url: (r.banner_url as string | null) ?? null,
      created_at: r.created_at as string,
      member_count: 0, post_count: 0,
      is_member: true,
      is_owner: roleMap.get(r.id as string) === "owner",
    })),
  };
}

export async function pinPostAction(postId: string | null): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (postId) {
    const { data: post } = await supabase.from("community_posts").select("user_id").eq("id", postId).single();
    if (!post || post.user_id !== user.id) return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("community_profile_settings")
    .upsert({ user_id: user.id, pinned_post_id: postId, updated_at: new Date().toISOString() });
  return { error: error?.message ?? null };
}
