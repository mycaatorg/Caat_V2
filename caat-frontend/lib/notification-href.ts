import type { NotificationItem } from "@/types/community";

// D5: route by what the notification actually points at; never link to
// /communities/null. Join requests carry no post, so they open the owner's
// review queue (PROD-86).
export function notificationHref(
  n: Pick<NotificationItem, "type" | "post_id" | "actor_id">,
): string {
  if (n.post_id) return `/communities/${n.post_id}`;
  if (n.type === "follow" && n.actor_id) return `/communities/profile/${n.actor_id}`;
  if (n.type === "join_request") return "/communities/requests";
  return "/communities";
}
