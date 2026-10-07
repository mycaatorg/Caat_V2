import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { createSupabaseServer } from "@/lib/supabase-server";
import { PostCard } from "@/components/communities/PostCard";
import { enrichPosts } from "@/app/(main)/communities/actions/_shared";
import type { PostAuthor } from "@/types/community";

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

  // M7 — enrich the permalink post the same way the feed does, so polls, save
  // counts, resume title and the verified badge all render here too.
  const [post] = await enrichPosts(
    supabase,
    [row as Record<string, unknown>],
    user?.id,
  );

  // The viewer's own profile (for the comment composer avatar).
  const currentUser: PostAuthor | null = user
    ? (((await supabase.rpc("get_public_profiles", { user_ids: [user.id] }))
        .data as PostAuthor[] | null)?.[0] ?? null)
    : null;

  return (
    <>
      <PageHeader title="Community Campus" />
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <PostCard
            post={post}
            currentUser={currentUser}
            initialIsLiked={post.viewer_has_liked ?? false}
            initialIsSaved={post.viewer_has_saved ?? false}
          />
        </div>
      </div>
    </>
  );
}
