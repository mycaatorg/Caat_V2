import { Suspense } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ScholarshipRow } from "@/types/scholarships";
import ScholarshipsClient from "./client";

export default async function ScholarshipsPage() {
  const { data, error } = await supabase
    .from("scholarships")
    .select("*")
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-10 text-red-500">
        Error loading scholarships: {error.message}
      </div>
    );
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
              <BreadcrumbLink>Scholarships</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <Suspense>
        <ScholarshipsClient scholarships={(data ?? []) as ScholarshipRow[]} />
      </Suspense>
    </>
  );
}
