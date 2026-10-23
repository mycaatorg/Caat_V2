// (data layer — see fetch/set functions below)
import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";

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
  // PROD-150: row security can turn a write into a no-op that returns no
  // error, so only the returned row at the new status counts as saved.
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
