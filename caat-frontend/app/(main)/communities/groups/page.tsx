import Link from "next/link";
import { Users, Lock, Globe } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/communities/NotificationBell";
import { CreateGroupModal } from "@/components/communities/CreateGroupModal";
import { GroupJoinButton } from "@/components/communities/GroupJoinButton";
import { fetchGroupsAction } from "@/app/(main)/communities/actions";

export default async function GroupsDiscoverPage() {
  const { groups } = await fetchGroupsAction();

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
              <BreadcrumbLink>Groups</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NotificationBell />
      </header>

      <div className="p-6">
        <main className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Discover Communities</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{groups.length} public communit{groups.length !== 1 ? "ies" : "y"}</p>
            </div>
            <CreateGroupModal />
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="size-8 mb-3 opacity-40" />
              <p className="text-base font-medium">No communities yet</p>
              <p className="text-sm mt-1">Be the first to create one.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <div key={group.id} className="rounded-xl border p-4 space-y-3 hover:border-muted-foreground/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/communities/c/${group.slug}`} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
                      <div className="size-10 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                        {group.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{group.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">c/{group.slug}</p>
                      </div>
                    </Link>
                    <GroupJoinButton groupId={group.id} initialIsMember={group.is_member} isOwner={group.is_owner} />
                  </div>

                  {group.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{group.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {group.member_count} member{group.member_count !== 1 ? "s" : ""}
                    </span>
                    <span>{group.post_count} post{group.post_count !== 1 ? "s" : ""}</span>
                    <span className="flex items-center gap-1 ml-auto">
                      {group.is_private ? <Lock className="size-3" /> : <Globe className="size-3" />}
                      {group.is_private ? "Private" : "Public"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
