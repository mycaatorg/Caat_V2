import { PageHeader } from "@/components/PageHeader";
import { createSupabaseServer } from "@/lib/supabase-server";
import { fetchPostsAction } from "./actions";
import { CommunityFeedClient } from "./CommunityFeedClient";
import type { PostAuthor } from "@/types/community";

export default async function CommunitiesPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { posts, nextCursor } = await fetchPostsAction();
  const postIds = posts.map((p) => p.id);

  const [likedResult, savedResult, profileResult] = await Promise.all([
    user && postIds.length
      ? supabase.from("community_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    user && postIds.length
      ? supabase.from("community_saves").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("profiles").select("id, first_name, last_name, avatar_url").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  const likedIds = (likedResult.data ?? []).map((r: { post_id: string }) => r.post_id);
  const savedIds = (savedResult.data ?? []).map((r: { post_id: string }) => r.post_id);
  const currentUser = (profileResult.data as PostAuthor | null) ?? null;

  return (
    <>
      <PageHeader title="Communities" />
      <div className="p-6">
        <main className="max-w-2xl mx-auto">
          <CommunityFeedClient
            initialPosts={posts}
            initialCursor={nextCursor}
            currentUser={currentUser}
            initialLikedIds={likedIds}
            initialSavedIds={savedIds}
          />
        </main>
      </div>
    </>
  );
}
