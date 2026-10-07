import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { PageHeader } from "@/components/PageHeader";
import type { ScholarshipRow } from "@/types/scholarships";
import type { ProfileRow } from "@/types/profile";
import { scholarshipMatchParams } from "@/lib/profile-match";
import type { ScholarshipStatus } from "@/lib/scholarship-tracking";
import { getScholarshipUniversities } from "@/lib/scholarship-catalog";
import ScholarshipsClient from "./client";

// One page of cards. Was filtered/paginated client-side from the full 4,224-row
// table; now the server asks Postgres for exactly one page (C1/M2).
// PROD-72: 12 per page (as on the public directory). Measured on a 4,200-row
// catalogue, page size does not change query time; filtering dominates.
export const ITEMS_PER_PAGE = 12;

function parseArrayParam(val: string | undefined): string[] {
  if (!val) return [];
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type SearchParams = {
  q?: string;
  location?: string;
  funding?: string;
  level?: string;
  citizenship?: string;
  field?: string;
  university?: string;
  open?: string;
  bookmarked?: string;
  status?: string;
  page?: string;
  view?: string;
};

const STATUS_FILTER_MATCH: Record<string, ScholarshipStatus[]> = {
  interested: ["interested"],
  applied: ["applied"],
  outcome: ["awarded", "not_selected"],
};

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sb = await createServerClient();

  const {
    data: { user },
  } = await sb.auth.getUser();

  // Resolve profile + the user's bookmark/tracking set once, server-side, so the
  // client renders bookmark icons and status labels on first paint (no per-card
  // fetch) and so bookmarked/status filters can be applied at the query level.
  const [profileRes, bookmarksRes] = await Promise.all([
    user
      ? sb.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? sb
          .from("user_bookmarked_scholarships")
          .select("scholarship_id, status, school_id")
          .eq("user_id", user.id)
      : Promise.resolve({ data: null }),
  ]);

  const profile = (profileRes.data as unknown as ProfileRow | null) ?? null;

  const bookmarkRows =
    (bookmarksRes.data as
      | { scholarship_id: string; status: string | null; school_id: number | null }[]
      | null) ?? [];
  const bookmarkedIds = bookmarkRows.map((r) => r.scholarship_id);
  const tracking = bookmarkRows.map((r) => ({
    scholarship_id: r.scholarship_id,
    status: (r.status as ScholarshipStatus | null) ?? "interested",
    school_id: r.school_id ?? null,
  }));

  const currentPage = Math.max(1, Number(params.page) || 1);
  const statusFilter = params.status ?? "all";
  const showBookmarked = params.bookmarked === "1";

  // The bookmarked pill and the status tabs are user-scoped. Turn them into an
  // id allow-list computed from the user's own rows and hand it to the RPC, so
  // filtering + pagination stay server-side (a bookmarked item on a later page
  // still surfaces).
  let restrictIds: string[] | null = null;
  if (showBookmarked || statusFilter !== "all") {
    let ids = new Set(bookmarkedIds);
    if (statusFilter !== "all") {
      const wanted = STATUS_FILTER_MATCH[statusFilter] ?? [];
      ids = new Set(
        tracking
          .filter((t) => wanted.includes(t.status))
          .map((t) => t.scholarship_id),
      );
    }
    restrictIds = Array.from(ids);
  }

  const match = scholarshipMatchParams(profile);

  // When the user filters to their own (bookmarked/status) set and it is empty,
  // skip the query — the RPC would treat a null restrict list as "no filter".
  const emptyRestrict = restrictIds !== null && restrictIds.length === 0;

  const rpcRes = emptyRestrict
    ? { data: null, error: null }
    : await sb.rpc("search_scholarships", {
        p_search: params.q?.trim() || undefined,
        p_location: params.location?.trim() || undefined,
        p_funding: parseArrayParam(params.funding),
        p_levels: parseArrayParam(params.level),
        p_citizenship: parseArrayParam(params.citizenship),
        p_fields: parseArrayParam(params.field),
        p_universities: parseArrayParam(params.university),
        p_open_only: params.open === "1",
        p_restrict_ids: restrictIds ?? undefined,
        p_target_majors: match.targetMajors,
        p_pref_countries: match.prefCountries,
        p_home_country: match.homeCountry ?? undefined,
        p_domestic_codes: match.domesticCodes,
        p_grad_year: match.gradYear ?? undefined,
        p_limit: ITEMS_PER_PAGE,
        p_offset: (currentPage - 1) * ITEMS_PER_PAGE,
      });

  if (rpcRes.error) {
    return (
      <div className="p-10 text-[#9a1a27] dark:text-[#e06b78]">
        Unable to load scholarships. Please try again later.
      </div>
    );
  }

  const result = (rpcRes.data as { data: ScholarshipRow[]; total_count: number }[] | null)?.[0];
  const rows = emptyRestrict ? [] : result?.data ?? [];
  const totalCount = emptyRestrict ? 0 : result?.total_count ?? 0;

  const availableUniversities = await getScholarshipUniversities();

  return (
    <>
      <PageHeader title="Scholarships" />
      <Suspense>
        <ScholarshipsClient
          rows={rows}
          totalCount={totalCount}
          currentPage={currentPage}
          itemsPerPage={ITEMS_PER_PAGE}
          profile={profile}
          initialBookmarkedIds={bookmarkedIds}
          initialTracking={tracking}
          availableUniversities={availableUniversities}
        />
      </Suspense>
    </>
  );
}
