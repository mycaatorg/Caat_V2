"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { usePropBackedState } from "@/lib/use-prop-backed-state";
import { Button } from "@/components/ui/button";
import {
  followUserAction,
  unfollowUserAction,
} from "@/app/(main)/communities/actions";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
}

export function FollowButton({
  targetUserId,
  initialIsFollowing,
}: FollowButtonProps) {
  const [, startTransition] = useTransition();
  // Some callers never refresh initialIsFollowing (the sidebar suggestions),
  // so keep what the server confirmed and show a pending click on top of it.
  const [confirmed, setConfirmed] = usePropBackedState(initialIsFollowing);
  const [isFollowing, setIsFollowing] = useOptimistic(
    confirmed,
    (_, next: boolean) => next,
  );

  function handleClick() {
    const target = !isFollowing;
    startTransition(async () => {
      setIsFollowing(target);
      const action = target ? followUserAction : unfollowUserAction;
      const { error } = await action(targetUserId);
      if (error) { toast.error(error); return; }
      startTransition(() => setConfirmed(target));
    });
  }

  // Use the iconic CAAT red (#9a1a27). The "Follow" state is solid red with
  // white text; the "Following" state is an outlined red ghost so it reads
  // as a toggleable, secondary state.
  const baseClasses = "min-w-[90px] transition-colors";
  const followClasses =
    "bg-[#9a1a27] text-white border border-[#9a1a27] dark:border-[#e06b78] hover:bg-background hover:text-[#9a1a27] dark:hover:text-[#e06b78]";
  const followingClasses =
    "bg-background text-[#9a1a27] dark:text-[#e06b78] border border-[#9a1a27] dark:border-[#e06b78] hover:bg-[#9a1a27] hover:text-white dark:hover:text-white";

  return (
    <Button
      size="sm"
      variant={isFollowing ? "outline" : "default"}
      onClick={handleClick}
      className={`${baseClasses} ${isFollowing ? followingClasses : followClasses}`}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}
