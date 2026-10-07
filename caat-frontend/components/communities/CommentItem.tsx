"use client";

import { useOptimistic, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getInitials } from "@/lib/user-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  addCommentAction,
  toggleCommentLikeAction,
  updateCommentAction,
  deleteCommentAction,
} from "@/app/(main)/communities/actions";
import type { CommunityComment, PostAuthor } from "@/types/community";

interface CommentItemProps {
  comment: CommunityComment;
  currentUser: PostAuthor | null;
  isReply?: boolean;
  onReplyAdded: (parentId: string, reply: CommunityComment) => void;
  onEdited: (id: string, content: string, editedAt: string) => void;
  onDeleted: (id: string, mode: "soft" | "hard") => void;
}

export function CommentItem({ comment, currentUser, isReply = false, onReplyAdded, onEdited, onDeleted }: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Comment props are not refreshed after a like, so keep what the server
  // confirmed; a pending click sets a target, so re-applying it is a no-op.
  const [likeConfirmed, setLikeConfirmed] = useState({ isLiked: comment.is_liked_by_user, count: comment.likes_count });
  const [likeOptimistic, setLikeOptimistic] = useOptimistic(
    likeConfirmed,
    (state, liked: boolean) => (state.isLiked === liked ? state : { isLiked: liked, count: Math.max(0, state.count + (liked ? 1 : -1)) })
  );

  const isOwn = !!currentUser && currentUser.id === comment.user_id;
  const isDeleted = !!comment.is_deleted;
  const authorName = comment.author
    ? [comment.author.first_name, comment.author.last_name].filter(Boolean).join(" ") || "Anonymous"
    : "Anonymous";

  function handleLike() {
    if (!currentUser) { toast.error("Sign in to like comments"); return; }
    const target = !likeOptimistic.isLiked;
    startTransition(async () => {
      setLikeOptimistic(target);
      const { liked, error } = await toggleCommentLikeAction(comment.id);
      if (error) { toast.error("Could not update like."); return; }
      startTransition(() => setLikeConfirmed((c) => (c.isLiked === liked ? c : {
        isLiked: liked, count: Math.max(0, c.count + (liked ? 1 : -1)),
      })));
    });
  }

  function submitReply() {
    if (isPending || !replyText.trim()) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof addCommentAction>>;
      try {
        result = await addCommentAction(
          comment.post_id,
          replyText,
          comment.id
        );
      } catch {
        toast.error("Could not post reply. Please try again.");
        return;
      }
      if (result.error || !result.comment) {
        toast.error(result.error ?? "Failed to post reply.");
        return;
      }
      setReplyText("");
      setIsReplying(false);
      onReplyAdded(comment.id, result.comment);
    });
  }

  function submitEdit() {
    const text = editText.trim();
    if (isPending || !text) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof updateCommentAction>>;
      try {
        result = await updateCommentAction(comment.id, text);
      } catch {
        toast.error("Could not update comment. Please try again.");
        return;
      }
      if (result.error || !result.edited_at) {
        toast.error(result.error ?? "Could not edit comment.");
        return;
      }
      setIsEditing(false);
      onEdited(comment.id, text, result.edited_at);
    });
  }

  function confirmDelete() {
    if (isPending) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof deleteCommentAction>>;
      try {
        result = await deleteCommentAction(comment.id);
      } catch {
        toast.error("Could not delete comment. Please try again.");
        return;
      }
      if (result.error || !result.mode) {
        toast.error(result.error ?? "Could not delete comment.");
        return;
      }
      setConfirmingDelete(false);
      onDeleted(comment.id, result.mode);
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
              {comment.edited_at && !isDeleted && (
                <span className="text-[10px] text-muted-foreground">· edited</span>
              )}
            </div>

            {isDeleted ? (
              <p className="text-sm italic text-muted-foreground">[deleted]</p>
            ) : isEditing ? (
              <div className="space-y-1.5">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitEdit(); }}
                />
                <div className="flex gap-1.5 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIsEditing(false); setEditText(comment.content); }} disabled={isPending}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={submitEdit} disabled={isPending || !editText.trim()}>{isPending ? "Saving…" : "Save"}</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
            )}
          </div>

          {!isDeleted && !isEditing && (
            <div className="flex items-center gap-1 mt-1 ml-1">
              <button
                className={cn(
                  "flex items-center gap-1 text-[11px] transition-colors",
                  likeOptimistic.isLiked ? "text-[#9a1a27] dark:text-[#e06b78] hover:text-[#9a1a27]" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={handleLike}
              >
                <Heart className={cn("size-3", likeOptimistic.isLiked && "fill-current")} />
                {likeOptimistic.count > 0 && <span>{likeOptimistic.count}</span>}
              </button>

              {!isReply && (
                <button className="text-[11px] text-muted-foreground hover:text-foreground ml-2 transition-colors" onClick={() => setIsReplying((v) => !v)}>
                  Reply
                </button>
              )}

              {isOwn && (
                <>
                  <button className="text-[11px] text-muted-foreground hover:text-foreground ml-2 transition-colors" onClick={() => { setIsEditing(true); setEditText(comment.content); }}>
                    Edit
                  </button>
                  {confirmingDelete ? (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      Delete?
                      <button className="ml-1 text-[#9a1a27] dark:text-[#e06b78] hover:underline" onClick={confirmDelete} disabled={isPending}>Yes</button>
                      <button className="ml-1 hover:underline" onClick={() => setConfirmingDelete(false)} disabled={isPending}>No</button>
                    </span>
                  ) : (
                    <button className="text-[11px] text-muted-foreground hover:text-[#9a1a27] ml-2 transition-colors" onClick={() => setConfirmingDelete(true)}>
                      Delete
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Inline reply form */}
          {isReplying && (
            <div className="mt-2 flex gap-2">
              <Avatar className="size-6 shrink-0 mt-1">
                <AvatarImage src={currentUser?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[9px] bg-zinc-100 dark:bg-zinc-800">
                  {getInitials(currentUser ? [currentUser.first_name, currentUser.last_name].filter(Boolean).join(" ") || "You" : "You")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <Textarea
                  placeholder="Write a reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitReply(); }}
                />
                <div className="flex gap-1.5 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIsReplying(false); setReplyText(""); }} disabled={isPending}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={submitReply} disabled={isPending || !replyText.trim()}>{isPending ? "Posting…" : "Reply"}</Button>
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
                  onEdited={onEdited}
                  onDeleted={onDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
