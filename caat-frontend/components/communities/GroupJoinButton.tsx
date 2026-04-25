"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { joinGroupAction, leaveGroupAction } from "@/app/(main)/communities/actions";

interface GroupJoinButtonProps {
  groupId: string;
  initialIsMember: boolean;
  isOwner: boolean;
}

export function GroupJoinButton({ groupId, initialIsMember, isOwner }: GroupJoinButtonProps) {
  const [, startTransition] = useTransition();
  const [isMember, setIsMember] = useOptimistic(initialIsMember, (_, next: boolean) => next);

  if (isOwner) return null;

  function handleClick() {
    startTransition(async () => {
      setIsMember(!isMember);
      const { error } = isMember ? await leaveGroupAction(groupId) : await joinGroupAction(groupId);
      if (error) toast.error(error);
    });
  }

  return (
    <Button size="sm" variant={isMember ? "outline" : "default"} onClick={handleClick} className="min-w-[90px]">
      {isMember ? "Joined" : "Join"}
    </Button>
  );
}
