import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { createSupabaseServer } from "@/lib/supabase-server";
import { PostCard } from "@/components/communities/PostCard";
import type { CommunityPost, PostAuthor } from "@/types/community";

interface Props {
  params: Promise<{ postId: string }>;
}

export default async function SinglePostPage({ params }: Props) {
  const { postId } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: row, error } = await supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("id", postId)
    .eq("is_hidden", false)
    .single();

  if (error || !row) notFound();

  const userIds = [row.user_id, ...(user ? [user.id] : [])];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", [...new Set(userIds)]);

  const profileMap = new Map<string, PostAuthor>(
    (profiles ?? []).map((p) => [p.id, p])
  );

  const [likedResult, savedResult] = await Promise.all([
    user
      ? supabase.from("community_likes").select("post_id").eq("user_id", user.id).eq("post_id", postId).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("community_saves").select("post_id").eq("user_id", user.id).eq("post_id", postId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const resumeId = (row.resume_link as string | null) ?? null;
  const { data: resumeRow } = resumeId
    ? await supabase.from("resumes").select("title").eq("id", resumeId).single()
    : { data: null };

  // B1 — anonymise user_id and null the author when the viewer is not the
  // post owner. Owner still sees their real id so they can edit/delete.
  const isAnon = (row.is_anonymous as boolean | null) ?? false;
  const isOwnPost = !!user && user.id === row.user_id;
  const exposedUserId = isAnon && !isOwnPost ? `anon:${row.id}` : (row.user_id as string);
  const post: CommunityPost = {
    ...row,
    user_id: exposedUserId,
    resume_id: resumeId,
    resume_title: (resumeRow as { title: string } | null)?.title ?? null,
    likes_count: (row.likes as { count: number }[])[0]?.count ?? 0,
    comments_count: (row.comments as { count: number }[])[0]?.count ?? 0,
    author: isAnon ? null : (profileMap.get(row.user_id) ?? null),
  };

  const currentUser = user ? (profileMap.get(user.id) ?? null) : null;

  return (
    <>
      <PageHeader title="Community Campus" />
      <div className="p-6">
        <main className="max-w-2xl mx-auto">
          <PostCard
            post={post}
            currentUser={currentUser}
            initialIsLiked={!!likedResult.data}
            initialIsSaved={!!savedResult.data}
          />
        </main>
      </div>
    </>
  );
}
