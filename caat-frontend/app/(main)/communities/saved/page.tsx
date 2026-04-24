import { Bookmark } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/communities/NotificationBell";
import { createSupabaseServer } from "@/lib/supabase-server";
import { fetchSavedPostsAction } from "@/app/(main)/communities/actions";
import { SavedFeedClient } from "./SavedFeedClient";
import type { PostAuthor } from "@/types/community";

export default async function SavedPostsPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { posts } = await fetchSavedPostsAction();

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

  const likedIds = new Set((likedResult.data ?? []).map((r: { post_id: string }) => r.post_id));
  const savedIds = new Set((savedResult.data ?? []).map((r: { post_id: string }) => r.post_id));
  const currentUser = (profileResult.data as PostAuthor | null) ?? null;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/communities">Communities</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink>Saved Posts</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NotificationBell />
      </header>

      <div className="p-6">
        <main className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bookmark className="size-4" />
            <h1 className="text-base font-semibold">Saved Posts</h1>
            <span className="text-sm text-muted-foreground">({posts.length})</span>
          </div>

          <SavedFeedClient
            initialPosts={posts}
            currentUser={currentUser}
            initialLikedIds={likedIds}
            initialSavedIds={savedIds}
          />
        </main>
      </div>
    </>
  );
}
