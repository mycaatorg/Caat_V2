"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { followUserAction, unfollowUserAction } from "@/app/(main)/communities/actions";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
}

export function FollowButton({ targetUserId, initialIsFollowing }: FollowButtonProps) {
  const [, startTransition] = useTransition();
  const [isFollowing, setIsFollowing] = useOptimistic(
    initialIsFollowing,
    (_, next: boolean) => next
  );

  function handleClick() {
    startTransition(async () => {
      setIsFollowing(!isFollowing);
      const action = isFollowing ? unfollowUserAction : followUserAction;
      const { error } = await action(targetUserId);
      if (error) toast.error(error);
    });
  }

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      onClick={handleClick}
      className="min-w-[90px]"
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
