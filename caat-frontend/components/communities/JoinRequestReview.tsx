"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/user-utils";
import { approveJoinRequestAction, rejectJoinRequestAction } from "@/app/(main)/communities/actions";
import type { JoinRequestQueueGroup } from "@/app/(main)/communities/actions/groups";

interface JoinRequestReviewProps {
  groups: JoinRequestQueueGroup[];
}

function requesterName(request: JoinRequestQueueGroup["requests"][number]) {
  return [request.user?.first_name, request.user?.last_name].filter(Boolean).join(" ") || "Someone";
}

export function JoinRequestReview({ groups: initialGroups }: JoinRequestReviewProps) {
  const [groups, setGroups] = useState(initialGroups);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The row leaves the queue only after the server confirms the decision.
  function decide(groupId: string, userId: string, decision: "approve" | "decline") {
    const key = `${groupId}:${userId}`;
    setBusyKey(key);
    startTransition(async () => {
      const { error } = decision === "approve"
        ? await approveJoinRequestAction(groupId, userId)
        : await rejectJoinRequestAction(groupId, userId);
      setBusyKey(null);
      if (error) { toast.error(error); return; }
      toast.success(decision === "approve" ? "Request approved." : "Request declined.");
      setGroups((current) => current
        .map((group) => group.id === groupId
          ? { ...group, requests: group.requests.filter((request) => request.user_id !== userId) }
          : group)
        .filter((group) => group.requests.length > 0));
    });
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <DoorOpen className="size-8 mb-3 opacity-40" />
        <p className="text-base font-medium">No pending join requests.</p>
        <p className="text-sm mt-1 text-center">When someone asks to join one of your private communities, they will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.id} aria-label={group.name} className="space-y-2">
          <h2 className="text-sm font-semibold">
            <Link href={`/communities/c/${group.slug}`} className="hover:underline">{group.name}</Link>
          </h2>
          <ul className="rounded-xl border divide-y">
            {group.requests.map((request) => {
              const name = requesterName(request);
              const busy = busyKey === `${group.id}:${request.user_id}`;
              return (
                <li key={request.user_id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={request.user?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {getInitials(name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Asked {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="ghost" disabled={busy}
                      onClick={() => decide(group.id, request.user_id, "decline")}>
                      Decline
                    </Button>
                    <Button size="sm" disabled={busy}
                      onClick={() => decide(group.id, request.user_id, "approve")}>
                      Approve
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
