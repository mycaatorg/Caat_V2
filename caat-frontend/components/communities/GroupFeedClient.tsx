"use client";

import { useState, useTransition, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import { PostCard } from "./PostCard";
import { CreatePostForm } from "./CreatePostForm";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchGroupPostsAction } from "@/app/(main)/communities/actions";
import type { CommunityPost, PostAuthor } from "@/types/community";

function PostSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-16" /></div>
      </div>
      <Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-4/5" />
    </div>
  );
}

interface GroupFeedClientProps {
  groupId: string;
  initialPosts: CommunityPost[];
  initialCursor: string | null;
  currentUser: PostAuthor | null;
  initialLikedIds: string[];
  initialSavedIds: string[];
  isMember: boolean;
}

export function GroupFeedClient({
  groupId, initialPosts, initialCursor, currentUser, initialLikedIds, initialSavedIds, isMember,
}: GroupFeedClientProps) {
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [likedIds] = useState(new Set(initialLikedIds));
  const [savedIds] = useState(new Set(initialSavedIds));
  const [isPending, startTransition] = useTransition();
  const { ref, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (!inView || !cursor || isPending) return;
    startTransition(async () => {
      const { posts: newPosts, nextCursor } = await fetchGroupPostsAction(groupId, cursor);
      setPosts((prev) => [...prev, ...newPosts]);
      setCursor(nextCursor);
    });
  }, [inView, cursor, isPending, groupId]);

  function handlePostCreated(post: CommunityPost) {
    setPosts((prev) => [post, ...prev]);
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  return (
    <div className="space-y-4">
      {isMember && (
        <CreatePostForm currentUser={currentUser} onPostCreated={handlePostCreated} groupId={groupId} />
      )}

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-base font-medium">No posts yet</p>
          {isMember && <p className="text-sm mt-1">Be the first to share something in this community.</p>}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
            initialIsLiked={likedIds.has(post.id)}
            initialIsSaved={savedIds.has(post.id)}
            onPostDeleted={handlePostDeleted}
          />
        ))
      )}

      {cursor && (
        <div ref={ref} className="space-y-4">
          {isPending && <><PostSkeleton /><PostSkeleton /></>}
        </div>
      )}

      {!cursor && posts.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-6">You&apos;ve reached the end</p>
      )}
    </div>
  );
}
