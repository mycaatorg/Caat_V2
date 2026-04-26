"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinGroupAction, leaveGroupAction, requestJoinGroupAction } from "@/app/(main)/communities/actions";

interface GroupJoinButtonProps {
  groupId: string;
  initialIsMember: boolean;
  isOwner: boolean;
  isPrivate?: boolean;
  initialHasRequested?: boolean;
}

export function GroupJoinButton({
  groupId,
  initialIsMember,
  isOwner,
  isPrivate = false,
  initialHasRequested = false,
}: GroupJoinButtonProps) {
  const [isMember, setIsMember] = useState(initialIsMember);
  const [hasRequested, setHasRequested] = useState(initialHasRequested);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isOwner) return null;

  // Already a member — show leave button
  if (isMember) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            setIsMember(false);
            const { error } = await leaveGroupAction(groupId);
            if (error) { toast.error(error); setIsMember(true); }
          });
        }}
        className="min-w-[90px]"
      >
        Joined
      </Button>
    );
  }

  // Private + already requested
  if (isPrivate && hasRequested) {
    return (
      <Button size="sm" variant="outline" disabled className="min-w-[90px] text-muted-foreground">
        Requested
      </Button>
    );
  }

  // Confirmation mode (public) or direct request mode (private)
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-1">
          {isPrivate ? "Send request?" : "Join?"}
        </span>
        <Button
          size="icon"
          variant="default"
          className="size-7"
          disabled={isPending}
          onClick={() => {
            setConfirming(false);
            startTransition(async () => {
              if (isPrivate) {
                const { error } = await requestJoinGroupAction(groupId);
                if (error) { toast.error(error); return; }
                setHasRequested(true);
                toast.success("Join request sent to community owner");
              } else {
                setIsMember(true);
                const { error } = await joinGroupAction(groupId);
                if (error) { toast.error(error); setIsMember(false); }
              }
            });
          }}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setConfirming(false)}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="default"
      onClick={() => setConfirming(true)}
      className="min-w-[90px]"
    >
      {isPrivate ? "Request to Join" : "Join"}
    </Button>
  );
}
