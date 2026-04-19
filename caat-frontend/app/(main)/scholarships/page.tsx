import { Suspense } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import { PageHeader } from "@/components/PageHeader";
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
        Unable to load scholarships. Please try again later.
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Scholarships" />
      <Suspense>
        <ScholarshipsClient scholarships={(data ?? []) as ScholarshipRow[]} />
      </Suspense>
    </>
  );
}
