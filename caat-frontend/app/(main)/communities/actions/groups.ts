"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase-server";
import { gate, ratelimits } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/safe-error";
import { GroupInputSchema } from "@/lib/schemas/community";
import type { CommunityPost, CommunityGroup, PostAuthor } from "@/types/community";
import { CAPS, canAccessGroup, fetchBlockedIds, enrichPosts } from "./_shared";


// ─── Pin Post ─────────────────────────────────────────────────────────────────

// ─── Community Groups ─────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}


export async function createGroupAction(input: {
  name: string;
  description?: string;
  is_private: boolean;
}): Promise<{ group: CommunityGroup | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { group: null, error: "Not signed in" };

  const rl = await gate(ratelimits.groupCreate, `groupcreate:${user.id}`);
  if (!rl.ok) return { group: null, error: rl.error };

  // P2.8 — lifetime cap on groups owned per user.
  const { count: ownedGroupCount } = await supabase
    .from("community_groups")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id);
  if ((ownedGroupCount ?? 0) >= CAPS.groupsOwned) {
    return {
      group: null,
      error: `You can own at most ${CAPS.groupsOwned} communities.`,
    };
  }

  // P2.7 — schema validation (also enforces F1 description max-length).
  const parsed = GroupInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      group: null,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;
  const name = data.name;

  const slug = slugify(name);
  if (slug.length < 3)
    return { group: null, error: "Name produces an invalid slug" };

  const { data: existing } = await supabase
    .from("community_groups")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing)
    return { group: null, error: "A community with that name already exists" };

  const { data: row, error: insertError } = await supabase
    .from("community_groups")
    .insert({
      name,
      slug,
      description: data.description || null,
      creator_id: user.id,
      is_private: data.is_private,
    })
    .select("*")
    .single();

  if (insertError || !row)
    return { group: null, error: "Failed to create community" };

  // The database trigger inserts the owner membership in the same transaction.

  revalidatePath("/communities/groups");
  revalidatePath("/communities");

  return {
    group: {
      ...(row as unknown as CommunityGroup),
      member_count: 1,
      post_count: 0,
      is_member: true,
      is_owner: true,
    },
    error: null,
  };
}


export async function updateGroupAction(
  groupId: string,
  input: { name: string; description?: string; is_private: boolean },
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: group } = await supabase
    .from("community_groups")
    .select("creator_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.creator_id !== user.id) return { error: "Not authorized" };

  const parsed = GroupInputSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Note: slug is intentionally NOT changed on rename so existing links keep working.
  const { data: updated, error } = await supabase
    .from("community_groups")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      is_private: parsed.data.is_private,
    })
    .eq("id", groupId)
    .eq("creator_id", user.id)
    .select("id");

  if (error) return { error: sanitizeError(error, "Could not update community.") };
  if (!updated?.length) return { error: "Could not update community. Please try again." };
  revalidatePath("/communities/groups");
  revalidatePath("/communities");
  return { error: null };
}


export async function deleteGroupAction(
  groupId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: group } = await supabase
    .from("community_groups")
    .select("creator_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.creator_id !== user.id) return { error: "Not authorized" };

  // Children (posts, members, requests) are removed by the delete_group_children
  // trigger so other members' posts cascade despite per-row RLS.
  const { data: deleted, error } = await supabase
    .from("community_groups")
    .delete()
    .eq("id", groupId)
    .eq("creator_id", user.id)
    .select("id");

  if (error) return { error: sanitizeError(error, "Could not delete community.") };
  if (!deleted?.length) return { error: "Could not delete community. Please try again." };
  revalidatePath("/communities/groups");
  revalidatePath("/communities");
  return { error: null };
}


export async function fetchGroupsAction(
  query?: string,
): Promise<{ groups: CommunityGroup[] }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let q = supabase
    .from("community_groups")
    .select("*")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(50);
  if (query?.trim()) {
    // I1 — escape PostgREST LIKE wildcards.
    const safe = query.trim().replace(/[\\%_]/g, "\\$&");
    q = q.ilike("name", `%${safe}%`);
  }

  const { data: rows } = await q;
  if (!rows?.length) return { groups: [] };

  const groupIds = rows.map((r) => r.id as string);
  const [memberCountsRes, postCountsRes, myMembershipsRes] = await Promise.all([
    supabase
      .from("community_group_members")
      .select("group_id")
      .in("group_id", groupIds),
    supabase
      .from("community_posts")
      .select("group_id")
      .eq("is_hidden", false)
      .in("group_id", groupIds),
    user
      ? supabase
          .from("community_group_members")
          .select("group_id, role")
          .eq("user_id", user.id)
          .in("group_id", groupIds)
      : Promise.resolve({ data: [] }),
  ]);

  const memberMap = new Map<string, number>();
  for (const r of (memberCountsRes.data ?? []) as { group_id: string }[])
    memberMap.set(r.group_id, (memberMap.get(r.group_id) ?? 0) + 1);
  const postMap = new Map<string, number>();
  for (const r of (postCountsRes.data ?? []) as { group_id: string }[])
    postMap.set(r.group_id, (postMap.get(r.group_id) ?? 0) + 1);
  const myMemberMap = new Map(
    ((myMembershipsRes.data ?? []) as { group_id: string; role: string }[]).map(
      (r) => [r.group_id, r.role],
    ),
  );

  return {
    groups: rows.map((r) => ({
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
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


export async function fetchGroupAction(
  slug: string,
): Promise<{ group: CommunityGroup | null; error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row } = await supabase
    .from("community_groups")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!row) return { group: null, error: "Community not found" };

  const groupId = row.id as string;
  const [memberCountRes, postCountRes, myMemberRes, requestRes] =
    await Promise.all([
      supabase
        .from("community_group_members")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", groupId),
      supabase
        .from("community_posts")
        .select("id", { count: "exact", head: true })
        .eq("group_id", groupId)
        .eq("is_hidden", false),
      user
        ? supabase
            .from("community_group_members")
            .select("role")
            .eq("group_id", groupId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("community_group_requests")
            .select("status")
            .eq("group_id", groupId)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const myRole = (myMemberRes.data as { role: string } | null)?.role ?? null;
  const requestStatus =
    (requestRes.data as { status: string } | null)?.status ?? null;

  return {
    group: {
      id: groupId,
      slug: row.slug as string,
      name: row.name as string,
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


export async function requestJoinGroupAction(
  groupId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const { error: requestError } = await supabase
    .from("community_group_requests")
    .upsert({ group_id: groupId, user_id: user.id, status: "pending" });
  if (requestError)
    return { error: sanitizeError(requestError, "Could not request to join this community.") };

  // Notify group owner
  const { data: groupRow } = await supabase
    .from("community_groups")
    .select("creator_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (groupRow?.creator_id && groupRow.creator_id !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    const requesterName = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "Someone"
      : "Someone";
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


export async function approveJoinRequestAction(
  groupId: string,
  requesterUserId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Verify caller owns the group.
  const { data: group } = await supabase
    .from("community_groups")
    .select("creator_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.creator_id !== user.id)
    return { error: "Not authorized" };

  const { data: changed, error: approvalError } = await supabase.rpc(
    "approve_group_join_request",
    { p_group_id: groupId, p_requester_user_id: requesterUserId },
  );
  if (approvalError)
    return { error: sanitizeError(approvalError, "Could not approve this join request.") };
  // A repeated approval is successful but must not send a duplicate notification.
  if (changed) {
    await supabase.from("notifications").insert({
      user_id: requesterUserId,
      actor_id: user.id,
      type: "request_approved",
      post_id: null,
      message: `Your request to join ${group.name as string} was approved`,
    });
  }

  revalidatePath("/communities");
  revalidatePath("/communities/groups");
  return { error: null };
}


export async function rejectJoinRequestAction(
  groupId: string,
  requesterUserId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: group } = await supabase
    .from("community_groups")
    .select("creator_id, name")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.creator_id !== user.id)
    return { error: "Not authorized" };

  const { error } = await supabase.rpc("reject_group_join_request", {
    p_group_id: groupId,
    p_requester_user_id: requesterUserId,
  });
  if (error)
    return { error: sanitizeError(error, "Could not reject this join request.") };
  // Intentionally no notification on rejection — avoids confirming the group exists
  // to a user who attempted to discover private groups by id.

  return { error: null };
}


export async function fetchPendingJoinRequestsAction(
  groupId: string,
): Promise<{
  requests: { user_id: string; created_at: string; user: PostAuthor | null }[];
  error: string | null;
}> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { requests: [], error: "Not signed in" };

  const { data: group } = await supabase
    .from("community_groups")
    .select("creator_id")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || group.creator_id !== user.id)
    return { requests: [], error: "Not authorized" };

  const { data: rows } = await supabase
    .from("community_group_requests")
    .select("user_id, created_at")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (!rows?.length) return { requests: [], error: null };

  const userIds = rows.map((r) => r.user_id as string);
  const { data: profiles } = await supabase.rpc("get_public_profiles", {
    user_ids: userIds,
  });
  const profileMap = new Map<string, PostAuthor>(
    ((profiles ?? []) as PostAuthor[]).map((p) => [p.id, p]),
  );

  return {
    requests: rows.map((r) => ({
      user_id: r.user_id as string,
      created_at: r.created_at as string,
      user: profileMap.get(r.user_id as string) ?? null,
    })),
    error: null,
  };
}


export async function joinGroupAction(
  groupId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Reject self-join on private groups — they must go through the request flow.
  // (Pre-Phase-2 this was bypassable.)
  const { data: group } = await supabase
    .from("community_groups")
    .select("is_private")
    .eq("id", groupId)
    .maybeSingle();
  if (!group) return { error: "Community not found" };
  if (group.is_private)
    return { error: "This community requires an approved join request" };

  const { error } = await supabase
    .from("community_group_members")
    .upsert(
      { group_id: groupId, user_id: user.id, role: "member" },
      { onConflict: "group_id,user_id", ignoreDuplicates: true },
    );
  if (error)
    return { error: sanitizeError(error, "Could not join this community.") };
  revalidatePath("/communities");
  revalidatePath("/communities/groups");
  return { error: null };
}


export async function leaveGroupAction(
  groupId: string,
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // The creator can't leave their own community (would orphan it). They must
  // delete it (or, later, transfer ownership) instead.
  const { data: group } = await supabase
    .from("community_groups")
    .select("creator_id")
    .eq("id", groupId)
    .maybeSingle();
  if (group?.creator_id === user.id)
    return {
      error: "As the creator you can't leave. Delete the community instead.",
    };

  const { data: deleted, error } = await supabase
    .from("community_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .select("group_id");
  if (error) return { error: sanitizeError(error, "Could not leave this community.") };
  if (!deleted?.length) return { error: "Could not leave this community. Please try again." };
  revalidatePath("/communities");
  revalidatePath("/communities/groups");
  return { error: null };
}


export async function fetchGroupPostsAction(
  groupId: string,
  cursor?: string,
): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A1 — gate at the action layer; UI cannot be the only privacy boundary.
  const allowed = await canAccessGroup(supabase, groupId, user?.id);
  if (!allowed) return { posts: [], nextCursor: null };

  const blockedIds = await fetchBlockedIds(supabase, user?.id);

  let query = supabase
    .from("community_posts")
    .select(
      "*, likes:community_likes(count), comments:community_comments(count)",
    )
    .eq("group_id", groupId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(20);

  // A4 — exclude blocked relationships even within shared groups.
  if (blockedIds.length)
    query = query.not("user_id", "in", `(${blockedIds.join(",")})`);

  if (cursor) {
    const [cTs, cId] = cursor.split("|");
    query = cId
      ? query.or(`created_at.lt.${cTs},and(created_at.eq.${cTs},id.lt.${cId})`)
      : query.lt("created_at", cTs);
  }

  const { data: rows, error } = await query;
  if (error || !rows) return { posts: [], nextCursor: null };

  const posts = await enrichPosts(
    supabase,
    rows as Record<string, unknown>[],
    user?.id,
  );
  const last = rows[rows.length - 1];
  return {
    posts,
    nextCursor:
      rows.length === 20
        ? `${last.created_at as string}|${last.id as string}`
        : null,
  };
}


export async function fetchMyGroupsAction(): Promise<{
  groups: CommunityGroup[];
}> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { groups: [] };

  const { data: memberships } = await supabase
    .from("community_group_members")
    .select("group_id, role")
    .eq("user_id", user.id);

  if (!memberships?.length) return { groups: [] };
  const groupIds = memberships.map((m) => m.group_id as string);
  const roleMap = new Map(
    memberships.map((m) => [m.group_id as string, m.role as string]),
  );

  const { data: rows } = await supabase
    .from("community_groups")
    .select("*")
    .in("id", groupIds)
    .order("name");
  if (!rows?.length) return { groups: [] };

  return {
    groups: rows.map((r) => ({
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      creator_id: (r.creator_id as string | null) ?? null,
      is_private: r.is_private as boolean,
      icon_url: (r.icon_url as string | null) ?? null,
      banner_url: (r.banner_url as string | null) ?? null,
      created_at: r.created_at as string,
      member_count: 0,
      post_count: 0,
      is_member: true,
      is_owner: roleMap.get(r.id as string) === "owner",
    })),
  };
}
