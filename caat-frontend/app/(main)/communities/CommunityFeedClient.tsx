"use client";

import { useState, useTransition } from "react";
import { useInView } from "react-intersection-observer";
import { useEffect } from "react";
import { PostCard } from "@/components/communities/PostCard";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPostsAction } from "./actions";
import type { CommunityPost } from "@/types/community";

interface CommunityFeedClientProps {
  initialPosts: CommunityPost[];
  initialCursor: string | null;
}

function PostSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  );
}

export function CommunityFeedClient({ initialPosts, initialCursor }: CommunityFeedClientProps) {
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isPending, startTransition] = useTransition();

  const { ref, inView } = useInView({ threshold: 0.1 });

  useEffect(() => {
    if (!inView || !cursor || isPending) return;

    startTransition(async () => {
      const { posts: newPosts, nextCursor } = await fetchPostsAction(cursor);
      setPosts((prev) => [...prev, ...newPosts]);
      setCursor(nextCursor);
    });
  }, [inView, cursor, isPending]);

  if (posts.length === 0 && !isPending) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">No posts yet</p>
        <p className="text-sm mt-1">Be the first to share your experience.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Infinite scroll sentinel */}
      {cursor && (
        <div ref={ref} className="space-y-4">
          {isPending && (
            <>
              <PostSkeleton />
              <PostSkeleton />
            </>
          )}
        </div>
      )}

      {!cursor && posts.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-6">
          You&apos;ve reached the end
        </p>
      )}
    </div>
  );
}
