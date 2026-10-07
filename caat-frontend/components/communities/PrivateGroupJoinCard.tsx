import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/communities/NotificationBell";
import { GroupJoinButton } from "@/components/communities/GroupJoinButton";

interface PrivateGroupJoinCardProps {
  groupId: string;
  name: string;
  slug: string;
  hasRequested: boolean;
}

/**
 * What a signed-in non-member sees at a private community's link (PROD-86):
 * the name and a way to ask the owner, deliberately nothing else. The
 * description, posts, members and counts stay private until approval.
 */
export function PrivateGroupJoinCard({ groupId, name, slug, hasRequested }: PrivateGroupJoinCardProps) {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/communities">Community Campus</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem><BreadcrumbLink>c/{slug}</BreadcrumbLink></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NotificationBell />
      </header>
      <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
        <div className="size-14 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-base font-bold text-zinc-600 dark:text-zinc-300">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-base font-semibold text-foreground">{name}</h1>
          <p className="text-sm font-mono text-muted-foreground">c/{slug}</p>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Lock className="size-3.5" />
          <span>This is a private community</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs text-center">
          Posts and members are visible once the owner approves your request.
        </p>
        <GroupJoinButton
          groupId={groupId}
          initialIsMember={false}
          isOwner={false}
          isPrivate={true}
          initialHasRequested={hasRequested}
        />
        <Link href="/communities/groups" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="size-3" /> Browse communities
        </Link>
      </div>
    </>
  );
}
