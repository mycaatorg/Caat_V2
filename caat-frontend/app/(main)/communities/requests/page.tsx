import { DoorOpen } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/communities/NotificationBell";
import { JoinRequestReview } from "@/components/communities/JoinRequestReview";
import { fetchJoinRequestQueueAction } from "@/app/(main)/communities/actions";

// The owner's review queue for private community join requests (PROD-86).
export default async function JoinRequestsPage() {
  const { groups, error } = await fetchJoinRequestQueueAction();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="flex-1">
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/communities">Community Campus</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Join requests</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <NotificationBell />
      </header>

      <div className="p-6">
        <main className="max-w-2xl mx-auto space-y-4">
          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-2">
              <DoorOpen className="size-4" />
              <h1 className="text-base font-semibold">Join requests</h1>
            </div>
            <p className="text-sm text-muted-foreground">People asking to join the communities you own.</p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : (
            <JoinRequestReview groups={groups} />
          )}
        </main>
      </div>
    </>
  );
}
