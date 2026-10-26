import { createSupabaseServer } from "@/lib/supabase-server";
import type { CommunityPost, PostAuthor, TopicTag, ResultCard, ScoreCard, PollOption } from "@/types/community";


// ─── Per-user record caps (P2.8) ─────────────────────────────────────────────
// Hard ceilings to prevent a single account from creating unbounded resources.
// These are deliberately generous — rate limits handle bursts; these handle
// long-running accumulation.
export const CAPS = {
  postsLifetime: 5000,
  postsPerDay: 100,
  followsLifetime: 10_000,
  groupsOwned: 20,
} as const;


// ─── Shared enrichment helper ─────────────────────────────────────────────────

export type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServer>>;


/**
 * Verifies the caller is allowed to read posts/comments in a given group (A1, A3).
 * Public groups are always readable. Private groups require an active membership
 * row or the caller being the creator. Returns false for unknown groups.
 */
export async function canAccessGroup(
  supabase: SupabaseClient,
  groupId: string,
  userId: string | undefined,
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
 * Returns the set of user ids the viewer can no longer interact with — both
 * users they blocked and users who blocked them. Empty array when not signed in.
 * Used by every feed/search action so the block list is enforced consistently
 * (A4).
 */
export async function fetchBlockedIds(
  supabase: SupabaseClient,
  userId: string | undefined,
): Promise<string[]> {
  if (!userId) return [];
  const [blockedByMe, blockedMe] = await Promise.all([
    supabase
      .from("community_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId),
    supabase
      .from("community_blocks")
      .select("blocker_id")
      .eq("blocked_id", userId),
  ]);
  return [
    ...(blockedByMe.data ?? []).map((r) => r.blocked_id as string),
    ...(blockedMe.data ?? []).map((r) => r.blocker_id as string),
  ];
}


/**
 * True when either user has blocked the other. Used to stop blocked users from
 * interacting (liking/commenting/voting) — feeds already filter by block list,
 * but interactions weren't gated.
 */
export async function isBlockedBetween(
  supabase: SupabaseClient,
  a: string | undefined,
  b: string | null | undefined,
): Promise<boolean> {
  if (!a || !b || a === b) return false;
  const { data } = await supabase
    .from("community_blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`,
    )
    .limit(1);
  return !!(data && data.length);
}


/**
 * Verifies the caller can read/comment on a given post (A3).
 * Posts not in a group are accessible per existing RLS. Posts in a group inherit
 * that group's privacy gate.
 */
export async function canAccessPost(
  supabase: SupabaseClient,
  postId: string,
  userId: string | undefined,
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


export async function enrichPosts(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  currentUserId?: string,
): Promise<CommunityPost[]> {
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((r) => r.user_id as string))];
  const universityIds = rows
    .map((r) => r.university_id as number | null)
    .filter((id): id is number => id != null);
  const pollPostIds = rows
    .filter((r) => r.poll_options != null)
    .map((r) => r.id as string);

  const postIds = rows.map((r) => r.id as string);

  const [
    profilesRes,
    schoolsRes,
    pollVotesRes,
    userVotesRes,
    savesRes,
    viewerLikesRes,
    viewerSavesRes,
  ] = await Promise.all([
    // Profiles RLS restricts SELECT to the row owner, so a direct
    // .from("profiles") read returns nothing for posts authored by anyone
    // other than the viewer — which made every other user's post fall back
    // to the null-author branch in PostCard and render as "Anonymous". The
    // RPC is SECURITY DEFINER and exposes only the public-display columns.
    supabase.rpc("get_public_profiles", { user_ids: userIds }),
    universityIds.length
      ? supabase.from("schools").select("id, name").in("id", universityIds)
      : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    // A10 — poll tallies come from a SECURITY DEFINER aggregate RPC (counts only,
    // no voter ids) so the poll_votes SELECT policy can be scoped to the voter
    // without leaking who voted for what.
    pollPostIds.length
      ? supabase.rpc("get_poll_vote_counts", { post_ids: pollPostIds })
      : Promise.resolve({
          data: [] as { post_id: string; option_id: string; votes: number }[],
        }),
    currentUserId && pollPostIds.length
      ? supabase
          .from("community_poll_votes")
          .select("post_id, option_id")
          .eq("user_id", currentUserId)
          .in("post_id", pollPostIds)
      : Promise.resolve({
          data: [] as { post_id: string; option_id: string }[],
        }),
    supabase.from("community_saves").select("post_id").in("post_id", postIds),
    // D7 — per-viewer like/save so every loaded post (not just the first page)
    // renders with the correct like/save state on infinite scroll.
    currentUserId
      ? supabase
          .from("community_likes")
          .select("post_id")
          .eq("user_id", currentUserId)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    currentUserId
      ? supabase
          .from("community_saves")
          .select("post_id")
          .eq("user_id", currentUserId)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const viewerLiked = new Set(
    ((viewerLikesRes.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
  );
  const viewerSaved = new Set(
    ((viewerSavesRes.data ?? []) as { post_id: string }[]).map((r) => r.post_id),
  );

  type ProfileRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
  const profileMap = new Map<string, ProfileRow>(
    ((profilesRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p]),
  );
  const schoolNameMap = new Map(
    ((schoolsRes.data ?? []) as { id: number; name: string }[]).map((s) => [
      s.id,
      s.name,
    ]),
  );

  const pollCountMap = new Map<string, Record<string, number>>();
  for (const v of (pollVotesRes.data ?? []) as {
    post_id: string;
    option_id: string;
    votes: number;
  }[]) {
    if (!pollCountMap.has(v.post_id)) pollCountMap.set(v.post_id, {});
    const m = pollCountMap.get(v.post_id)!;
    m[v.option_id] = Number(v.votes);
  }
  const userVoteMap = new Map(
    ((userVotesRes.data ?? []) as { post_id: string; option_id: string }[]).map(
      (v) => [v.post_id, v.option_id],
    ),
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
    const author: PostAuthor | null = isAnon
      ? null
      : p
        ? {
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            avatar_url: p.avatar_url,
            is_verified: p.is_verified ?? false,
          }
        : null;
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
      school_name: row.university_id
        ? (schoolNameMap.get(row.university_id as number) ?? null)
        : null,
      major_id: (row.major_id as string | null) ?? null,
      result_card: (row.result_card as ResultCard | null) ?? null,
      score_card: (row.score_card as ScoreCard | null) ?? null,
      resume_id: (row.resume_link as string | null) ?? null,
      resume_title: null, // Shared title comes from the authorized frozen copy.
      is_anonymous: isAnon,
      is_hidden: (row.is_hidden as boolean) ?? false,
      is_removed: (row.is_removed as boolean) ?? false,
      edited_at: (row.edited_at as string | null) ?? null,
      poll_options: (row.poll_options as PollOption[] | null) ?? null,
      poll_votes: pollCountMap.get(row.id as string) ?? null,
      user_vote: userVoteMap.get(row.id as string) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      likes_count:
        (row.likes as { count: number }[] | undefined)?.[0]?.count ?? 0,
      comments_count:
        (row.comments as { count: number }[] | undefined)?.[0]?.count ?? 0,
      saves_count: savesCountMap.get(row.id as string) ?? 0,
      viewer_has_liked: currentUserId ? viewerLiked.has(row.id as string) : undefined,
      viewer_has_saved: currentUserId ? viewerSaved.has(row.id as string) : undefined,
      author,
    };
  });
}
