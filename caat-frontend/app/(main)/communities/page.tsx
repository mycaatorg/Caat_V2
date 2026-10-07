import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { createSupabaseServer } from "@/lib/supabase-server";
import { fetchPostsAction } from "./actions";
import { CommunityFeedClient } from "./CommunityFeedClient";
import { CommunitySidebar } from "@/components/communities/CommunitySidebar";
import type { PostAuthor } from "@/types/community";

export default async function CommunitiesPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { posts, nextCursor, error: feedError } = await fetchPostsAction();
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
      <PageHeader title="Community Campus" />
      <div className="p-6">
        <div className="max-w-5xl mx-auto flex gap-6 items-start">
          {/* Feed */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* M4 — the sidebar is desktop-only, so give phone users a way to
                reach browse / join / manage communities from the feed. */}
            <Button asChild variant="outline" className="w-full gap-2 lg:hidden">
              <Link href="/communities/groups">
                <Users className="size-4" />
                Browse and manage communities
              </Link>
            </Button>
            <CommunityFeedClient
              initialPosts={posts}
              initialCursor={nextCursor}
              currentUser={currentUser}
              initialLikedIds={likedIds}
              initialSavedIds={savedIds}
              initialError={feedError ?? false}
            />
          </div>

          {/* Sidebar */}
          <aside className="w-72 shrink-0 sticky top-6 hidden lg:block">
            <CommunitySidebar currentUser={currentUser} />
          </aside>
        </div>
      </div>
    </>
  );
}
