import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, GraduationCap, BookOpen, Pin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/communities/NotificationBell";
import { PostCard } from "@/components/communities/PostCard";
import { FollowButton } from "@/components/communities/FollowButton";
import { PrivacySettingsPanel } from "@/components/communities/PrivacySettingsPanel";
import { FollowersSheet } from "@/components/communities/FollowersSheet";
import { createSupabaseServer } from "@/lib/supabase-server";
import { getInitials } from "@/lib/user-utils";
import { fetchCommunityProfileAction } from "@/app/(main)/communities/actions";
import type { CommunityPost, PostAuthor } from "@/types/community";

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function CommunityProfilePage({ params }: Props) {
  const { userId } = await params;
  const { profile, error } = await fetchCommunityProfileAction(userId);

  if (error || !profile) notFound();

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch this user's posts
  const { data: rows } = await supabase
    .from("community_posts")
    .select("*, likes:community_likes(count), comments:community_comments(count)")
    .eq("is_hidden", false)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const author: PostAuthor = {
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
  };

  // Fetch liked/saved status for current user on these posts
  const postIds = (rows ?? []).map((r) => r.id);
  const [likedResult, savedResult] = await Promise.all([
    user && postIds.length
      ? supabase.from("community_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
    user && postIds.length
      ? supabase.from("community_saves").select("post_id").eq("user_id", user.id).in("post_id", postIds)
      : Promise.resolve({ data: [] }),
  ]);

  const likedIds = new Set((likedResult.data ?? []).map((r: { post_id: string }) => r.post_id));
  const savedIds = new Set((savedResult.data ?? []).map((r: { post_id: string }) => r.post_id));

  const currentUserProfile: PostAuthor | null = user
    ? { id: user.id, first_name: null, last_name: null, avatar_url: null }
    : null;

  // Fetch pinned post ID
  const { data: profileSettings } = await supabase
    .from("community_profile_settings")
    .select("pinned_post_id")
    .eq("user_id", userId)
    .maybeSingle();
  const pinnedPostId = (profileSettings?.pinned_post_id as string | null) ?? null;

  const resumeIds = (rows ?? []).map((r) => r.resume_link).filter((id): id is string => !!id);
  const { data: resumeRows } = resumeIds.length
    ? await supabase.from("resumes").select("id, title").in("id", resumeIds)
    : { data: [] };
  const resumeTitleMap = new Map<string, string>(
    ((resumeRows ?? []) as { id: string; title: string }[]).map((r) => [r.id, r.title])
  );

  const posts: CommunityPost[] = (rows ?? []).map((row) => ({
    ...row,
    resume_id: (row.resume_link as string | null) ?? null,
    resume_title: row.resume_link ? (resumeTitleMap.get(row.resume_link) ?? null) : null,
    likes_count: (row.likes as { count: number }[])[0]?.count ?? 0,
    comments_count: (row.comments as { count: number }[])[0]?.count ?? 0,
    author,
  }));

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Anonymous";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/communities">Community Campus</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink>{displayName}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NotificationBell />
      </header>
      <div className="p-6">
        <main className="max-w-2xl mx-auto space-y-6">

          {/* Profile header */}
          <div className="rounded-xl border p-6 space-y-4">
            <div className="flex items-start gap-4">
              <Avatar className="size-16 shrink-0">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
                <AvatarFallback className="text-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0 space-y-1">
                <h1 className="text-lg font-semibold leading-tight">{displayName}</h1>

                {profile.school_name && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <GraduationCap className="size-3.5 shrink-0" />
                    {profile.school_name}
                    {profile.graduation_year ? ` · Class of ${profile.graduation_year}` : ""}
                  </p>
                )}

                {!profile.school_name && profile.graduation_year && (
                  <p className="text-sm text-muted-foreground">
                    Class of {profile.graduation_year}
                  </p>
                )}

                {profile.preferred_countries.length > 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    {profile.preferred_countries.slice(0, 3).join(", ")}
                    {profile.preferred_countries.length > 3 ? ` +${profile.preferred_countries.length - 3}` : ""}
                  </p>
                )}

                {profile.target_majors.length > 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="size-3.5 shrink-0" />
                    {profile.target_majors.slice(0, 3).join(", ")}
                    {profile.target_majors.length > 3 ? ` +${profile.target_majors.length - 3}` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="font-semibold">{posts.length}</p>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
              <FollowersSheet userId={profile.id} count={profile.follower_count} type="followers">
                <button className="text-center hover:opacity-70 transition-opacity">
                  <p className="font-semibold">{profile.follower_count}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </button>
              </FollowersSheet>
              <FollowersSheet userId={profile.id} count={profile.following_count} type="following">
                <button className="text-center hover:opacity-70 transition-opacity">
                  <p className="font-semibold">{profile.following_count}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </button>
              </FollowersSheet>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-2">
              {profile.is_own_profile ? (
                <PrivacySettingsPanel initialSettings={profile.privacy} />
              ) : (
                <>
                  <FollowButton
                    targetUserId={profile.id}
                    initialIsFollowing={profile.is_following}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/communities">Back to Feed</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Posts */}
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-base font-medium">No posts yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pinned post first */}
              {pinnedPostId && (() => {
                const pinned = posts.find((p) => p.id === pinnedPostId);
                if (!pinned) return null;
                return (
                  <div key="pinned">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                      <Pin className="size-3" />
                      <span>Pinned post</span>
                    </div>
                    <PostCard
                      post={pinned}
                      currentUser={currentUserProfile}
                      initialIsLiked={likedIds.has(pinned.id)}
                      initialIsSaved={savedIds.has(pinned.id)}
                      isPinned
                    />
                  </div>
                );
              })()}
              {posts
                .filter((p) => p.id !== pinnedPostId)
                .map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUserProfile}
                    initialIsLiked={likedIds.has(post.id)}
                    initialIsSaved={savedIds.has(post.id)}
                  />
                ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
