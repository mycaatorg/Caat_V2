import { Suspense } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import { PageHeader } from "@/components/PageHeader";
import { ScholarshipRow } from "@/types/scholarships";
import ScholarshipsClient from "./client";

const SCHOLARSHIP_FETCH_BATCH_SIZE = 1000;
const SCHOLARSHIP_LIST_COLUMNS = `
  id, slug, external_id, external_url, title, provider_name, description,
  amount_value, amount_currency, amount_display, awards_count, frequency,
  study_level, funding_type, eligible_countries, excluded_countries,
  citizenships, eligible_genders, minimum_gpa, requires_essay,
  need_based, merit_based, school_name, country, state_region,
  application_open_at, deadline_at, start_term, is_recurring, is_active,
  is_featured, last_verified_at, source_last_synced_at, tags,
  eligibility_summary, created_at, updated_at
`;

async function fetchAllScholarships() {
  const rows: ScholarshipRow[] = [];

  for (let from = 0; ; from += SCHOLARSHIP_FETCH_BATCH_SIZE) {
    const to = from + SCHOLARSHIP_FETCH_BATCH_SIZE - 1;
    const { data, error } = await supabase
      .from("scholarships")
      .select(SCHOLARSHIP_LIST_COLUMNS)
      .order("is_active", { ascending: false })
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) return { data: null, error };

    const batch = (data ?? []) as ScholarshipRow[];
    rows.push(...batch);

    if (batch.length < SCHOLARSHIP_FETCH_BATCH_SIZE) {
      return { data: rows, error: null };
    }
  }
}

export default async function ScholarshipsPage() {
  const { data, error } = await fetchAllScholarships();

  if (error) {
    return (
      <div className="p-10 text-[#9a1a27]">
        Unable to load scholarships. Please try again later.
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Scholarships" />
      <Suspense>
        <ScholarshipsClient scholarships={data ?? []} />
      </Suspense>
    </>
  );
}
