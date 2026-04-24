"use server";

import { createSupabaseServer } from "@/lib/supabase-server";
import type { CommunityPost, PostAuthor } from "@/types/community";

export async function fetchPostsAction(cursor?: string): Promise<{
  posts: CommunityPost[];
  nextCursor: string | null;
}> {
  const supabase = await createSupabaseServer();

  let query = supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: rows, error } = await query;

  if (error || !rows) return { posts: [], nextCursor: null };

  // Fetch author profiles for this batch
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map<string, PostAuthor>(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const posts: CommunityPost[] = rows.map((row) => ({
    ...row,
    likes_count: (row.likes as { count: number }[])[0]?.count ?? 0,
    comments_count: (row.comments as { count: number }[])[0]?.count ?? 0,
    author: profileMap.get(row.user_id) ?? null,
  }));

  const nextCursor =
    rows.length === 20 ? rows[rows.length - 1].created_at : null;

  return { posts, nextCursor };
}
