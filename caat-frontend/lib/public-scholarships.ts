import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { evidencePages } from "@/lib/evidence-pagination";
import { selectPublicScholarship } from "@/lib/public-scholarship-identity";
import type { ScholarshipRow } from "@/types/scholarships";

// Catalog-only columns exposed on the public directory. Deliberately explicit
// (never `*`) so no future column silently reaches a logged-out page, and so it
// stays obvious that only global catalog data, never user data, is read here.
const PUBLIC_SCHOLARSHIP_COLUMNS = `
  id, slug, external_url, title, provider_name, description,
  amount_value, amount_currency, amount_display, awards_count, frequency,
  study_level, funding_type, citizenships, eligible_countries, excluded_countries,
  eligible_genders, minimum_gpa, requires_essay, need_based, merit_based,
  school_name, country, state_region, application_open_at, deadline_at,
  start_term, is_recurring, is_active, is_featured, last_verified_at,
  tags, field_of_study, year_level, eligibility_summary,
  application_requirements, contact_info, created_at, updated_at
`;

export const PUBLIC_PAGE_SIZE = 12;

export const PUBLIC_FUNDING_OPTIONS = ["Merit-Based", "Need-Based", "Full Ride"];
export const PUBLIC_LEVEL_OPTIONS = ["Undergraduate", "Postgraduate"];

export type PublicSearchParams = {
  q?: string;
  location?: string;
  funding?: string;
  level?: string;
  open?: string;
  page?: string;
};

export type PublicScholarshipPage = {
  rows: ScholarshipRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
};

function parseArrayParam(val: string | undefined): string[] {
  if (!val) return [];
  return val
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * One page of the public catalog. Reuses the same `search_scholarships` RPC as
 * the authed browse page, but only ever passes the NON-personalized filters:
 * no profile match-sort, no bookmark restriction. With no profile params every
 * row scores 0, so the RPC falls back to its deterministic public ordering
 * (active first, then featured, then newest).
 */
export const getPublicScholarshipsPage = unstable_cache(
  async (params: PublicSearchParams): Promise<PublicScholarshipPage> => {
    const sb = createPublicClient();
    const currentPage = Math.max(1, Number(params.page) || 1);

    const { data, error } = await sb.rpc("search_scholarships", {
      p_search: params.q?.trim() || undefined,
      p_location: params.location?.trim() || undefined,
      p_funding: parseArrayParam(params.funding),
      p_levels: parseArrayParam(params.level),
      p_open_only: params.open === "1",
      p_limit: PUBLIC_PAGE_SIZE,
      p_offset: (currentPage - 1) * PUBLIC_PAGE_SIZE,
    });

    if (error) throw new Error(error.message);

    const result = (data as unknown as { data: ScholarshipRow[]; total_count: number }[] | null)?.[0];
    return {
      rows: result?.data ?? [],
      totalCount: result?.total_count ?? 0,
      currentPage,
      pageSize: PUBLIC_PAGE_SIZE,
    };
  },
  ["public-scholarships-page"],
  { revalidate: 3600, tags: ["scholarship-catalog"] },
);

/**
 * All public records behind a readable alias. Slugs are not unique in the
 * imported catalogue; a bare ambiguous link must let the visitor choose.
 */
export const getPublicScholarshipsBySlug = unstable_cache(
  async (slug: string): Promise<ScholarshipRow[]> => {
    const sb = createPublicClient();
    return evidencePages<ScholarshipRow>(async (from, to) => {
      const { data, error } = await sb.from("scholarships")
        .select(PUBLIC_SCHOLARSHIP_COLUMNS).eq("slug", slug)
        .order("is_active", { ascending: false })
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true }).range(from, to);
      return { data: data as unknown as ScholarshipRow[] | null, error };
    }, "Could not load the scholarship listings.");
  },
  ["public-scholarship-candidates-v1"],
  { revalidate: 3600, tags: ["scholarship-catalog"] },
);

/** Ambiguous bare aliases have no single award (including their social image). */
export async function getPublicScholarshipBySlug(slug: string, awardId?: string): Promise<ScholarshipRow | null> {
  return selectPublicScholarship(await getPublicScholarshipsBySlug(slug), awardId);
}

/**
 * Related scholarships for internal linking / crawl discovery: same school
 * first, then same field of study, excluding the current row.
 */
export const getRelatedScholarships = unstable_cache(
  async (
    id: string,
    schoolName: string | null,
    fields: string[],
    limit = 6,
  ): Promise<ScholarshipRow[]> => {
    const sb = createPublicClient();
    const collected = new Map<string, ScholarshipRow>();

    if (schoolName) {
      const { data } = await sb
        .from("scholarships")
        .select(PUBLIC_SCHOLARSHIP_COLUMNS)
        .eq("school_name", schoolName)
        .eq("is_active", true)
        .not("slug", "is", null)
        .neq("id", id)
        .limit(limit);
      for (const r of (data as unknown as ScholarshipRow[] | null) ?? []) {
        collected.set(r.id, r);
      }
    }

    if (collected.size < limit && fields.length > 0) {
      const { data } = await sb
        .from("scholarships")
        .select(PUBLIC_SCHOLARSHIP_COLUMNS)
        .overlaps("field_of_study", fields)
        .eq("is_active", true)
        .not("slug", "is", null)
        .neq("id", id)
        .limit(limit);
      for (const r of (data as unknown as ScholarshipRow[] | null) ?? []) {
        if (!collected.has(r.id)) collected.set(r.id, r);
      }
    }

    return Array.from(collected.values()).slice(0, limit);
  },
  ["public-related-scholarships"],
  { revalidate: 3600, tags: ["scholarship-catalog"] },
);

/**
 * All indexable scholarship slugs (+ updated_at) for the sitemap. Active rows
 * with a slug only. 4,224 rows is well under the 50k-URL sitemap limit, so this
 * is returned in one list.
 */
export const getPublicScholarshipSlugs = unstable_cache(
  async (): Promise<{ id: string; slug: string; updated_at: string }[]> => {
    const sb = createPublicClient();
    const rows = await evidencePages<{ id: string; slug: string | null; updated_at: string }>(
      (from, to) => sb
        .from("scholarships")
        .select("id, slug, updated_at")
        .eq("is_active", true)
        .not("slug", "is", null)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
      "Could not load the complete public scholarship sitemap.",
    );
    return rows.flatMap(({ id, slug, updated_at }) => slug ? [{ id, slug, updated_at }] : []);
  },
  ["public-scholarship-slugs-with-identity-v1"],
  { revalidate: 3600, tags: ["scholarship-catalog"] },
);
