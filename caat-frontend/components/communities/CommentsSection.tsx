"use client";

import { useState, useEffect, useTransition } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/user-utils";
import { toast } from "sonner";
import { fetchCommentsAction, addCommentAction } from "@/app/(main)/communities/actions";
import { CommentItem } from "./CommentItem";
import type { CommunityComment, PostAuthor } from "@/types/community";

interface CommentsSectionProps {
  postId: string;
  currentUser: PostAuthor | null;
  onCountChange: (delta: number) => void;
}

export function CommentsSection({ postId, currentUser, onCountChange }: CommentsSectionProps) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetchCommentsAction(postId).then(({ comments: fetched }) => {
      if (!cancelled) {
        setComments(fetched);
        setIsLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [postId]);

  function handleReplyAdded(parentId: string, reply: CommunityComment) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...c.replies, reply] } : c
      )
    );
    onCountChange(1);
  }

  function submitComment() {
    if (!newComment.trim()) return;
    startTransition(async () => {
      const { comment, error } = await addCommentAction(postId, newComment);
      if (error || !comment) {
        toast.error(error ?? "Failed to post comment.");
        return;
      }
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      onCountChange(1);
    });
  }

  const authorName = currentUser
    ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") || "You"
    : "You";

  return (
    <div className="space-y-3 pt-1">
      {/* Comment list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2.5">
              <Skeleton className="size-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-14 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No comments yet. Be the first.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onReplyAdded={handleReplyAdded}
            />
          ))}
        </div>
      )}

      {/* Add comment */}
      <div className="flex gap-2.5 pt-1">
        <Avatar className="size-7 shrink-0 mt-1">
          <AvatarImage src={currentUser?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {getInitials(authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 flex gap-2">
          <Textarea
            placeholder="Write a comment… (⌘↵ to send)"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[60px] resize-none text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
            }}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 self-end"
            onClick={submitComment}
            disabled={isPending || !newComment.trim()}
          >
            <Send className="size-4" />
            <span className="sr-only">Post comment</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
