import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Users, Lock, Globe, CalendarDays, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/communities/NotificationBell";
import { Button } from "@/components/ui/button";
import { GroupJoinButton } from "@/components/communities/GroupJoinButton";
import { GroupFeedClient } from "@/components/communities/GroupFeedClient";
import { createSupabaseServer } from "@/lib/supabase-server";
import {
  fetchGroupAction, fetchGroupPostsAction, fetchMyGroupsAction,
} from "@/app/(main)/communities/actions";
import type { PostAuthor } from "@/types/community";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function GroupPage({ params }: Props) {
  const { slug } = await params;
  const { group, error } = await fetchGroupAction(slug);
  if (error || !group) notFound();

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Private group: non-members see request-to-join screen
  if (group.is_private && !group.is_member) {
    return (
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb className="flex-1">
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/communities">Communities</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem><BreadcrumbLink>c/{group.slug}</BreadcrumbLink></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <NotificationBell />
        </header>
        <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
          <div className="size-14 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-base font-bold text-zinc-600 dark:text-zinc-300">
            {group.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-foreground">{group.name}</p>
            <p className="text-sm font-mono text-muted-foreground">c/{group.slug}</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Lock className="size-3.5" />
            <span>This is a private community</span>
          </div>
          {group.description && (
            <p className="text-sm text-muted-foreground max-w-xs text-center">{group.description}</p>
          )}
          <GroupJoinButton
            groupId={group.id}
            initialIsMember={false}
            isOwner={false}
            isPrivate={true}
            initialHasRequested={group.has_requested}
          />
          <Link href="/communities/groups" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="size-3" /> Browse communities
          </Link>
        </div>
      </>
    );
  }

  const { posts, nextCursor } = await fetchGroupPostsAction(group.id);
  const postIds = posts.map((p) => p.id);

  const [likedResult, savedResult, profileResult, myGroupsResult] = await Promise.all([
    user && postIds.length
      ? supabase.from("community_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    user && postIds.length
      ? supabase.from("community_saves").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("profiles").select("id, first_name, last_name, avatar_url").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    fetchMyGroupsAction(),
  ]);

  const likedIds = (likedResult.data ?? []).map((r: { post_id: string }) => r.post_id);
  const savedIds = (savedResult.data ?? []).map((r: { post_id: string }) => r.post_id);
  const currentUser = (profileResult.data as PostAuthor | null) ?? null;
  const myGroups = myGroupsResult.groups;

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
              <BreadcrumbLink>c/{group.slug}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NotificationBell />
      </header>

      <div className="p-6">
        <div className="max-w-5xl mx-auto flex gap-6 items-start">

          {/* Feed — same width as main communities page */}
          <main className="flex-1 min-w-0 space-y-4">

            {/* Sticky community context banner */}
            <div className="sticky top-0 z-10 -mx-1 px-1 pb-2 pt-0.5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/30 px-4 py-2.5">
                <div className="size-8 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                  {group.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">{group.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">c/{group.slug} · {group.member_count} member{group.member_count !== 1 ? "s" : ""}</p>
                </div>
                <Link
                  href="/communities"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 shrink-0"
                >
                  <ArrowLeft className="size-3" />
                  <span className="hidden sm:inline">Main feed</span>
                </Link>
              </div>
            </div>

            <GroupFeedClient
              groupId={group.id}
              initialPosts={posts}
              initialCursor={nextCursor}
              currentUser={currentUser}
              initialLikedIds={likedIds}
              initialSavedIds={savedIds}
              isMember={group.is_member}
            />
          </main>

          {/* Right sidebar */}
          <aside className="w-72 shrink-0 hidden lg:block sticky top-6 space-y-4">

            {/* About this community */}
            <div className="rounded-xl border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-base font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                  {group.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{group.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">c/{group.slug}</p>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{group.description}</p>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-semibold text-base">{group.member_count}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="size-3" /> Members</p>
                </div>
                <div>
                  <p className="font-semibold text-base">{group.post_count}</p>
                  <p className="text-xs text-muted-foreground">Posts</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {group.is_private ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
                <span>{group.is_private ? "Private community" : "Public community"}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" />
                <span>Created {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}</span>
              </div>

              <Separator />

              <GroupJoinButton
                groupId={group.id}
                initialIsMember={group.is_member}
                isOwner={group.is_owner}
                isPrivate={group.is_private}
                initialHasRequested={group.has_requested}
              />
            </div>

            {/* My Communities */}
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Communities</p>
              </div>
              <div className="space-y-1">
                {myGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No communities joined yet.</p>
                ) : (
                  myGroups.slice(0, 6).map((g) => (
                    <Link
                      key={g.id}
                      href={`/communities/c/${g.slug}`}
                      className={`flex items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors ${g.slug === slug ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                    >
                      <div className="size-6 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                        {g.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate text-xs">{g.name}</span>
                    </Link>
                  ))
                )}
                <Separator className="my-2" />
                <Link href="/communities/groups">
                  <Button size="sm" variant="outline" className="w-full gap-1.5">
                    <Globe className="size-3.5" />
                    Browse all communities
                  </Button>
                </Link>
              </div>
            </div>

          </aside>
        </div>
      </div>
    </>
  );
}
