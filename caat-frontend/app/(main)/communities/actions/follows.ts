"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase-server";
import { gate, ratelimits } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/safe-error";
import type { PostAuthor } from "@/types/community";
import { CAPS } from "./_shared";


// ─── Follows ─────────────────────────────────────────────────────────────────

export async function followUserAction(
  targetUserId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (user.id === targetUserId) return { error: "Cannot follow yourself" };

  const rl = await gate(ratelimits.followAction, `follow:${user.id}`);
  if (!rl.ok) return { error: rl.error };

  // P2.8 — lifetime follow cap.
  const { count } = await supabase
    .from("community_follows")
    .select("follower_id", { count: "exact", head: true })
    .eq("follower_id", user.id);
  if ((count ?? 0) >= CAPS.followsLifetime) {
    return { error: "Follow limit reached." };
  }

  // PROD-100: the database notifies the followed user from the follow row.
  const { error: followError } = await supabase
    .from("community_follows")
    .insert({ follower_id: user.id, followee_id: targetUserId });
  // A duplicate means already following (a double tap or another tab).
  if (followError && followError.code !== "23505")
    return { error: sanitizeError(followError, "Could not follow this person.") };
  // Refresh both the target's profile (their follower_count + is_following)
  // and the viewer's own profile (their following_count) so the UI updates
  // without a hard refresh after the server action returns.
  revalidatePath(`/communities/profile/${targetUserId}`);
  revalidatePath(`/communities/profile/${user.id}`);
  revalidatePath("/communities");
  return { error: null };
}


export async function unfollowUserAction(
  targetUserId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error: unfollowError } = await supabase
    .from("community_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("followee_id", targetUserId);
  if (unfollowError) return { error: sanitizeError(unfollowError, "Could not unfollow this person.") };
  revalidatePath(`/communities/profile/${targetUserId}`);
  revalidatePath(`/communities/profile/${user.id}`);
  revalidatePath("/communities");
  return { error: null };
}


// ─── Followers / Following ────────────────────────────────────────────────────

export async function fetchFollowersAction(
  userId: string,
): Promise<{ users: PostAuthor[] }> {
  const supabase = await createSupabaseServer();
  const { data: rows } = await supabase
    .from("community_follows")
    .select("follower_id")
    .eq("followee_id", userId)
    .limit(100);

  if (!rows?.length) return { users: [] };
  const ids = rows.map((r) => r.follower_id as string);
  const { data: profiles } = await supabase.rpc("get_public_profiles", {
    user_ids: ids,
  });
  return { users: (profiles ?? []) as PostAuthor[] };
}


export async function fetchFollowingAction(
  userId: string,
): Promise<{ users: PostAuthor[] }> {
  const supabase = await createSupabaseServer();
  const { data: rows } = await supabase
    .from("community_follows")
    .select("followee_id")
    .eq("follower_id", userId)
    .limit(100);

  if (!rows?.length) return { users: [] };
  const ids = rows.map((r) => r.followee_id as string);
  const { data: profiles } = await supabase.rpc("get_public_profiles", {
    user_ids: ids,
  });
  return { users: (profiles ?? []) as PostAuthor[] };
}


// ─── Recommended Users ────────────────────────────────────────────────────────

export async function fetchRecommendedUsersAction(): Promise<{
  users: PostAuthor[];
}> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { users: [] };

  // Exclude people already followed + blocked
  const [followingRes, blocksRes] = await Promise.all([
    supabase
      .from("community_follows")
      .select("followee_id")
      .eq("follower_id", user.id),
    supabase
      .from("community_blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id),
  ]);
  const excludeIds = new Set([
    user.id,
    ...(followingRes.data ?? []).map((r) => r.followee_id as string),
    ...(blocksRes.data ?? []).map((r) => r.blocked_id as string),
  ]);

  // Pick most active recent posters
  const { data: rows } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("is_hidden", false)
    .gte(
      "created_at",
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    )
    .limit(200);

  if (!rows?.length) return { users: [] };

  const freq = new Map<string, number>();
  for (const r of rows) {
    const id = r.user_id as string;
    if (!excludeIds.has(id)) freq.set(id, (freq.get(id) ?? 0) + 1);
  }

  const topIds = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id);
  if (!topIds.length) return { users: [] };

  const { data: profiles } = await supabase.rpc("get_public_profiles", {
    user_ids: topIds,
  });
  return { users: (profiles ?? []) as PostAuthor[] };
}
