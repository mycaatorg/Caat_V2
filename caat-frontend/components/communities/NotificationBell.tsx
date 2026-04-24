"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import React from "react";
import { Bell, Heart, MessageCircle, CornerDownRight, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/user-utils";
import { supabase } from "@/src/lib/supabaseClient";
import { fetchNotificationsAction, markNotificationsReadAction } from "@/app/(main)/communities/actions";
import type { NotificationItem } from "@/types/community";

const TYPE_CONFIG: Record<NotificationItem["type"], { icon: React.ElementType; label: string }> = {
  like:    { icon: Heart,           label: "liked your post" },
  comment: { icon: MessageCircle,   label: "commented on your post" },
  reply:   { icon: CornerDownRight, label: "replied to your comment" },
  follow:  { icon: UserPlus,        label: "started following you" },
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  // Initial unread count fetch
  useEffect(() => {
    fetchNotificationsAction().then(({ unreadCount: count }) => {
      setUnreadCount(count);
    });
  }, []);

  // Realtime subscription for new notifications
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      channel = supabase
        .channel(`notifications-bell-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            setUnreadCount((n) => n + 1);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Fetch full list when dropdown opens, mark as read
  async function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (!open) return;

    setIsLoading(true);
    const { notifications: fetched } = await fetchNotificationsAction();
    setNotifications(fetched);
    setIsLoading(false);

    if (unreadCount > 0) {
      setUnreadCount(0);
      startTransition(async () => {
        await markNotificationsReadAction();
      });
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="px-3 py-2.5 flex items-center justify-between">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <Separator />

        <div className="max-h-[380px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-0">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 px-3 py-3">
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type];
              const Icon = cfg.icon;
              return (
                <Link
                  key={n.id}
                  href={`/communities/${n.post_id}`}
                  onClick={() => setIsOpen(false)}
                  className="flex gap-3 px-3 py-3 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="size-8 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800">
                      {getInitials(n.actor_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug">
                      <span className="font-medium">{n.actor_name}</span>
                      {" "}
                      <span className="text-muted-foreground">{cfg.label}</span>
                    </p>
                    {n.post_snippet && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        &ldquo;{n.post_snippet}&rdquo;
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Icon className="size-3" />
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="size-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  )}
                </Link>
              );
            })
          )}
        </div>
        <Separator />
        <div className="px-3 py-2">
          <Link
            href="/communities/notifications"
            onClick={() => setIsOpen(false)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center block"
          >
            See all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
