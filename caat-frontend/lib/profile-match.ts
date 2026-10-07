/**
 * Pure helpers for matching a user's profile against scholarships, schools,
 * and majors. Used to surface a "★ Matches your …" badge and sort matched
 * items to the top of browse pages.
 *
 * No React or Supabase dependencies — call from server or client.
 */

import type { ProfileRow } from "@/types/profile";
import type { ScholarshipRow } from "@/types/scholarships";
import type { Major } from "@/types/majors";

export interface MatchDimensions {
  matchedMajor: string | null;
  matchedCountry: string | null;
  citizenshipEligible: boolean;
  levelMatches: boolean;
}

export interface MatchResult {
  score: number;
  reason: string | null;
}

/** Join label parts naturally: ["major","country","level"] -> "major, country and level". */
function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
}

export function reasonFor(d: MatchDimensions): string | null {
  const substantiveCount =
    (d.matchedMajor ? 1 : 0) +
    (d.matchedCountry ? 1 : 0) +
    (d.citizenshipEligible ? 1 : 0);

  if (substantiveCount === 0) return null;

  const totalCount = substantiveCount + (d.levelMatches ? 1 : 0);
  if (totalCount >= 3) {
    // Build the label from the dimensions that ACTUALLY matched, so the badge
    // never claims one (e.g. country) that did not fire. Previously this was a
    // fixed "your major, country and level" string, which falsely advertised
    // country on profiles whose preferred country did not match the school.
    const parts: string[] = [];
    if (d.matchedMajor) parts.push("major");
    if (d.matchedCountry) parts.push("country");
    if (d.citizenshipEligible) parts.push("citizenship");
    if (d.levelMatches) parts.push("level");
    return `Strong match: your ${joinWithAnd(parts)}`;
  }

  if (d.matchedMajor && d.matchedCountry) {
    return `Matches your ${d.matchedMajor} in your preferred country`;
  }
  if (d.matchedMajor && d.citizenshipEligible) {
    return `Matches ${d.matchedMajor}, open to internationals`;
  }
  if (d.matchedCountry && d.citizenshipEligible) {
    return `In your preferred country, open to your nationality`;
  }

  if (d.matchedMajor) return `Matches your ${d.matchedMajor}`;
  if (d.matchedCountry) return `In your preferred country (${d.matchedCountry})`;
  if (d.citizenshipEligible) return `Open to your nationality`;

  return null;
}

// ─── Country / citizenship helpers ────────────────────────────────────────────

const DOMESTIC_CODES: Record<string, string[]> = {
  Australia: ["AU", "AU-PR"],
};

const NATIONALITY_TO_COUNTRY: Record<string, string> = {
  Australian: "Australia",
};

function isCitizenshipEligible(
  nationality: string | null,
  scholarship: ScholarshipRow
): boolean {
  if (!nationality) return false;
  const cits = Array.isArray(scholarship.citizenships) ? scholarship.citizenships : [];
  if (cits.length === 0) return false;

  const homeCountry = NATIONALITY_TO_COUNTRY[nationality];
  if (homeCountry && scholarship.country === homeCountry) {
    const domesticCodes = DOMESTIC_CODES[homeCountry] ?? [];
    if (domesticCodes.some((c) => cits.includes(c))) return true;
  }
  return cits.includes("INTERNATIONAL");
}

function findMajorMatch(
  targetMajors: string[] | null | undefined,
  scholarship: ScholarshipRow
): string | null {
  if (!targetMajors?.length) return null;
  const haystack = [
    scholarship.title,
    scholarship.description ?? "",
    ...scholarship.tags,
  ]
    .join(" ")
    .toLowerCase();
  for (const m of targetMajors) {
    if (!m) continue;
    if (haystack.includes(m.toLowerCase())) return m;
  }
  return null;
}

/** Common country aliases so "USA"/"US"/"United States" etc. all resolve to
 *  one canonical form before comparison. Keys + values are lowercased. */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states",
  us: "united states",
  "u.s.": "united states",
  "u.s.a.": "united states",
  america: "united states",
  uk: "united kingdom",
  "u.k.": "united kingdom",
  britain: "united kingdom",
  england: "united kingdom",
  aus: "australia",
  oz: "australia",
  nz: "new zealand",
};

/** Normalise a country string for comparison: trim, lowercase, de-alias. */
function normaliseCountry(c: string): string {
  const base = c.trim().toLowerCase();
  return COUNTRY_ALIASES[base] ?? base;
}

function findCountryMatch(
  preferredCountries: string[] | null | undefined,
  country: string | null
): string | null {
  if (!preferredCountries?.length || !country) return null;
  // Case-insensitive + alias-aware. Users type "australia", "AUS", "USA"
  // etc; scholarships store a canonical "Australia" / "United States". We
  // compare normalised forms and return the scholarship's canonical string
  // for display so the badge always reads cleanly.
  const target = normaliseCountry(country);
  const hit = preferredCountries.some((c) => c && normaliseCountry(c) === target);
  return hit ? country : null;
}

function levelMatches(
  graduationYear: number | null | undefined,
  studyLevel: string[]
): boolean {
  if (!graduationYear || studyLevel.length === 0) return false;
  const now = new Date().getFullYear();
  const looksLikeHighSchooler = graduationYear >= now && graduationYear <= now + 5;
  if (looksLikeHighSchooler && studyLevel.includes("undergraduate")) return true;
  return false;
}

export function matchScholarship(
  profile: ProfileRow | null,
  s: ScholarshipRow
): MatchResult {
  if (!profile) return { score: 0, reason: null };

  const matchedMajor = findMajorMatch(profile.target_majors, s);
  const matchedCountry = findCountryMatch(profile.preferred_countries, s.country);
  const citizenshipEligible = isCitizenshipEligible(profile.nationality, s);
  const lvlMatch = levelMatches(profile.graduation_year, s.study_level);

  const dimensions: MatchDimensions = {
    matchedMajor,
    matchedCountry,
    citizenshipEligible,
    levelMatches: lvlMatch,
  };
  const reason = reasonFor(dimensions);
  const score = reason
    ? (matchedMajor ? 1 : 0) +
      (matchedCountry ? 1 : 0) +
      (citizenshipEligible ? 1 : 0) +
      (lvlMatch ? 1 : 0)
    : 0;
  return { score, reason };
}

/**
 * Profile-derived scalars for the `search_scholarships` RPC (C1/B12). The RPC
 * does the per-row scoring in Postgres, but the profile-only derivations that
 * need the alias tables above (country normalisation, nationality -> home
 * country, domestic codes) are computed here so those tables stay the single
 * source of truth. Keep in sync with `matchScholarship`.
 */
export interface ScholarshipMatchParams {
  targetMajors: string[]; // lowercased, empties dropped
  prefCountries: string[]; // alias-normalised + lowercased
  homeCountry: string | null;
  domesticCodes: string[];
  gradYear: number | null;
}

export function scholarshipMatchParams(
  profile: ProfileRow | null
): ScholarshipMatchParams {
  if (!profile) {
    return {
      targetMajors: [],
      prefCountries: [],
      homeCountry: null,
      domesticCodes: [],
      gradYear: null,
    };
  }
  const targetMajors = (profile.target_majors ?? [])
    .filter((m): m is string => Boolean(m))
    .map((m) => m.toLowerCase());
  const prefCountries = (profile.preferred_countries ?? [])
    .filter((c): c is string => Boolean(c))
    .map((c) => normaliseCountry(c));
  const homeCountry = profile.nationality
    ? NATIONALITY_TO_COUNTRY[profile.nationality] ?? null
    : null;
  const domesticCodes = homeCountry ? DOMESTIC_CODES[homeCountry] ?? [] : [];
  return {
    targetMajors,
    prefCountries,
    homeCountry,
    domesticCodes,
    gradYear: profile.graduation_year ?? null,
  };
}

// ─── School match ────────────────────────────────────────────────────────────

export interface SchoolForMatch {
  id: number;
  name: string;
  country: string | null;
}

export function matchSchool(
  profile: ProfileRow | null,
  school: SchoolForMatch,
  offeredMajors?: string[]
): MatchResult {
  if (!profile) return { score: 0, reason: null };

  const matchedCountry = findCountryMatch(profile.preferred_countries, school.country);
  if (!matchedCountry) return { score: 0, reason: null };

  let matchedMajor: string | null = null;
  if (offeredMajors?.length && profile.target_majors?.length) {
    const offered = offeredMajors.map((m) => m.toLowerCase());
    for (const tm of profile.target_majors) {
      if (!tm) continue;
      if (offered.includes(tm.toLowerCase())) {
        matchedMajor = tm;
        break;
      }
    }
  }

  const dimensions: MatchDimensions = {
    matchedMajor,
    matchedCountry,
    citizenshipEligible: false,
    levelMatches: false,
  };
  const reason = reasonFor(dimensions);
  const score = reason
    ? (matchedMajor ? 1 : 0) + (matchedCountry ? 1 : 0)
    : 0;
  return { score, reason };
}

// ─── Major match ─────────────────────────────────────────────────────────────

export function matchMajor(
  profile: ProfileRow | null,
  major: Major
): MatchResult {
  if (!profile?.target_majors?.length) return { score: 0, reason: null };
  const lowercased = profile.target_majors.map((m) => m.toLowerCase());
  if (!lowercased.includes(major.name.toLowerCase())) {
    return { score: 0, reason: null };
  }
  return {
    score: 1,
    reason: `Matches your ${major.name}`,
  };
}
