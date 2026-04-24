"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PostCard } from "@/components/communities/PostCard";
import { CreatePostForm } from "@/components/communities/CreatePostForm";
import { FeedTabs } from "@/components/communities/FeedTabs";
import type { FeedTab } from "@/components/communities/FeedTabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchPostsAction, fetchTrendingPostsAction, searchPostsAction, fetchRecommendedUsersAction,
} from "./actions";
import type { CommunityPost, PostAuthor, TopicTag } from "@/types/community";
import { TOPIC_LABELS } from "@/types/community";

interface CommunityFeedClientProps {
  initialPosts: CommunityPost[];
  initialCursor: string | null;
  currentUser: PostAuthor | null;
  initialLikedIds: string[];
  initialSavedIds: string[];
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

export function CommunityFeedClient({
  initialPosts,
  initialCursor,
  currentUser,
  initialLikedIds,
  initialSavedIds,
}: CommunityFeedClientProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>("all");
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [likedIds] = useState<Set<string>>(new Set(initialLikedIds));
  const [savedIds] = useState<Set<string>>(new Set(initialSavedIds));
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState<TopicTag | "all">("all");
  const [searchResults, setSearchResults] = useState<CommunityPost[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recommended users (for following empty state)
  const [recommendedUsers, setRecommendedUsers] = useState<PostAuthor[]>([]);

  const { ref, inView } = useInView({ threshold: 0.1 });

  const isSearchActive = searchQuery.trim().length > 0 || topicFilter !== "all";

  // Debounced search (fires on query or topic-only filter change)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const inactive = !searchQuery.trim() && topicFilter === "all";
    searchDebounceRef.current = setTimeout(async () => {
      if (inactive) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const { posts: results } = await searchPostsAction(
        searchQuery.trim() || "",
        topicFilter !== "all" ? topicFilter : undefined
      );
      setSearchResults(results);
      setIsSearching(false);
    }, inactive ? 0 : 350);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery, topicFilter]);

  // Infinite scroll
  useEffect(() => {
    if (!inView || !cursor || isPending || isSearchActive) return;
    startTransition(async () => {
      const { posts: newPosts, nextCursor } = await fetchPostsAction(cursor, activeTab === "following");
      setPosts((prev) => [...prev, ...newPosts]);
      setCursor(nextCursor);
    });
  }, [inView, cursor, isPending, activeTab, isSearchActive]);

  async function handleTabChange(tab: FeedTab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setIsTabLoading(true);
    setPosts([]);
    setCursor(null);
    if (tab === "trending") {
      const { posts: fresh } = await fetchTrendingPostsAction();
      setPosts(fresh);
      setCursor(null);
    } else {
      const { posts: fresh, nextCursor } = await fetchPostsAction(undefined, tab === "following");
      setPosts(fresh);
      setCursor(nextCursor);
      if (tab === "following" && fresh.length === 0) {
        fetchRecommendedUsersAction().then(({ users }) => setRecommendedUsers(users));
      }
    }
    setIsTabLoading(false);
  }

  function handleTopicClick(topic: TopicTag) {
    setTopicFilter(topic);
    setSearchQuery("");
  }

  function handlePostCreated(post: CommunityPost) {
    if (!isSearchActive && activeTab === "all") setPosts((prev) => [post, ...prev]);
  }

  function handlePostDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    if (searchResults) setSearchResults((prev) => prev?.filter((p) => p.id !== postId) ?? null);
  }

  function clearSearch() {
    setSearchQuery("");
    setTopicFilter("all");
    setSearchResults(null);
  }

  const displayPosts = isSearchActive ? (searchResults ?? []) : posts;
  const showEmpty = !isTabLoading && !isSearching && displayPosts.length === 0;

  return (
    <div className="space-y-4">
      <CreatePostForm currentUser={currentUser} onPostCreated={handlePostCreated} />

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search posts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {isSearchActive && (
            <button type="button" onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          )}
        </div>
        <Select value={topicFilter} onValueChange={(v) => setTopicFilter(v as TopicTag | "all")}>
          <SelectTrigger className="w-36 shrink-0">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All topics</SelectItem>
            {(Object.entries(TOPIC_LABELS) as [TopicTag, string][]).map(([tag, label]) => (
              <SelectItem key={tag} value={tag}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs — hidden during active search */}
      {!isSearchActive && (
        <FeedTabs activeTab={activeTab} onTabChange={handleTabChange} />
      )}

      {/* Search / filter header */}
      {isSearchActive && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {isSearching
              ? "Searching…"
              : searchQuery.trim()
                ? `${searchResults?.length ?? 0} result${searchResults?.length !== 1 ? "s" : ""} for "${searchQuery}"`
                : `${searchResults?.length ?? 0} post${searchResults?.length !== 1 ? "s" : ""} in ${topicFilter !== "all" ? topicFilter.replace(/_/g, " ").toLowerCase() : "all topics"}`
            }
          </p>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearSearch}>Clear</Button>
        </div>
      )}

      {/* Feed */}
      {isTabLoading || isSearching ? (
        <div className="space-y-4"><PostSkeleton /><PostSkeleton /></div>
      ) : showEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          {isSearchActive ? (
            <>
              <p className="text-lg font-medium">No posts found</p>
              <p className="text-sm mt-1">Try a different keyword or topic filter.</p>
            </>
          ) : activeTab === "following" ? (
            <div className="w-full max-w-sm">
              <p className="text-lg font-medium text-center">No posts from people you follow</p>
              <p className="text-sm mt-1 text-center mb-6">Follow active members to see their posts here.</p>
              {recommendedUsers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Suggested people to follow</p>
                  {recommendedUsers.map((u) => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "Anonymous";
                    return (
                      <a key={u.id} href={`/communities/profile/${u.id}`} className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors">
                        <div className="size-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-400 shrink-0">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{name}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === "trending" ? (
            <>
              <p className="text-lg font-medium">No trending posts yet</p>
              <p className="text-sm mt-1">Check back after some activity picks up.</p>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">No posts yet</p>
              <p className="text-sm mt-1">Be the first to share your experience.</p>
            </>
          )}
        </div>
      ) : (
        displayPosts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUser={currentUser}
            initialIsLiked={likedIds.has(post.id)}
            initialIsSaved={savedIds.has(post.id)}
            onPostDeleted={handlePostDeleted}
            onTopicClick={handleTopicClick}
          />
        ))
      )}

      {/* Infinite scroll trigger (not shown during search or trending) */}
      {cursor && !isTabLoading && !isSearchActive && activeTab !== "trending" && (
        <div ref={ref} className="space-y-4">
          {isPending && <><PostSkeleton /><PostSkeleton /></>}
        </div>
      )}

      {!cursor && displayPosts.length > 0 && !isTabLoading && !isSearchActive && (
        <p className="text-center text-xs text-muted-foreground py-6">You&apos;ve reached the end</p>
      )}
    </div>
  );
}
