import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/components/communities/NotificationBell";
import Link from "next/link";
import { Search } from "lucide-react";

interface PageHeaderProps {
  title: string;
  /** Hide the breadcrumb label on small screens */
  hideOnMobile?: boolean;
}

export function PageHeader({ title, hideOnMobile = false }: PageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-2 data-[orientation=vertical]:h-4"
      />
      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          <BreadcrumbItem className={hideOnMobile ? "hidden md:block" : undefined}>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Link href="/workspace/search" aria-label="Search my work" className="inline-flex size-9 items-center justify-center hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><Search className="size-4" /></Link>
      <NotificationBell />
    </header>
  );
}
