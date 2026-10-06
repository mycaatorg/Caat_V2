import { supabase } from "@/lib/supabase/client";
import { sanitizeError } from "@/lib/safe-error";
import { isSubmittedStatus, type ApplicationRow, type ApplicationStatus } from "@/types/applications";
import type { ScholarshipRow } from "@/types/scholarships";
import type { ProfileRow } from "@/types/profile";
import { matchScholarship } from "@/lib/profile-match";
import { fetchTrackedForSchool, type TrackedScholarship } from "@/lib/scholarship-tracking";
import { assertApplicationWritten } from "@/app/(main)/applications/api";

/**
 * Per-school application hub data. Aggregates everything a student needs for
 * one school in one place: status + deadline, a readiness rollup, their essay
 * drafts, their document vault status, and scholarships matched to the
 * school's country. All client-side via the browser supabase client, matching
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

export interface ReadinessSignals {
  deadlineSet: boolean;
  essayDrafted: boolean;
  keyDocsUploaded: boolean;
  submitted: boolean;
  /** 0-4 */
  score: number;
}

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
  fit: number;
}

export interface ApplicationHub {
  application: ApplicationRow;
  schoolId: number;
  schoolName: string;
  schoolCountry: string | null;
  targetMajor: string | null;
  /** per-application "applying for" majors (names), editable on the hub */
  intendedMajors: string[];
  /** scholarships the student linked to this school, with status (item 5) */
  trackedScholarships: TrackedScholarship[];
  readiness: ReadinessSignals;
  /** per_school prompts, with the draft tagged to THIS school */
  essaysForSchool: EssayLine[];
  /** shared prompts, with the untagged draft */
  essaysShared: EssayLine[];
  /** documents tagged to this school */
  schoolDocuments: SchoolDocLine[];
  /** the standard category checklist, computed from untagged (shared) documents */
  sharedDocuments: DocLine[];
  scholarships: HubScholarship[];
}

const KEY_DOC_CATEGORIES: { category: string; label: string }[] = [
  { category: "transcripts", label: "Academic transcript" },
  { category: "identity", label: "Passport / ID" },
  { category: "language", label: "Language proficiency" },
  { category: "letters", label: "Recommendation letter" },
];

/** Map a document's verification state to our three buckets. The documents
 *  table stores a status string; treat anything verified as verified, anything
 *  present-but-not-verified as pending, absent as missing. */
function docStatusFor(rows: { category: string; status: string | null }[], category: string): DocLine["status"] {
  const matches = rows.filter((r) => r.category === category);
  if (matches.length === 0) return "missing";
  if (matches.some((r) => (r.status ?? "").toLowerCase() === "verified")) return "verified";
  return "pending";
}

/** Loose school-name match: lowercase, trim, drop a leading "the ". */
function normaliseSchoolName(n: string): string {
  return n.trim().toLowerCase().replace(/^the\s+/, "");
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
  // documents (+school_id), scholarships in the school's country.
  const [profileRes, promptsRes, draftsRes, docsRes, schRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("nationality, graduation_year, target_majors, preferred_countries")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("essay_prompts").select("id, slug, title, scope, sort_order").order("sort_order"),
    supabase.from("essay_drafts").select("prompt_id, school_id, updated_at").eq("user_id", user.id),
    supabase.from("documents").select("id, file_name, category, status, school_id").eq("user_id", user.id),
    schoolCountry
      ? supabase
          .from("scholarships")
          .select(
            "id, title, provider_name, description, amount_display, country, school_name, tags, citizenships, study_level"
          )
          .eq("country", schoolCountry)
          .limit(80)
      : Promise.resolve({ data: [], error: null }),
  ]);

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
    const isShared = (p.scope ?? "per_school") === "shared";
    const match = drafts
      .filter((d) => d.prompt_id === p.id && (isShared ? d.school_id == null : d.school_id === schoolId))
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

  // Readiness — "shared OR tagged-to-this-school" counts (the chosen rule).
  const deadlineSet = !!application.deadline_at;
  const essayDrafted = drafts.some((d) => d.school_id == null || d.school_id === schoolId);
  const keyDocsUploaded = docRows.some((d) => d.school_id == null || d.school_id === schoolId);
  const submitted = isSubmittedStatus(application.status);
  const readiness: ReadinessSignals = {
    deadlineSet,
    essayDrafted,
    keyDocsUploaded,
    submitted,
    score:
      (deadlineSet ? 1 : 0) + (essayDrafted ? 1 : 0) + (keyDocsUploaded ? 1 : 0) + (submitted ? 1 : 0),
  };

  // Scholarships specific to THIS school. We fetch the country's scholarships
  // then match on a normalised school name (handles e.g. "The University of
  // Melbourne" vs "University of Melbourne"). If none belong to this school,
  // the panel truthfully shows "none yet" rather than other schools' awards.
  let scholarships: HubScholarship[] = [];
  if (!schRes.error && schRes.data) {
    const target = normaliseSchoolName(schoolName);
    const rows = (schRes.data as unknown as ScholarshipRow[]).filter(
      (s) => s.school_name && normaliseSchoolName(s.school_name) === target
    );
    scholarships = rows
      .map((s) => {
        const { score } = matchScholarship((profile as ProfileRow) ?? null, s);
        return {
          id: s.id,
          title: s.title,
          provider: s.provider_name,
          amount: s.amount_display ?? null,
          fit: score,
        };
      })
      .sort((a, b) => b.fit - a.fit)
      .slice(0, 5);
  }

  const trackedScholarships = await fetchTrackedForSchool(schoolName);

  return {
    application,
    schoolId,
    schoolName,
    schoolCountry,
    targetMajor,
    intendedMajors: application.intended_majors ?? [],
    trackedScholarships,
    readiness,
    essaysForSchool,
    essaysShared,
    schoolDocuments,
    sharedDocuments,
    scholarships,
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
