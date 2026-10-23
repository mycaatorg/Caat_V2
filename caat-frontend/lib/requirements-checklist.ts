/**
 * PROD-77 (minimal): a requirements checklist for one saved scholarship, built
 * only from what the catalogue row records. Rules:
 * - every item states its source: "Recorded" for a recorded value, "Check with
 *   the provider" for anything unknown and for every recorded rule;
 * - unknown stays unknown ("Not recorded ..."), never defaulted to "No";
 * - a source last checked more than 90 days ago carries "Last checked <date>";
 * - no profile data is read, and nothing here says the student is eligible,
 *   admitted, matched or has applied. Completing it is not submitting anything.
 * Keys are stable so ticks survive reloads; a rule's key is a hash of its text,
 * so changed text gets a new key and an old tick never lands on another rule.
 */
import type { ScholarshipRow } from "@/types/scholarships";
import { scholarshipSourceState, type SourceFreshness } from "@/lib/scholarship-eligibility";

export type ChecklistScholarship = Pick<
  ScholarshipRow,
  | "id"
  | "requires_essay"
  | "deadline_at"
  | "external_url"
  | "application_requirements"
  | "eligibility_summary"
  | "last_verified_at"
  | "source_last_synced_at"
  | "school_name"
  | "is_active"
>;

export type ChecklistItemKind = "separate-application" | "essay" | "deadline" | "official-link" | "rule";
export type ChecklistItemState = "recorded" | "not-recorded" | "passed";
export type ChecklistSource = "Recorded" | "Check with the provider";

export interface ChecklistItem {
  key: string;
  kind: ChecklistItemKind;
  label: string;
  state: ChecklistItemState;
  source: ChecklistSource;
  /** Short per-item source suffix so an item read alone still carries it. */
  sourceSuffix: string;
  detail: string | null;
  href: string | null;
}

export interface RequirementsChecklist {
  items: ChecklistItem[];
  freshness: SourceFreshness;
  verifiedAt: string | null;
  /** "Last checked <date>" when the source is older than 90 days, else null. */
  staleLabel: string | null;
  /** One sentence describing the source date for the checklist header. */
  sourceNote: string;
  inactive: boolean;
  recordedInstitution: string | null;
}

/** Must match the CHECK on user_scholarship_prep_checks.item_key. */
export const ITEM_KEY_PATTERN = /^(separate-application|essay|deadline|official-link|rule:[a-z0-9]{8,64})$/;

export const CHECKLIST_NOTICE =
  "Completing this checklist is not submitting an application. Ticks track your preparation in CAAT. They don't send anything to the provider.";

const RECORDED: ChecklistSource = "Recorded";
const PROVIDER: ChecklistSource = "Check with the provider";

function normalise(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && !!v.trim()).map(normalise)
    : [];
}

/** Two independent 32-bit FNV-1a passes, as 16 lowercase hex characters. */
function hash64(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(a) + hex(b);
}

export function ruleKey(text: string): string {
  return `rule:${hash64(normalise(text))}`;
}

/** A calendar-valid date string (YYYY-MM-DD, optionally with a time), or null. */
function validDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(day.getTime())) return null;
  if (day.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  return date;
}

/** The recorded calendar date, e.g. "6 Apr 2026", read from the stored date part. */
function formatDay(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function requirementsChecklist(row: ChecklistScholarship, now: Date): RequirementsChecklist {
  const source = scholarshipSourceState(row, now);
  const verifiedDay = source.verifiedAt ? formatDay(source.verifiedAt) : null;
  const sourceSuffix =
    source.freshness === "recent"
      ? `as recorded ${verifiedDay}`
      : source.freshness === "stale"
        ? `as recorded ${verifiedDay}, stale`
        : "as recorded, check date unknown";
  const sourceNote =
    source.freshness === "recent"
      ? `Source checked ${verifiedDay}, within the last 90 days.`
      : source.freshness === "stale"
        ? `Last checked ${verifiedDay}, over 90 days ago. Details may have changed.`
        : "Source check date not recorded. Details may have changed.";

  const reqs =
    row.application_requirements && typeof row.application_requirements === "object" && !Array.isArray(row.application_requirements)
      ? (row.application_requirements as Record<string, unknown>)
      : {};
  const items: ChecklistItem[] = [];
  const add = (item: Omit<ChecklistItem, "sourceSuffix" | "detail" | "href"> & Partial<Pick<ChecklistItem, "detail" | "href">>) =>
    items.push({ detail: null, href: null, ...item, sourceSuffix });

  // 1. Separate application
  const separate = reqs.separate_application_required;
  const mode = typeof reqs.application_mode === "string" && reqs.application_mode.trim() ? normalise(reqs.application_mode) : null;
  add({
    key: "separate-application",
    kind: "separate-application",
    ...(separate === true
      ? { label: "A separate scholarship application is required (recorded)", state: "recorded" as const, source: RECORDED }
      : separate === false
        ? { label: "No separate application is required (recorded)", state: "recorded" as const, source: RECORDED }
        : { label: "Not recorded whether a separate application is needed", state: "not-recorded" as const, source: PROVIDER }),
    detail: mode ? `Recorded application mode: ${mode}` : null,
  });

  // 2. Essay (never inferred from drafts in CAAT)
  add({
    key: "essay",
    kind: "essay",
    ...(row.requires_essay === true
      ? { label: "An essay is required (recorded)", state: "recorded" as const, source: RECORDED }
      : row.requires_essay === false
        ? { label: "No essay is required (recorded)", state: "recorded" as const, source: RECORDED }
        : { label: "Not recorded whether an essay is required", state: "not-recorded" as const, source: PROVIDER }),
  });

  // 3. Closing date
  const deadline = validDate(row.deadline_at);
  add({
    key: "deadline",
    kind: "deadline",
    ...(!deadline
      ? { label: "No closing date recorded", state: "not-recorded" as const, source: PROVIDER }
      : deadline.getTime() >= now.getTime()
        ? { label: `Closes ${formatDay(row.deadline_at!)} (recorded)`, state: "recorded" as const, source: RECORDED }
        : {
            label: `The recorded closing date (${formatDay(row.deadline_at!)}) has passed. Check whether it has reopened.`,
            state: "passed" as const,
            source: RECORDED,
          }),
  });

  // 4. Official page
  add({
    key: "official-link",
    kind: "official-link",
    ...(source.sourceUrl
      ? { label: "Read the official scholarship page", state: "recorded" as const, source: RECORDED, href: source.sourceUrl }
      : { label: "No safe official link recorded", state: "not-recorded" as const, source: PROVIDER }),
  });

  // 5. Recorded rules: must_meet, then eligibility_text, then the summary, each once.
  const extra = typeof reqs.eligibility_text === "string" && reqs.eligibility_text.trim() ? [normalise(reqs.eligibility_text)] : [];
  const summary = row.eligibility_summary?.trim() ? [normalise(row.eligibility_summary)] : [];
  const seen = new Set<string>();
  for (const text of [...strings(reqs.must_meet), ...extra, ...summary]) {
    if (seen.has(text)) continue;
    seen.add(text);
    add({ key: ruleKey(text), kind: "rule", label: `Recorded rule: ${text}`, state: "recorded", source: PROVIDER });
  }

  return {
    items,
    freshness: source.freshness,
    verifiedAt: source.verifiedAt,
    staleLabel: source.freshness === "stale" ? `Last checked ${verifiedDay}` : null,
    sourceNote,
    inactive: row.is_active === false,
    recordedInstitution: row.school_name?.trim() ? row.school_name.trim() : null,
  };
}
