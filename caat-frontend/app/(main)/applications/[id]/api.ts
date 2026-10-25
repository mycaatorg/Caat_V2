import { supabase } from "@/lib/supabase/client";
import { sanitizeError } from "@/lib/safe-error";
import type { ApplicationRow, ApplicationStatus } from "@/types/applications";
import type { ScholarshipRow } from "@/types/scholarships";
import type { ProfileRow } from "@/types/profile";
import {
  fetchPrepChecks,
  fetchSavedScholarshipsForHub,
  type SavedScholarshipForHub,
} from "@/lib/scholarship-tracking";
import { assertApplicationWritten } from "@/app/(main)/applications/api";
import { normalizeHubCourse, type HubCourse } from "@/lib/course-data";
import { readEvidenceLinks, type EvidenceLink } from "@/lib/evidence-links";

export type { HubCourse };
import {
  KEY_DOC_CATEGORIES,
  draftCountsFor,
  isSharedPrompt,
  preparationFor,
  type PreparationChecklist,
} from "@/lib/preparation-checklist";

/**
 * Per-school application hub data. Aggregates everything a student needs for
 * one school in one place: status + deadline, a readiness rollup, their essay
 * drafts, their document vault status, and the active scholarships recorded
 * for this university. All client-side via the browser supabase client, matching
 * the applications list.
 */

async function getUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return user;
}

/** The hub's preparation checklist (shared rule: lib/preparation-checklist). */
export type ReadinessSignals = PreparationChecklist;

export interface EssayLine {
  promptId: string;
  promptSlug: string;
  title: string;
  status: "drafted" | "to-write";
  lastEdited: string | null;
}

export interface DocLine {
  label: string;
  category: string;
  status: "verified" | "pending" | "missing";
}

export interface SchoolDocLine {
  id: string;
  fileName: string;
  status: "verified" | "pending" | "missing";
}

export interface HubScholarship {
  id: string;
  title: string;
  provider: string;
  amount: string | null;
  deadline: string | null;
}

export interface ApplicationHub {
  application: ApplicationRow;
  schoolId: number;
  schoolName: string;
  schoolCountry: string | null;
  targetMajor: string | null;
  /** per-application "applying for" majors (names), editable on the hub */
  intendedMajors: string[];
  /** PROD-77: all of the caller's saved scholarships, with attachment and the
   *  recorded fields their checklists need (owner-only read) */
  savedScholarships: SavedScholarshipForHub[];
  /** true when that read failed: the card shows Retry, never "none saved" */
  savedScholarshipsUnavailable: boolean;
  /** PROD-77: the caller's preparation ticks, by scholarship id */
  prepChecks: Record<string, string[]>;
  prepChecksUnavailable: boolean;
  readiness: ReadinessSignals;
  /** per_school prompts, with the draft tagged to THIS school */
  essaysForSchool: EssayLine[];
  /** shared prompts, with the untagged draft */
  essaysShared: EssayLine[];
  /** documents tagged to this school */
  schoolDocuments: SchoolDocLine[];
  /** the standard category checklist, computed from untagged (shared) documents */
  sharedDocuments: DocLine[];
  /** active scholarships recorded for this university, soonest deadline first */
  scholarships: HubScholarship[];
  /** true when the catalogue read failed, so the panel must not say "none" */
  scholarshipsUnavailable: boolean;
  /** PROD-148: the caller's saved courses whose offering is at this university */
  savedCourses: HubCourse[];
  /** true when that read failed, so the card shows Retry rather than "none saved" */
  savedCoursesUnavailable: boolean;
  /** PROD-78: library documents linked to this application (owner-only read).
   *  Not a preparation step: they never change the 3-step checklist. */
  evidenceLinks: EvidenceLink[];
  /** true when that read failed, so the card shows Retry rather than "none linked" */
  evidenceLinksUnavailable: boolean;
}

export const HUB_SCHOLARSHIP_LIMIT = 5;
const HUB_SCHOLARSHIP_COLUMNS = "id, title, provider_name, amount_display, deadline_at";

type ScholarshipQueryResult = { data: unknown[] | null; error: unknown };
type HubScholarshipRow = Pick<ScholarshipRow, "id" | "title" | "provider_name" | "amount_display" | "deadline_at">;

/**
 * Open, active scholarships for one university, from the public catalogue.
 *
 * The scholarship_schools junction is the primary link. When it holds no open
 * row for this school, fall back to the school page's name match
 * (SchoolScholarshipsSection): school_name or provider_name containing the
 * school's name, case-insensitive, with a leading "The" dropped. The value is
 * double-quoted so commas and parentheses in a name stay literal, and embedded
 * quotes and backslashes are stripped so they cannot break out.
 *
 * Both reads keep only scholarships with no deadline or one not yet passed
 * (as the welcome flow does), order by deadline (undated last) then title,
 * and are capped, so the result is stable.
 */
async function fetchSchoolScholarships(
  schoolId: number,
  schoolName: string | null
): Promise<{ rows: HubScholarshipRow[]; error: boolean }> {
  const open = `deadline_at.is.null,deadline_at.gte.${new Date().toISOString()}`;
  const linked = (await supabase
    .from("scholarships")
    .select(`${HUB_SCHOLARSHIP_COLUMNS}, scholarship_schools!inner(school_id)`)
    .eq("scholarship_schools.school_id", schoolId)
    .eq("is_active", true)
    .or(open)
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(HUB_SCHOLARSHIP_LIMIT)) as ScholarshipQueryResult;
  if (linked.error) return { rows: [], error: true };
  const name = (schoolName ?? "").replace(/^\s*the\s+/i, "").replace(/["\\]/g, "").trim();
  if ((linked.data ?? []).length > 0 || !name) {
    return { rows: (linked.data ?? []) as HubScholarshipRow[], error: false };
  }

  const named = (await supabase
    .from("scholarships")
    .select(HUB_SCHOLARSHIP_COLUMNS)
    .eq("is_active", true)
    .or(open)
    .or(`school_name.ilike."%${name}%",provider_name.ilike."%${name}%"`)
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .order("title", { ascending: true })
    .limit(HUB_SCHOLARSHIP_LIMIT)) as ScholarshipQueryResult;
  if (named.error) return { rows: [], error: true };
  return { rows: (named.data ?? []) as HubScholarshipRow[], error: false };
}

const SAVED_COURSE_COLUMNS =
  "course_id, course_offerings!inner(id, name, campus, application_route, application_url, source_url, verified_at, active, school_id, prerequisites, prerequisites_url, assumed_knowledge, source_year)";

/** Owner-scoped read of the caller's saved courses at one university. Throws on
 *  a read error so the caller can show "unavailable", never an empty list. */
async function readSavedCourses(userId: string, schoolId: number): Promise<HubCourse[]> {
  const courses: HubCourse[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("user_course_bookmarks")
      .select(SAVED_COURSE_COLUMNS)
      .eq("user_id", userId)
      .eq("course_offerings.school_id", schoolId)
      .order("course_id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Could not load your saved courses");
    for (const row of (data ?? []) as { course_offerings: unknown }[]) {
      const course = normalizeHubCourse(row.course_offerings);
      if (!course) throw new Error("Could not load your saved courses");
      courses.push(course);
    }
    if (!data || data.length < pageSize) return courses;
  }
}

/** The scholarships card's own Retry: re-reads saved scholarships and ticks. */
export async function fetchHubScholarshipAttachments(): Promise<
  Pick<ApplicationHub, "savedScholarships" | "savedScholarshipsUnavailable" | "prepChecks" | "prepChecksUnavailable">
> {
  const [saved, ticks] = await Promise.allSettled([fetchSavedScholarshipsForHub(), fetchPrepChecks()]);
  return {
    savedScholarships: saved.status === "fulfilled" ? saved.value : [],
    savedScholarshipsUnavailable: saved.status !== "fulfilled",
    prepChecks: ticks.status === "fulfilled" ? ticks.value : {},
    prepChecksUnavailable: ticks.status !== "fulfilled",
  };
}

/** The hub card's own Retry: re-reads only the saved courses. */
export async function fetchSavedCoursesForSchool(schoolId: number): Promise<HubCourse[]> {
  const user = await getUser();
  return readSavedCourses(user.id, schoolId);
}

/** Map a document's verification state to our three buckets. The documents
 *  table stores a status string; treat anything verified as verified, anything
 *  present-but-not-verified as pending, absent as missing. */
function docStatusFor(rows: { category: string; status: string | null }[], category: string): DocLine["status"] {
  const matches = rows.filter((r) => r.category === category);
  if (matches.length === 0) return "missing";
  if (matches.some((r) => (r.status ?? "").toLowerCase() === "verified")) return "verified";
  return "pending";
}

export async function fetchApplicationHub(applicationId: string): Promise<ApplicationHub> {
  const user = await getUser();

  const { data: appData, error: appErr } = await supabase
    .from("user_school_applications")
    .select("*, schools(id, name, country)")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (appErr) throw new Error(sanitizeError(appErr));
  if (!appData) throw new Error("Application not found");
  const application = appData as unknown as ApplicationRow;
  const school = (appData as unknown as { schools: { name: string; country: string | null } }).schools;
  const schoolId = application.school_id;
  const schoolName = school?.name ?? "This school";
  const schoolCountry = school?.country ?? null;

  // Parallel: profile, prompts (+scope), all essay drafts (+school_id), all
  // documents (+school_id), active scholarships recorded for this school.
  const [profileRes, promptsRes, draftsRes, docsRes, schRes, coursesRes, savedSchRes, ticksRes, linksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("target_majors")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("essay_prompts").select("id, slug, title, scope, sort_order").order("sort_order"),
    supabase.from("essay_drafts").select("prompt_id, school_id, updated_at").eq("user_id", user.id),
    supabase.from("documents").select("id, file_name, category, status, school_id").eq("user_id", user.id),
    fetchSchoolScholarships(schoolId, school?.name ?? null),
    readSavedCourses(user.id, schoolId).then(
      (courses) => ({ courses, unavailable: false }),
      () => ({ courses: [] as HubCourse[], unavailable: true }),
    ),
    // PROD-77: saved scholarships (attached, suggestions, dialog) and ticks.
    fetchSavedScholarshipsForHub().then(
      (rows) => ({ rows, unavailable: false }),
      () => ({ rows: [] as SavedScholarshipForHub[], unavailable: true }),
    ),
    fetchPrepChecks().then(
      (checks) => ({ checks, unavailable: false }),
      () => ({ checks: {} as Record<string, string[]>, unavailable: true }),
    ),
    // PROD-78: library documents linked here (and their tailoring).
    readEvidenceLinks(user.id, application.id).then(
      (links) => ({ links, unavailable: false }),
      () => ({ links: [] as EvidenceLink[], unavailable: true }),
    ),
  ]);

  // The prompt catalogue decides which drafts count for this school (a draft
  // whose prompt is not in it is treated as a custom prompt), so a failed
  // read must not silently become a wrong checklist.
  if (promptsRes.error) throw new Error(sanitizeError(promptsRes.error));

  const profile = (profileRes.data as Partial<ProfileRow> | null) ?? null;
  const targetMajor = profile?.target_majors?.[0] ?? null;

  const prompts = (promptsRes.data ?? []) as {
    id: string;
    slug: string;
    title: string;
    scope: string | null;
  }[];
  const drafts = (draftsRes.data ?? []) as {
    prompt_id: string;
    school_id: number | null;
    updated_at: string | null;
  }[];
  const docRows = (docsRes.data ?? []) as {
    id: string;
    file_name: string;
    category: string;
    status: string | null;
    school_id: number | null;
  }[];

  // Essays — grouped by prompt scope. per_school prompts surface the draft
  // tagged to THIS school; shared prompts surface the untagged draft.
  const essaysForSchool: EssayLine[] = [];
  const essaysShared: EssayLine[] = [];
  for (const p of prompts) {
    const isShared = isSharedPrompt(p);
    const match = drafts
      .filter((d) => draftCountsFor(p, d, schoolId))
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
    const line: EssayLine = {
      promptId: p.id,
      promptSlug: p.slug,
      title: p.title,
      status: match ? "drafted" : "to-write",
      lastEdited: match?.updated_at ?? null,
    };
    (isShared ? essaysShared : essaysForSchool).push(line);
  }

  // Documents — tagged-to-this-school list, plus the shared category checklist.
  const schoolDocRows = docRows.filter((d) => d.school_id === schoolId);
  const sharedDocRows = docRows.filter((d) => d.school_id == null);
  const schoolDocuments: SchoolDocLine[] = schoolDocRows.map((d) => ({
    id: d.id,
    fileName: d.file_name,
    status: (d.status ?? "").toLowerCase() === "verified" ? "verified" : "pending",
  }));
  const sharedDocuments: DocLine[] = KEY_DOC_CATEGORIES.map((d) => ({
    label: d.label,
    category: d.category,
    status: docStatusFor(sharedDocRows, d.category),
  }));

  // Preparation checklist: the shared rule the applications list and the
  // dashboard summary also use, so all three agree. It matches the essay and
  // document lines above (same per-school/shared draft rule, same key
  // categories), and the application's status is not a step.
  const readiness: ReadinessSignals = preparationFor(application, { prompts, drafts, documents: docRows });

  // Open, active scholarships recorded for THIS school, already in deadline-
  // then-title order from the query.
  const scholarships: HubScholarship[] = schRes.rows.map((s) => ({
    id: s.id,
    title: s.title,
    provider: s.provider_name,
    amount: s.amount_display ?? null,
    deadline: s.deadline_at ?? null,
  }));

  return {
    application,
    schoolId,
    schoolName,
    schoolCountry,
    targetMajor,
    intendedMajors: application.intended_majors ?? [],
    savedScholarships: savedSchRes.rows,
    savedScholarshipsUnavailable: savedSchRes.unavailable,
    prepChecks: ticksRes.checks,
    prepChecksUnavailable: ticksRes.unavailable,
    readiness,
    essaysForSchool,
    essaysShared,
    schoolDocuments,
    sharedDocuments,
    scholarships,
    scholarshipsUnavailable: schRes.error,
    savedCourses: coursesRes.courses,
    savedCoursesUnavailable: coursesRes.unavailable,
    evidenceLinks: linksRes.links,
    evidenceLinksUnavailable: linksRes.unavailable,
  };
}

/** All major names, for the "applying for" combobox suggestions. */
export async function fetchMajorOptions(): Promise<string[]> {
  const { data } = await supabase.from("majors").select("name").order("name");
  return ((data ?? []) as { name: string }[]).map((m) => m.name);
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus
): Promise<void> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  assertApplicationWritten(data, error);
}

export async function updateApplicationDeadline(
  id: string,
  deadline_at: string | null
): Promise<void> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .update({ deadline_at, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  assertApplicationWritten(data, error);
}
