import { supabase } from "@/src/lib/supabaseClient";
import { notFound } from "next/navigation";
import { safeHref } from "@/lib/safe-href";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ExternalLink } from "lucide-react";
import SchoolBookmarkButton from "./bookmark-button";
import ApplicationButton from "./application-button";

export default async function SchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: school, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !school) {
    notFound();
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/schools">Schools</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbLink>{school.name}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="p-8 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-6">
          <Link href="/schools">
            <ChevronLeft className="h-4 w-4" />
            Back to Schools
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="space-y-1">
            {school.country && (
              <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {school.country}
              </span>
            )}
            <h1 className="text-3xl font-bold">{school.name}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ApplicationButton schoolId={school.id} />
            <SchoolBookmarkButton schoolId={school.id} />
          </div>
        </div>

        {school.description && (
          <p className="text-muted-foreground leading-relaxed mb-8">
            {school.description}
          </p>
        )}

        {safeHref(school.website) && (
          <section className="mb-8">
            <Button asChild variant="default" size="sm" className="gap-1.5">
              <a
                href={safeHref(school.website)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Visit Official Website
              </a>
            </Button>
          </section>
        )}
      </div>
    </>
  );
}
