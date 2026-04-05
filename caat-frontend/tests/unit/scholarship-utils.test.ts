import { describe, it, expect } from "vitest";
import { deriveDisplayTags, formatAmountDisplay } from "@/types/scholarships";
import type { ScholarshipRow } from "@/types/scholarships";

// ── Helpers ────────────────────────────────────────────────────────────────────

function baseScholarship(overrides: Partial<ScholarshipRow> = {}): ScholarshipRow {
  return {
    id: "1",
    slug: null,
    external_id: null,
    external_url: null,
    title: "Test Scholarship",
    provider_name: "Test Org",
    description: null,
    amount_value: null,
    amount_currency: null,
    amount_display: null,
    awards_count: null,
    frequency: null,
    study_level: [],
    funding_type: [],
    eligible_countries: [],
    excluded_countries: [],
    eligible_genders: [],
    minimum_gpa: null,
    requires_essay: null,
    need_based: false,
    merit_based: false,
    school_name: null,
    country: null,
    state_region: null,
    application_open_at: null,
    deadline_at: null,
    start_term: null,
    is_recurring: false,
    is_active: true,
    is_featured: false,
    last_verified_at: null,
    source_last_synced_at: null,
    tags: [],
    eligibility_summary: null,
    application_requirements: null,
    contact_info: null,
    raw_payload: null,
    created_at: "2025-01-01",
    updated_at: "2025-01-01",
    ...overrides,
  };
}

// ── ELIGIBILITY_MAP predicates ─────────────────────────────────────────────────

const ELIGIBILITY_MAP: Record<string, (s: ScholarshipRow) => boolean> = {
  "Merit-Based":   (s) => s.merit_based,
  "Need-Based":    (s) => s.need_based,
  "Full Ride":     (s) => s.funding_type.includes("full_ride"),
  "Undergraduate": (s) => s.study_level.includes("undergraduate"),
  "Postgraduate":  (s) => s.study_level.includes("postgraduate"),
};

describe("ELIGIBILITY_MAP predicates", () => {
  it("merit-based predicate: returns true when merit_based is true", () => {
    expect(ELIGIBILITY_MAP["Merit-Based"](baseScholarship({ merit_based: true }))).toBe(true);
  });

  it("merit-based predicate: returns false when merit_based is false", () => {
    expect(ELIGIBILITY_MAP["Merit-Based"](baseScholarship({ merit_based: false }))).toBe(false);
  });

  it("need-based predicate: returns true when need_based is true", () => {
    expect(ELIGIBILITY_MAP["Need-Based"](baseScholarship({ need_based: true }))).toBe(true);
  });

  it("need-based predicate: returns false when need_based is false", () => {
    expect(ELIGIBILITY_MAP["Need-Based"](baseScholarship({ need_based: false }))).toBe(false);
  });

  it("full ride predicate: returns true when funding_type includes 'full_ride'", () => {
    expect(ELIGIBILITY_MAP["Full Ride"](baseScholarship({ funding_type: ["full_ride"] }))).toBe(true);
  });

  it("full ride predicate: returns false when funding_type does not include 'full_ride'", () => {
    expect(ELIGIBILITY_MAP["Full Ride"](baseScholarship({ funding_type: ["merit"] }))).toBe(false);
  });

  it("undergraduate predicate: returns true for undergraduate level", () => {
    expect(ELIGIBILITY_MAP["Undergraduate"](baseScholarship({ study_level: ["undergraduate"] }))).toBe(true);
  });

  it("undergraduate predicate: returns false for non-undergraduate", () => {
    expect(ELIGIBILITY_MAP["Undergraduate"](baseScholarship({ study_level: ["postgraduate"] }))).toBe(false);
  });

  it("postgraduate predicate: returns true for postgraduate level", () => {
    expect(ELIGIBILITY_MAP["Postgraduate"](baseScholarship({ study_level: ["postgraduate"] }))).toBe(true);
  });

  it("postgraduate predicate: returns false for undergraduate only", () => {
    expect(ELIGIBILITY_MAP["Postgraduate"](baseScholarship({ study_level: ["undergraduate"] }))).toBe(false);
  });

  it("each predicate handles empty arrays gracefully", () => {
    const s = baseScholarship();
    expect(ELIGIBILITY_MAP["Full Ride"](s)).toBe(false);
    expect(ELIGIBILITY_MAP["Undergraduate"](s)).toBe(false);
    expect(ELIGIBILITY_MAP["Postgraduate"](s)).toBe(false);
  });
});

// ── deriveDisplayTags ──────────────────────────────────────────────────────────

describe("deriveDisplayTags()", () => {
  it("returns MERIT-BASED tag when merit_based is true", () => {
    expect(deriveDisplayTags(baseScholarship({ merit_based: true }))).toContain("MERIT-BASED");
  });

  it("returns NEED-BLIND tag when need_based is true", () => {
    expect(deriveDisplayTags(baseScholarship({ need_based: true }))).toContain("NEED-BLIND");
  });

  it("returns FULL RIDE tag when funding_type includes 'full_ride'", () => {
    expect(deriveDisplayTags(baseScholarship({ funding_type: ["full_ride"] }))).toContain("FULL RIDE");
  });

  it("returns POST-GRAD tag for postgraduate-only scholarship", () => {
    expect(
      deriveDisplayTags(baseScholarship({ study_level: ["postgraduate"] }))
    ).toContain("POST-GRAD");
  });

  it("does not return POST-GRAD for mixed-level scholarship", () => {
    expect(
      deriveDisplayTags(baseScholarship({ study_level: ["undergraduate", "postgraduate"] }))
    ).not.toContain("POST-GRAD");
  });

  it("returns REGIONAL tag for scholarship with 1-8 eligible countries", () => {
    expect(
      deriveDisplayTags(baseScholarship({ eligible_countries: ["AU", "NZ"] }))
    ).toContain("REGIONAL");
  });

  it("does not return REGIONAL for scholarship open to 9+ countries", () => {
    expect(
      deriveDisplayTags(baseScholarship({ eligible_countries: ["AU","NZ","US","CA","UK","DE","FR","JP","SG"] }))
    ).not.toContain("REGIONAL");
  });

  it("returns STEM tag when description contains 'stem'", () => {
    expect(
      deriveDisplayTags(baseScholarship({ description: "This is a STEM scholarship" }))
    ).toContain("STEM");
  });

  it("returns STEM tag when tags include a stem keyword", () => {
    expect(
      deriveDisplayTags(baseScholarship({ tags: ["engineering"] }))
    ).toContain("STEM");
  });

  it("returns empty array for scholarship with no matching criteria", () => {
    expect(deriveDisplayTags(baseScholarship())).toEqual([]);
  });
});

// ── formatAmountDisplay ────────────────────────────────────────────────────────

describe("formatAmountDisplay()", () => {
  it("returns amount_display if present", () => {
    expect(formatAmountDisplay(baseScholarship({ amount_display: "$10,000 / year" }))).toBe("$10,000 / year");
  });

  it("formats USD amount value when no amount_display", () => {
    const result = formatAmountDisplay(baseScholarship({ amount_value: 5000, amount_currency: "USD" }));
    expect(result).toBe("$5,000");
  });

  it("formats AUD with A$ prefix", () => {
    const result = formatAmountDisplay(baseScholarship({ amount_value: 20000, amount_currency: "AUD" }));
    expect(result).toContain("A$");
  });

  it("formats GBP with £ prefix", () => {
    const result = formatAmountDisplay(baseScholarship({ amount_value: 10000, amount_currency: "GBP" }));
    expect(result).toContain("£");
  });

  it("formats EUR with € prefix", () => {
    const result = formatAmountDisplay(baseScholarship({ amount_value: 10000, amount_currency: "EUR" }));
    expect(result).toContain("€");
  });

  it("returns 'See Details' when no display or value", () => {
    expect(formatAmountDisplay(baseScholarship())).toBe("See Details");
  });

  it("returns 'See Details' for null amount_value", () => {
    expect(formatAmountDisplay(baseScholarship({ amount_value: null, amount_display: null }))).toBe("See Details");
  });

  it("formats zero amount value", () => {
    const result = formatAmountDisplay(baseScholarship({ amount_value: 0, amount_currency: "USD" }));
    // amount_value is 0, which is != null, so it should format
    expect(result).toBe("$0");
  });

  it("formats large amount with comma separator", () => {
    const result = formatAmountDisplay(baseScholarship({ amount_value: 65000, amount_currency: "USD" }));
    expect(result).toBe("$65,000");
  });
});
