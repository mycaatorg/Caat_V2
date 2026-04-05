import { Suspense } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import MajorsClient from "./client";
import type { FilterView } from "@/types/majors";

export default async function MajorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const initialFilter = (params.category ?? "All") as FilterView;

  const { data: majors, error } = await supabase
    .from("majors")
    .select("*")
    .order("name");

  if (error) {
    return <div className="p-10 text-red-500">Error: {error.message}</div>;
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
            <BreadcrumbItem>
              <BreadcrumbLink>Majors</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <Suspense>
        <MajorsClient majors={majors ?? []} initialFilter={initialFilter} />
      </Suspense>
    </>
  );
}
