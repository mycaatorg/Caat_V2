"use client";

import { useOptimistic, useTransition, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Bookmark, Share2, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getInitials } from "@/lib/user-utils";
import { cn } from "@/lib/utils";
import { toggleLikeAction, toggleSaveAction } from "@/app/(main)/communities/actions";
import { CommentsSection } from "./CommentsSection";
import type { CommunityPost, TopicTag, PostAuthor } from "@/types/community";
import { TOPIC_LABELS } from "@/types/community";

const TOPIC_STYLES: Record<TopicTag, string> = {
  APPLICATION_RESULTS: "border-green-500 text-green-700 dark:text-green-400",
  ESSAYS:              "border-blue-500 text-blue-700 dark:text-blue-400",
  TEST_SCORES:         "border-purple-500 text-purple-700 dark:text-purple-400",
  EXTRACURRICULARS:    "border-orange-500 text-orange-700 dark:text-orange-400",
  ADVICE:              "border-amber-500 text-amber-700 dark:text-amber-400",
  SCHOLARSHIPS:        "border-teal-500 text-teal-700 dark:text-teal-400",
};

const OUTCOME_CONFIG = {
  accepted:   { label: "Accepted",   icon: CheckCircle, color: "text-green-600 dark:text-green-400" },
  waitlisted: { label: "Waitlisted", icon: Clock,        color: "text-amber-600 dark:text-amber-400" },
  rejected:   { label: "Rejected",   icon: XCircle,      color: "text-red-600 dark:text-red-400" },
};

interface PostCardProps {
  post: CommunityPost;
  currentUser: PostAuthor | null;
  initialIsLiked: boolean;
  initialIsSaved: boolean;
}

export function PostCard({ post, currentUser, initialIsLiked, initialIsSaved }: PostCardProps) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments_count);
  const [, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic(
    { isLiked: initialIsLiked, likeCount: post.likes_count, isSaved: initialIsSaved },
    (state, action: "like" | "save") => {
      if (action === "like") {
        return {
          ...state,
          isLiked: !state.isLiked,
          likeCount: state.isLiked ? state.likeCount - 1 : state.likeCount + 1,
        };
      }
      return { ...state, isSaved: !state.isSaved };
    }
  );

  const authorName = post.author
    ? [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") || "Anonymous"
    : "Anonymous";

  const timestamp = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });

  function handleLike() {
    startTransition(async () => {
      setOptimistic("like");
      const { error } = await toggleLikeAction(post.id);
      if (error) toast.error("Could not update like.");
    });
  }

  function handleSave() {
    startTransition(async () => {
      setOptimistic("save");
      const { error } = await toggleSaveAction(post.id);
      if (error) toast.error("Could not save post.");
    });
  }

  function handleShare() {
    const url = `${window.location.origin}/communities/${post.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied."));
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="size-9 shrink-0">
              <AvatarImage src={post.author?.avatar_url ?? undefined} alt={authorName} />
              <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {getInitials(authorName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none truncate">{authorName}</p>
              <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("shrink-0 text-[11px]", TOPIC_STYLES[post.topic_tag])}
          >
            {TOPIC_LABELS[post.topic_tag]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>

        {post.result_card && (() => {
          const cfg = OUTCOME_CONFIG[post.result_card.outcome];
          const Icon = cfg.icon;
          return (
            <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/40">
              <Icon className={cn("size-4 shrink-0", cfg.color)} />
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {post.result_card.university_name}
                  {post.result_card.program ? ` · ${post.result_card.program}` : ""}
                </p>
              </div>
            </div>
          );
        })()}

        {post.score_card && (
          <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
            <span className="text-xs font-medium text-muted-foreground">{post.score_card.exam}</span>
            <Separator orientation="vertical" className="h-3" />
            <span className="text-sm font-semibold">{post.score_card.score}</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex-col gap-0">
        <Separator className="mb-2 w-full" />

        {/* Action bar */}
        <div className="flex w-full items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 h-8 px-2",
              optimistic.isLiked
                ? "text-red-500 hover:text-red-600"
                : "text-muted-foreground"
            )}
            onClick={handleLike}
          >
            <Heart className={cn("size-4", optimistic.isLiked && "fill-current")} />
            <span className="text-xs">{optimistic.likeCount}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 h-8 px-2",
              isCommentsOpen ? "text-foreground" : "text-muted-foreground"
            )}
            onClick={() => setIsCommentsOpen((v) => !v)}
          >
            <MessageCircle className="size-4" />
            <span className="text-xs">{commentCount}</span>
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              optimistic.isSaved ? "text-foreground" : "text-muted-foreground"
            )}
            onClick={handleSave}
          >
            <Bookmark className={cn("size-4", optimistic.isSaved && "fill-current")} />
            <span className="sr-only">Save post</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 w-8 p-0"
            onClick={handleShare}
          >
            <Share2 className="size-4" />
            <span className="sr-only">Share post</span>
          </Button>
        </div>

        {/* Comments section */}
        {isCommentsOpen && (
          <>
            <Separator className="my-2 w-full" />
            <div className="w-full">
              <CommentsSection
                postId={post.id}
                currentUser={currentUser}
                onCountChange={(delta) => setCommentCount((n) => n + delta)}
              />
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
