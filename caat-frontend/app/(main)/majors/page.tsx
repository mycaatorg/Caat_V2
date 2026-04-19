import { Suspense } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import { PageHeader } from "@/components/PageHeader";
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
    return <div className="p-10 text-red-500">Unable to load majors. Please try again later.</div>;
  }

  return (
    <>
      <PageHeader title="Majors" />
      <Suspense>
        <MajorsClient majors={majors ?? []} initialFilter={initialFilter} />
      </Suspense>
    </>
  );
}
