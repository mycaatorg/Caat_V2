/** Raw row returned from the public.scholarships Supabase table */
export interface ScholarshipRow {
  id: string;
  slug: string | null;
  external_id: string | null;
  external_url: string | null;
  title: string;
  provider_name: string;
  description: string | null;
  amount_value: number | null;
  amount_currency: string | null;
  /** Pre-formatted display string, e.g. "$65,000 / year" or "Fully Funded" */
  amount_display: string | null;
  awards_count: number | null;
  frequency: "one_time" | "yearly" | "semester" | "monthly" | "custom" | null;
  study_level: string[];      // e.g. ["undergraduate", "postgraduate"]
  funding_type: string[];     // e.g. ["merit", "need", "full_ride", "tuition"]
  eligible_countries: string[];
  excluded_countries: string[];
  /**
   * Raw scraper citizenship codes: AU, AU-PR, INTERNATIONAL.
   * Empty array means no restriction (open to all).
   * Translated to user-facing Domestic / International client-side,
   * relative to the scholarship's `country` (see scholarships/client.tsx).
   */
  citizenships: string[];
  eligible_genders: string[];
  minimum_gpa: number | null;
  requires_essay: boolean | null;
  need_based: boolean;
  merit_based: boolean;
  school_name: string | null;
  country: string | null;
  state_region: string | null;
  application_open_at: string | null;
  deadline_at: string | null;
  start_term: string | null;
  is_recurring: boolean;
  is_active: boolean;
  is_featured: boolean;
  last_verified_at: string | null;
  source_last_synced_at: string | null;
  tags: string[];
  eligibility_summary: string | null;
  application_requirements: Record<string, unknown> | null;
  contact_info: Record<string, unknown> | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Derives human-readable display badge tags from structured DB fields.
 * The card renders these as coloured pill labels.
 */
export function deriveDisplayTags(s: ScholarshipRow): string[] {
  const badges: string[] = [];

  if (s.funding_type.includes("full_ride")) badges.push("FULL RIDE");
  if (s.merit_based) badges.push("MERIT-BASED");
  if (s.need_based) badges.push("NEED-BLIND");

  // Post-grad only (not mixed level)
  if (
    s.study_level.includes("postgraduate") &&
    !s.study_level.includes("undergraduate")
  ) {
    badges.push("POST-GRAD");
  }

  // Regional: restricted to a sub-national region (state/province). A
  // country-only restriction isn't "regional" — most uni scholarships limit
  // by country, and tagging them all REGIONAL was noise (e.g. every Sydney
  // scholarship with eligible_countries=["AU"] was lighting up).
  if ((s.state_region ?? "").trim().length > 0) {
    badges.push("REGIONAL");
  }

  // STEM: inferred from tags or description keywords
  const stemKeywords = ["stem", "science", "engineering", "technology", "mathematics", "physics", "chemistry"];
  const hasStem =
    s.tags.some((t) => stemKeywords.some((k) => t.toLowerCase().includes(k))) ||
    (s.description ?? "").toLowerCase().includes("stem");
  if (hasStem) badges.push("STEM");

  // Prestigious: flagged via tags
  if (s.tags.some((t) => t.toLowerCase().includes("prestigious"))) {
    badges.push("PRESTIGIOUS");
  }

  return badges;
}

/**
 * Returns the best display string for the scholarship amount.
 * Prefers the pre-formatted amount_display column; falls back to
 * formatting amount_value + currency.
 */
// Strings that some scrapers store in amount_display when the source page
// doesn't quote a real amount. Treated as "no amount" so the card doesn't
// render them as a headline.
const NON_INFORMATIVE_AMOUNTS = new Set([
  "not specified",
  "n/a",
  "na",
  "tba",
  "to be advised",
  "to be confirmed",
  "varies",
  "refer to handbook",
  "see details",
]);

export function formatAmountDisplay(s: ScholarshipRow): string {
  if (s.amount_display) {
    const norm = s.amount_display.trim().toLowerCase();
    if (!NON_INFORMATIVE_AMOUNTS.has(norm)) return s.amount_display;
  }

  if (s.amount_value != null) {
    const prefix =
      s.amount_currency === "AUD"
        ? "A$"
        : s.amount_currency === "GBP"
        ? "£"
        : s.amount_currency === "EUR"
        ? "€"
        : "$";
    const formatted = s.amount_value.toLocaleString("en-US");
    return `${prefix}${formatted}`;
  }

  return "See Details";
}
