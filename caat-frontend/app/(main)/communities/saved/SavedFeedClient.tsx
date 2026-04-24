"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { PostCard } from "@/components/communities/PostCard";
import type { CommunityPost, PostAuthor } from "@/types/community";

interface SavedFeedClientProps {
  initialPosts: CommunityPost[];
  currentUser: PostAuthor | null;
  initialLikedIds: Set<string>;
  initialSavedIds: Set<string>;
}

export function SavedFeedClient({ initialPosts, currentUser, initialLikedIds, initialSavedIds }: SavedFeedClientProps) {
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);

  function handleUnsaved(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Bookmark className="size-8 mb-3 opacity-40" />
        <p className="text-lg font-medium">No saved posts</p>
        <p className="text-sm mt-1">
          Bookmark posts from the{" "}
          <Link href="/communities" className="underline">feed</Link> to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          initialIsLiked={initialLikedIds.has(post.id)}
          initialIsSaved={initialSavedIds.has(post.id)}
          onPostUnsaved={handleUnsaved}
          onPostDeleted={handleUnsaved}
        />
      ))}
    </div>
  );
}
