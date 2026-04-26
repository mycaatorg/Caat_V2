"use client";

import { useOptimistic, useTransition, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import {
  Heart, MessageCircle, Bookmark, Share2, CheckCircle, Clock, XCircle,
  MoreHorizontal, Flag, Trash2, Pencil, BadgeCheck, School, ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/user-utils";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  toggleLikeAction, toggleSaveAction, reportPostAction, deletePostAction,
  updatePostAction, castPollVoteAction, blockUserAction, pinPostAction,
} from "@/app/(main)/communities/actions";
import { CommentsSection } from "./CommentsSection";
import { ResumeInlinePreview } from "./ResumeInlinePreview";
import type { CommunityPost, TopicTag, PostAuthor, PollOption } from "@/types/community";
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
  waitlisted: { label: "Waitlisted", icon: Clock,       color: "text-amber-600 dark:text-amber-400" },
  rejected:   { label: "Rejected",   icon: XCircle,     color: "text-red-600 dark:text-red-400" },
};

interface PostCardProps {
  post: CommunityPost;
  currentUser: PostAuthor | null;
  initialIsLiked: boolean;
  initialIsSaved: boolean;
  onPostDeleted?: (postId: string) => void;
  onPostUnsaved?: (postId: string) => void;
  onTopicClick?: (topic: TopicTag) => void;
  isPinned?: boolean;
}

export function PostCard({ post, currentUser, initialIsLiked, initialIsSaved, onPostDeleted, onPostUnsaved, onTopicClick, isPinned = false }: PostCardProps) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments_count);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [displayContent, setDisplayContent] = useState(post.content);
  const [displayEditedAt, setDisplayEditedAt] = useState(post.edited_at);
  const [, startTransition] = useTransition();

  // Like / save optimistic state
  const [optimistic, setOptimistic] = useOptimistic(
    { isLiked: initialIsLiked, likeCount: post.likes_count, isSaved: initialIsSaved },
    (state, action: "like" | "save") => {
      if (action === "like") return { ...state, isLiked: !state.isLiked, likeCount: state.isLiked ? state.likeCount - 1 : state.likeCount + 1 };
      return { ...state, isSaved: !state.isSaved };
    }
  );

  // Poll optimistic state
  const initialPollVotes = post.poll_votes ?? {};
  const [pollOptimistic, setPollOptimistic] = useOptimistic(
    { votes: initialPollVotes, userVote: post.user_vote ?? null },
    (state, newOptionId: string | null) => {
      const votes = { ...state.votes };
      if (state.userVote) votes[state.userVote] = Math.max(0, (votes[state.userVote] ?? 1) - 1);
      if (newOptionId) votes[newOptionId] = (votes[newOptionId] ?? 0) + 1;
      return { votes, userVote: newOptionId };
    }
  );

  const authorName = post.is_anonymous
    ? "Anonymous"
    : post.author
      ? [post.author.first_name, post.author.last_name].filter(Boolean).join(" ") || "Anonymous"
      : "Anonymous";

  const timestamp = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const isOwnPost = currentUser?.id === post.user_id;
  // Computed once at mount — edit window won't flip mid-session without a refresh
  const [canEdit] = useState(() => isOwnPost && (Date.now() - new Date(post.created_at).getTime()) < 24 * 3_600_000);

  function handleLike() {
    startTransition(async () => {
      setOptimistic("like");
      const { error } = await toggleLikeAction(post.id);
      if (error) toast.error("Could not update like.");
    });
  }

  function handleSave() {
    startTransition(async () => {
      const willSave = !optimistic.isSaved;
      setOptimistic("save");
      const { error } = await toggleSaveAction(post.id);
      if (error) { toast.error("Could not save post."); return; }
      if (willSave) {
        toast.success("Post saved");
      } else {
        toast("Post unsaved");
        onPostUnsaved?.(post.id);
      }
    });
  }

  function handleShare() {
    navigator.clipboard.writeText(`${window.location.origin}/communities/${post.id}`).then(() => toast.success("Link copied."));
  }

  function handleReport() {
    startTransition(async () => {
      const { error } = await reportPostAction(post.id);
      if (error) toast.error(error);
      else toast.success("Post reported.");
    });
  }

  function handleBlock() {
    startTransition(async () => {
      const { error } = await blockUserAction(post.user_id);
      if (error) toast.error(error);
      else { toast.success("User blocked."); onPostDeleted?.(post.id); }
    });
  }

  function handlePin() {
    startTransition(async () => {
      const { error } = await pinPostAction(isPinned ? null : post.id);
      if (error) toast.error(error);
      else toast.success(isPinned ? "Post unpinned." : "Post pinned to profile.");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const { error } = await deletePostAction(post.id);
      if (error) { toast.error(error); return; }
      toast.success("Post deleted.");
      onPostDeleted?.(post.id);
    });
  }

  function handleEditSave() {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === displayContent) { setIsEditing(false); return; }
    startTransition(async () => {
      const { error } = await updatePostAction(post.id, trimmed);
      if (error) { toast.error(error); return; }
      setDisplayContent(trimmed);
      setDisplayEditedAt(new Date().toISOString());
      setIsEditing(false);
      toast.success("Post updated.");
    });
  }

  function handlePollVote(optionId: string) {
    const newVote = pollOptimistic.userVote === optionId ? null : optionId;
    startTransition(async () => {
      setPollOptimistic(newVote);
      const { error } = await castPollVoteAction(post.id, newVote);
      if (error) toast.error("Could not register vote.");
    });
  }

  const totalPollVotes = Object.values(pollOptimistic.votes).reduce((a, b) => a + b, 0);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Author */}
          {post.is_anonymous ? (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">AN</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none text-muted-foreground">Anonymous</p>
                <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
              </div>
            </div>
          ) : (
            <Link href={`/communities/profile/${post.user_id}`} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
              <Avatar className="size-9 shrink-0">
                <AvatarImage src={post.author?.avatar_url ?? undefined} alt={authorName} />
                <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {getInitials(authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium leading-none truncate">{authorName}</p>
                  {post.author?.is_verified && (
                    <BadgeCheck className="size-3.5 text-blue-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {timestamp}
                  {displayEditedAt && <span className="ml-1">(edited)</span>}
                </p>
              </div>
            </Link>
          )}

          {/* Topic + kebab */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className={cn("text-[11px]", TOPIC_STYLES[post.topic_tag], onTopicClick && "cursor-pointer hover:opacity-80")}
              onClick={onTopicClick ? () => onTopicClick(post.topic_tag) : undefined}
            >
              {TOPIC_LABELS[post.topic_tag]}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground">
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOwnPost ? (
                  <>
                    {canEdit && (
                      <DropdownMenuItem className="gap-2" onClick={() => { setEditContent(displayContent); setIsEditing(true); }}>
                        <Pencil className="size-4" />
                        Edit post
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="gap-2" onClick={handlePin}>
                      <BadgeCheck className="size-4" />
                      {isPinned ? "Unpin from profile" : "Pin to profile"}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 focus:text-red-600 gap-2" onClick={handleDelete}>
                      <Trash2 className="size-4" />
                      Delete post
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem className="gap-2" onClick={handleReport}>
                      <Flag className="size-4" />
                      Report post
                    </DropdownMenuItem>
                    {!post.is_anonymous && (
                      <DropdownMenuItem className="text-red-600 focus:text-red-600 gap-2" onClick={handleBlock}>
                        <ShieldOff className="size-4" />
                        Block user
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3 space-y-3">
        {/* School tag */}
        {post.school_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <School className="size-3.5 shrink-0" />
            <span>{post.school_name}</span>
          </div>
        )}

        {/* Content or edit mode */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="resize-none min-h-[80px] text-sm"
              maxLength={2100}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleEditSave} disabled={!editContent.trim() || editContent.trim() === displayContent}>Save</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
        )}

        {/* Result card */}
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

        {/* Score card */}
        {post.score_card && (
          <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-purple-950/40 dark:to-purple-900/20 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-purple-500 dark:text-purple-400 mb-1">
              {post.score_card.exam} Score
            </p>
            <p className="text-5xl font-bold text-purple-700 dark:text-purple-300 leading-none">
              {post.score_card.score}
            </p>
          </div>
        )}

        {/* Poll */}
        {post.poll_options && post.poll_options.length > 0 && (
          <div className="space-y-2">
            {post.poll_options.map((option: PollOption) => {
              const votes = pollOptimistic.votes[option.id] ?? 0;
              const pct = totalPollVotes > 0 ? Math.round((votes / totalPollVotes) * 100) : 0;
              const isSelected = pollOptimistic.userVote === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handlePollVote(option.id)}
                  className={cn(
                    "relative w-full text-left rounded-md border px-3 py-2 text-sm overflow-hidden transition-colors",
                    isSelected ? "border-foreground" : "hover:border-muted-foreground"
                  )}
                >
                  <div
                    className={cn("absolute inset-y-0 left-0 rounded-md transition-all", isSelected ? "bg-foreground/10" : "bg-muted/60")}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative">{option.text}</span>
                  <span className="relative float-right text-xs text-muted-foreground">{pct}%</span>
                </button>
              );
            })}
            <p className="text-xs text-muted-foreground">{totalPollVotes} vote{totalPollVotes !== 1 ? "s" : ""}</p>
          </div>
        )}

        {/* Resume inline preview */}
        {post.resume_id && (
          <ResumeInlinePreview resumeId={post.resume_id} resumeTitle={post.resume_title} />
        )}
      </CardContent>

      <CardFooter className="pt-0 flex-col gap-0">
        <Separator className="mb-2 w-full" />
        <div className="flex w-full items-center gap-1">
          <Button
            variant="ghost" size="sm"
            className={cn("gap-1.5 h-8 px-2", optimistic.isLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground")}
            onClick={handleLike}
          >
            <Heart className={cn("size-4", optimistic.isLiked && "fill-current")} />
            <span className="text-xs">{optimistic.likeCount}</span>
          </Button>

          <Button
            variant="ghost" size="sm"
            className={cn("gap-1.5 h-8 px-2", isCommentsOpen ? "text-foreground" : "text-muted-foreground")}
            onClick={() => setIsCommentsOpen((v) => !v)}
          >
            <MessageCircle className="size-4" />
            <span className="text-xs">{commentCount}</span>
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost" size="sm"
            className={cn("h-8 w-8 p-0", optimistic.isSaved ? "text-foreground" : "text-muted-foreground")}
            onClick={handleSave}
          >
            <Bookmark className={cn("size-4", optimistic.isSaved && "fill-current")} />
            <span className="sr-only">Save post</span>
          </Button>

          <Button variant="ghost" size="sm" className="text-muted-foreground h-8 w-8 p-0" onClick={handleShare}>
            <Share2 className="size-4" />
            <span className="sr-only">Share post</span>
          </Button>
        </div>

        {isCommentsOpen && (
          <>
            <Separator className="my-2 w-full" />
            <div className="w-full">
              <CommentsSection postId={post.id} currentUser={currentUser} onCountChange={(delta) => setCommentCount((n) => n + delta)} />
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
