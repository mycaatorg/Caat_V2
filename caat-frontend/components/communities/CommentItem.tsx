"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/user-utils";
import { toast } from "sonner";
import { addCommentAction } from "@/app/(main)/communities/actions";
import type { CommunityComment, PostAuthor } from "@/types/community";

interface CommentItemProps {
  comment: CommunityComment;
  currentUser: PostAuthor | null;
  isReply?: boolean;
  onReplyAdded: (parentId: string, reply: CommunityComment) => void;
}

export function CommentItem({ comment, currentUser, isReply = false, onReplyAdded }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isPending, startTransition] = useTransition();

  const authorName = comment.author
    ? [comment.author.first_name, comment.author.last_name].filter(Boolean).join(" ") || "Anonymous"
    : "Anonymous";

  function submitReply() {
    if (!replyText.trim()) return;
    startTransition(async () => {
      const { comment: newReply, error } = await addCommentAction(
        comment.post_id,
        replyText,
        comment.id
      );
      if (error || !newReply) {
        toast.error(error ?? "Failed to post reply.");
        return;
      }
      onReplyAdded(comment.id, newReply);
      setReplyText("");
      setIsReplying(false);
    });
  }

  return (
    <div className={isReply ? "ml-9 mt-2" : ""}>
      <div className="flex gap-2.5">
        <Avatar className="size-7 shrink-0 mt-0.5">
          <AvatarImage src={comment.author?.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {getInitials(authorName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-xs font-medium">{authorName}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
          </div>

          {!isReply && (
            <button
              className="text-[11px] text-muted-foreground hover:text-foreground mt-1 ml-1 transition-colors"
              onClick={() => setIsReplying((v) => !v)}
            >
              Reply
            </button>
          )}

          {/* Inline reply form */}
          {isReplying && (
            <div className="mt-2 flex gap-2">
              <Avatar className="size-6 shrink-0 mt-1">
                <AvatarImage src={currentUser?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px] bg-zinc-100 dark:bg-zinc-800">
                  {getInitials(
                    currentUser
                      ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") || "You"
                      : "You"
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <Textarea
                  placeholder="Write a reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitReply();
                  }}
                />
                <div className="flex gap-1.5 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setIsReplying(false); setReplyText(""); }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={submitReply}
                    disabled={isPending || !replyText.trim()}
                  >
                    {isPending ? "Posting…" : "Reply"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Nested replies */}
          {comment.replies.length > 0 && (
            <div className="mt-2 space-y-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUser={currentUser}
                  isReply
                  onReplyAdded={onReplyAdded}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
