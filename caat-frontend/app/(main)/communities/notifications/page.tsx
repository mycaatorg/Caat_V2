import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, Heart, MessageCircle, CornerDownRight, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/user-utils";
import { fetchNotificationsAction, markNotificationsReadAction } from "@/app/(main)/communities/actions";
import type { NotificationItem } from "@/types/community";

const TYPE_CONFIG: Record<NotificationItem["type"], { icon: React.ElementType; label: string }> = {
  like:    { icon: Heart,           label: "liked your post" },
  comment: { icon: MessageCircle,   label: "commented on your post" },
  reply:   { icon: CornerDownRight, label: "replied to your comment" },
  follow:  { icon: UserPlus,        label: "started following you" },
};

export default async function NotificationsPage() {
  const { notifications } = await fetchNotificationsAction(50);
  await markNotificationsReadAction();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/communities">Communities</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink>Notifications</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="p-6">
        <main className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="size-4" />
            <h1 className="text-base font-semibold">Notifications</h1>
          </div>

          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Bell className="size-8 mb-3 opacity-40" />
              <p className="text-lg font-medium">No notifications yet</p>
              <p className="text-sm mt-1">Activity from your posts and followers will appear here.</p>
            </div>
          ) : (
            <div className="rounded-xl border divide-y">
              {notifications.map((n) => {
                const cfg = TYPE_CONFIG[n.type];
                const Icon = cfg.icon;
                const href = n.post_id ? `/communities/${n.post_id}` : n.type === "follow" ? `/communities/profile/${n.actor_name}` : "/communities";
                return (
                  <Link
                    key={n.id}
                    href={href}
                    className="flex gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <Avatar className="size-9 shrink-0 mt-0.5">
                      <AvatarImage src={n.actor_avatar ?? undefined} />
                      <AvatarFallback className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        {getInitials(n.actor_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{n.actor_name}</span>
                        {" "}
                        <span className="text-muted-foreground">{cfg.label}</span>
                      </p>
                      {n.post_snippet && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          &ldquo;{n.post_snippet}&rdquo;
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Icon className="size-3" />
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="size-2 rounded-full bg-blue-500 shrink-0 mt-2" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
