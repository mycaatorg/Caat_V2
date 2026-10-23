// (data layer — see fetch/set functions below)
import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";
import { ITEM_KEY_PATTERN, type ChecklistScholarship } from "@/lib/requirements-checklist";

/**
 * Roadmap item 5: a status lifecycle + optional school link for the
 * scholarships a student tracks (their bookmarks). Status lives on
 * user_bookmarked_scholarships; school_id optionally links a scholarship to
 * one of the student's applications so it surfaces in that school's hub.
 */

export type ScholarshipStatus = "interested" | "applied" | "awarded" | "not_selected";

export const SCHOLARSHIP_STATUSES: ScholarshipStatus[] = [
  "interested",
  "applied",
  "awarded",
  "not_selected",
];

export const SCHOLARSHIP_STATUS_LABELS: Record<ScholarshipStatus, string> = {
  interested: "Interested",
  applied: "Applied",
  awarded: "Awarded",
  not_selected: "Not selected",
};

export interface BookmarkTracking {
  status: ScholarshipStatus;
  school_id: number | null;
}

// C5: local JWT claims instead of a /auth/v1/user round trip per call.
async function getUserId(): Promise<string | null> {
  return getClientUserId();
}

/** scholarshipId -> { status, school_id } for the scholarships list. */
export async function fetchBookmarkTracking(): Promise<Map<string, BookmarkTracking>> {
  const userId = await getUserId();
  const map = new Map<string, BookmarkTracking>();
  if (!userId) return map;
  const { data } = await supabase
    .from("user_bookmarked_scholarships")
    .select("scholarship_id, status, school_id")
    .eq("user_id", userId);
  for (const r of (data ?? []) as { scholarship_id: string; status: string | null; school_id: number | null }[]) {
    map.set(r.scholarship_id, {
      status: (r.status as ScholarshipStatus) ?? "interested",
      school_id: r.school_id ?? null,
    });
  }
  return map;
}

/** Start (or update) tracking a scholarship at a given status. Upserts the
 *  row, so it works whether or not the scholarship was already bookmarked —
 *  tracking and bookmarking are one concept. */
export async function trackScholarship(scholarshipId: string, status: ScholarshipStatus): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("user_bookmarked_scholarships")
    .upsert({ user_id: userId, scholarship_id: scholarshipId, status }, { onConflict: "user_id,scholarship_id" })
    .select("status");
  if (error) throw new Error(error.message);
  // PROD-150: defensive. A plain update blocked by row security returns no
  // error and no rows, so only a returned row at the new status counts as saved.
  const rows = (data ?? []) as { status: string | null }[];
  if (rows.length !== 1 || rows[0].status !== status) {
    throw new Error("Scholarship status was not saved.");
  }
}

/** Stop tracking a scholarship (removes the bookmark row entirely). */
export async function untrackScholarship(scholarshipId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("user_bookmarked_scholarships")
    .delete()
    .eq("user_id", userId)
    .eq("scholarship_id", scholarshipId);
  if (error) throw new Error(error.message);
}

export interface TrackedScholarship {
  id: string;
  title: string;
  provider: string;
  amount: string | null;
  status: ScholarshipStatus;
}

function normaliseSchoolName(n: string): string {
  return n.trim().toLowerCase().replace(/^the\s+/, "");
}

/** Scholarships the student is tracking that belong to a given school, matched
 *  on the scholarship's scraped school_name (no manual linking needed). */
export async function fetchTrackedForSchool(schoolName: string): Promise<TrackedScholarship[]> {
  const userId = await getUserId();
  if (!userId || !schoolName) return [];
  const { data } = await supabase
    .from("user_bookmarked_scholarships")
    .select("status, scholarships(id, title, provider_name, amount_display, school_name)")
    .eq("user_id", userId);
  const target = normaliseSchoolName(schoolName);
  const rows = (data ?? []) as unknown as {
    status: string | null;
    scholarships: {
      id: string;
      title: string;
      provider_name: string;
      amount_display: string | null;
      school_name: string | null;
    } | null;
  }[];
  return rows
    .filter((r) => r.scholarships?.school_name && normaliseSchoolName(r.scholarships.school_name) === target)
    .map((r) => ({
      id: r.scholarships!.id,
      title: r.scholarships!.title,
      provider: r.scholarships!.provider_name,
      amount: r.scholarships!.amount_display ?? null,
      status: (r.status as ScholarshipStatus) ?? "interested",
    }));
}

// ---------------------------------------------------------------------------
// PROD-77 (minimal): attach a saved scholarship to one of the student's
// applications (user_bookmarked_scholarships.school_id), and preparation ticks
// for its requirements checklist. Every read and write is owner-filtered here
// and by row security; the database only accepts a school_id the student has
// an application for, and deleting that application detaches it.
// ---------------------------------------------------------------------------

export interface SavedScholarshipForHub {
  id: string;
  title: string;
  provider: string;
  amount: string | null;
  status: ScholarshipStatus;
  /** The university this saved scholarship is attached to, if any. */
  schoolId: number | null;
  attachedSchoolName: string | null;
  /** The catalogue's recorded institution name (used only to suggest). */
  scholarshipSchoolName: string | null;
  checklist: ChecklistScholarship;
}

const HUB_SAVED_COLUMNS =
  "scholarship_id, status, school_id, schools(name), scholarships(id, title, provider_name, amount_display, school_name, requires_essay, deadline_at, external_url, application_requirements, eligibility_summary, last_verified_at, source_last_synced_at, is_active)";

/** All of the caller's saved scholarships with attachment and the recorded
 *  fields the checklist needs. Throws on a read error, never returns [] for it. */
export async function fetchSavedScholarshipsForHub(): Promise<SavedScholarshipForHub[]> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("user_bookmarked_scholarships")
    .select(HUB_SAVED_COLUMNS)
    .eq("user_id", userId);
  if (error) throw new Error("Could not load your saved scholarships");
  const rows = (data ?? []) as unknown as {
    status: string | null;
    school_id: number | null;
    schools: { name: string } | null;
    scholarships: (ChecklistScholarship & { title: string; provider_name: string; amount_display: string | null }) | null;
  }[];
  return rows.flatMap((r) => {
    const s = r.scholarships;
    if (!s) return [];
    return [{
      id: s.id,
      title: s.title,
      provider: s.provider_name,
      amount: s.amount_display ?? null,
      status: (r.status as ScholarshipStatus) ?? "interested",
      schoolId: r.school_id ?? null,
      attachedSchoolName: r.schools?.name ?? null,
      scholarshipSchoolName: s.school_name ?? null,
      checklist: {
        id: s.id,
        requires_essay: s.requires_essay ?? null,
        deadline_at: s.deadline_at ?? null,
        external_url: s.external_url ?? null,
        application_requirements: s.application_requirements ?? null,
        eligibility_summary: s.eligibility_summary ?? null,
        last_verified_at: s.last_verified_at ?? null,
        source_last_synced_at: s.source_last_synced_at ?? null,
        school_name: s.school_name ?? null,
        is_active: s.is_active,
      },
    }];
  });
}

/** A suggestion only: the recorded institution name equals the school's name
 *  (case- and leading-"The"-insensitive). Never attaches anything. */
export function mentionsSchool(recordedName: string | null, schoolName: string): boolean {
  return !!recordedName && !!schoolName && normaliseSchoolName(recordedName) === normaliseSchoolName(schoolName);
}

const ATTACH_FAILED = "Couldn't attach. Make sure you still have this application, then try again.";
const DETACH_FAILED = "Couldn't detach this scholarship. Try again.";

async function writeAttachment(scholarshipId: string, schoolId: number | null, failure: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("user_bookmarked_scholarships")
    .update({ school_id: schoolId })
    .eq("user_id", userId)
    .eq("scholarship_id", scholarshipId)
    .select("scholarship_id, school_id");
  // Row security turns a foreign or missing row into zero rows, and a school
  // without the student's application into an error: both are failures here.
  const rows = (data ?? []) as { scholarship_id: string; school_id: number | null }[];
  if (error || rows.length !== 1 || rows[0].school_id !== schoolId) throw new Error(failure);
}

/** Attach (or move) a saved scholarship to the student's application at schoolId. */
export function attachScholarship(scholarshipId: string, schoolId: number): Promise<void> {
  return writeAttachment(scholarshipId, schoolId, ATTACH_FAILED);
}

/** Detach a saved scholarship from its application. The save itself stays. */
export function detachScholarship(scholarshipId: string): Promise<void> {
  return writeAttachment(scholarshipId, null, DETACH_FAILED);
}

/** The caller's preparation ticks, grouped by scholarship. Throws on error. */
export async function fetchPrepChecks(): Promise<Record<string, string[]>> {
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("user_scholarship_prep_checks")
    .select("scholarship_id, item_key")
    .eq("user_id", userId);
  if (error) throw new Error("Could not load your preparation ticks");
  const out: Record<string, string[]> = {};
  for (const r of (data ?? []) as { scholarship_id: string; item_key: string }[]) {
    (out[r.scholarship_id] ??= []).push(r.item_key);
  }
  return out;
}

/** Tick or untick one checklist item. Preparation only: it changes no status. */
export async function setPrepCheck(scholarshipId: string, itemKey: string, checked: boolean): Promise<void> {
  if (!ITEM_KEY_PATTERN.test(itemKey)) throw new Error("Unknown checklist item");
  const userId = await getUserId();
  if (!userId) throw new Error("Not authenticated");
  if (!checked) {
    const { error } = await supabase
      .from("user_scholarship_prep_checks")
      .delete()
      .eq("user_id", userId)
      .eq("scholarship_id", scholarshipId)
      .eq("item_key", itemKey);
    if (error) throw new Error("Could not save that tick");
    return;
  }
  const { data, error } = await supabase
    .from("user_scholarship_prep_checks")
    .upsert(
      { user_id: userId, scholarship_id: scholarshipId, item_key: itemKey },
      { onConflict: "user_id,scholarship_id,item_key", ignoreDuplicates: true },
    )
    .select("item_key");
  if (error) throw new Error("Could not save that tick");
  if ((data ?? []).length === 1) return;
  // An ignored duplicate returns no row: confirm the tick is really there.
  const check = await supabase
    .from("user_scholarship_prep_checks")
    .select("item_key")
    .eq("user_id", userId)
    .eq("scholarship_id", scholarshipId)
    .eq("item_key", itemKey);
  if (check.error || (check.data ?? []).length !== 1) throw new Error("Could not save that tick");
}
