"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/user-utils";
import { fetchFollowersAction, fetchFollowingAction } from "@/app/(main)/communities/actions";
import type { PostAuthor } from "@/types/community";

interface FollowersSheetProps {
  userId: string;
  count: number;
  type: "followers" | "following";
  children: React.ReactNode;
}

export function FollowersSheet({ userId, count, type, children }: FollowersSheetProps) {
  const [users, setUsers] = useState<PostAuthor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  function handleOpenChange(open: boolean) {
    if (!open || users.length > 0) return;
    setIsLoading(true);
    startTransition(async () => {
      const { users: fetched } = type === "followers"
        ? await fetchFollowersAction(userId)
        : await fetchFollowingAction(userId);
      setUsers(fetched);
      setIsLoading(false);
    });
  }

  return (
    <Sheet onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96 p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-base">
            {type === "followers" ? "Followers" : "Following"} ({count})
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto h-full pb-10">
          {isLoading ? (
            <div className="space-y-0 p-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <Skeleton className="size-9 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No {type} yet
            </div>
          ) : (
            <div className="divide-y">
              {users.map((u) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "Anonymous";
                return (
                  <Link
                    key={u.id}
                    href={`/communities/profile/${u.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={u.avatar_url ?? undefined} alt={name} />
                      <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {getInitials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
