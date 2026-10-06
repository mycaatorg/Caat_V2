import { supabase } from "@/lib/supabase/client";
import { sanitizeError } from "@/lib/safe-error";
import { getClientUserId } from "@/lib/current-user";
import type { ApplicationRow, ApplicationStatus } from "@/types/applications";

// C5: resolve the user id via local JWT claims (getClientUserId) instead of a
// /auth/v1/user network call on every fetcher. Callers only use `.id`.
async function getUser(): Promise<{ id: string }> {
  const id = await getClientUserId();
  if (!id) throw new Error("Not authenticated");
  return { id };
}

/** RLS turns a write to a missing or foreign row into a silent no-op, so a
 *  write must confirm it touched the caller's row before reporting success. */
export function assertApplicationWritten(
  data: unknown[] | null,
  error: Parameters<typeof sanitizeError>[0] | null
): void {
  if (error) throw new Error(sanitizeError(error));
  if (!data || data.length === 0) throw new Error("Application not found");
}

/** A new application defaults its "applying for" majors from the student's
 *  profile (target_majors), which they can then trim per school. */
async function profileMajors(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("target_majors")
    .eq("id", userId)
    .maybeSingle();
  return ((data?.target_majors as string[] | null) ?? []).filter(Boolean);
}

export async function fetchApplications(): Promise<ApplicationRow[]> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .select("*, schools(id, name, country)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(sanitizeError(error));
  return (data ?? []) as unknown as ApplicationRow[];
}

export async function fetchApplicationForSchool(
  schoolId: number
): Promise<ApplicationRow | null> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .select("*, schools(id, name, country)")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error) throw new Error(sanitizeError(error));
  return data as unknown as ApplicationRow | null;
}

export async function addApplication(
  schoolId: number
): Promise<ApplicationRow> {
  const user = await getUser();
  const intended = await profileMajors(user.id);
  const { data, error } = await supabase
    .from("user_school_applications")
    .insert({ user_id: user.id, school_id: schoolId, status: "researching", intended_majors: intended })
    .select("*, schools(id, name, country)")
    .single();
  if (error) throw new Error(sanitizeError(error));
  return data as unknown as ApplicationRow;
}

/** Update the per-application "applying for" majors (stored as names). */
export async function updateApplicationMajors(
  id: string,
  majors: string[]
): Promise<void> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .update({ intended_majors: majors, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  assertApplicationWritten(data, error);
}

export async function updateApplication(
  id: string,
  patch: {
    status?: ApplicationStatus;
    deadline_at?: string | null;
    notes?: string | null;
  }
): Promise<void> {
  const user = await getUser();
  const { data, error } = await supabase
    .from("user_school_applications")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  assertApplicationWritten(data, error);
}

/** Idempotent: a row already removed (e.g. in another tab) is the outcome the
 *  student asked for, so zero deleted rows is not an error. */
export async function deleteApplication(id: string): Promise<void> {
  const user = await getUser();
  const { error } = await supabase
    .from("user_school_applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(sanitizeError(error));
}

/**
 * Number of bookmarked schools the user does NOT yet have an application for.
 * Powers the "Import from Bookmarks" button count badge.
 */
export async function fetchUnimportedBookmarkCount(): Promise<number> {
  const user = await getUser();

  const [bookmarkedRes, appsRes] = await Promise.all([
    supabase
      .from("user_bookmarked_schools")
      .select("school_id")
      .eq("user_id", user.id),
    supabase
      .from("user_school_applications")
      .select("school_id")
      .eq("user_id", user.id),
  ]);

  if (bookmarkedRes.error) throw new Error(bookmarkedRes.error.message);
  if (appsRes.error) throw new Error(appsRes.error.message);

  const existing = new Set((appsRes.data ?? []).map((r) => r.school_id as number));
  return (bookmarkedRes.data ?? []).filter(
    (b) => !existing.has(b.school_id as number)
  ).length;
}

/**
 * Bulk-create 'researching'-status applications for every bookmarked school
 * the user does not already have an application for. Idempotent — schools
 * already tracked are skipped silently.
 */
export async function importBookmarkedSchools(): Promise<{
  added: ApplicationRow[];
  skipped: number;
}> {
  const user = await getUser();

  const [bookmarkedRes, appsRes] = await Promise.all([
    supabase
      .from("user_bookmarked_schools")
      .select("school_id")
      .eq("user_id", user.id),
    supabase
      .from("user_school_applications")
      .select("school_id")
      .eq("user_id", user.id),
  ]);

  if (bookmarkedRes.error) throw new Error(bookmarkedRes.error.message);
  if (appsRes.error) throw new Error(appsRes.error.message);

  const existing = new Set((appsRes.data ?? []).map((r) => r.school_id as number));
  const toInsert = (bookmarkedRes.data ?? [])
    .map((r) => r.school_id as number)
    .filter((id) => !existing.has(id));

  if (toInsert.length === 0) {
    return { added: [], skipped: (bookmarkedRes.data ?? []).length };
  }

  const intended = await profileMajors(user.id);
  const rows = toInsert.map((school_id) => ({
    user_id: user.id,
    school_id,
    status: "researching" as const,
    intended_majors: intended,
  }));

  const { data, error } = await supabase
    .from("user_school_applications")
    .insert(rows)
    .select("*, schools(id, name, country)");

  if (error) throw new Error(sanitizeError(error));

  return {
    added: (data ?? []) as unknown as ApplicationRow[],
    skipped: (bookmarkedRes.data ?? []).length - (data?.length ?? 0),
  };
}

export async function searchSchools(
  query: string
): Promise<{ id: number; name: string; country: string | null }[]> {
  if (!query.trim()) return [];
  // Escape LIKE special characters so user input is treated as a literal string (C2).
  // % and _ are wildcard characters in SQL LIKE/ILIKE; without escaping they allow
  // unintended broad matching (e.g. "%" matches every row).
  const safeQuery = query.replace(/[\\%_]/g, "\\$&");
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, country")
    .ilike("name", `%${safeQuery}%`)
    .order("name", { ascending: true })
    .limit(10);
  if (error) throw new Error(sanitizeError(error));
  return (data ?? []) as { id: number; name: string; country: string | null }[];
}

/**
 * Global readiness signals shared across all applications in v1: whether the
 * user has any essay draft, and any uploaded document. Combined per-card with
 * the application's own deadline + status to render the readiness bar.
 * (Per-school essay/doc tagging in roadmap item 2 will make these per-app.)
 */
export async function fetchGlobalReadinessSignals(): Promise<{
  essayDrafted: boolean;
  keyDocsUploaded: boolean;
}> {
  const user = await getUser();
  const [draftsRes, docsRes] = await Promise.all([
    supabase.from("essay_drafts").select("id").eq("user_id", user.id).limit(1),
    supabase.from("documents").select("id").eq("user_id", user.id).limit(1),
  ]);
  return {
    essayDrafted: (draftsRes.data ?? []).length > 0,
    keyDocsUploaded: (docsRes.data ?? []).length > 0,
  };
}
