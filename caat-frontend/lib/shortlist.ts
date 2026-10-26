/**
 * My shortlist (PROD-74): one view over everything a student has saved.
 * Reads the existing bookmark tables; nothing is copied or moved.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationStatus } from "@/types/applications";
import type { ScholarshipStatus } from "@/lib/scholarship-tracking";
import { removeCourseBookmark } from "@/lib/course-bookmarks";

export interface ShortlistScholarship {
  /** Current catalogue availability; older cached snapshots may omit it. */
  active?: boolean;
  id: string;
  title: string;
  provider: string | null;
  amount: string | null;
  deadlineAt: string | null;
  status: ScholarshipStatus;
  /** PROD-77: the owner's application this saved scholarship is attached to. */
  attachedTo?: { schoolId: number; schoolName: string; applicationId: string } | null;
}

export interface ShortlistSchool {
  id: number;
  name: string;
  country: string | null;
  application: { id: string; status: ApplicationStatus } | null;
}

export interface ShortlistMajor {
  id: string;
  name: string;
  category: string | null;
}

export interface ShortlistCourse {
  id: string;
  name: string;
  institutionName: string;
  campus: string | null;
  active: boolean;
  sourceUrl: string | null;
  /** The catalogue's linked university (PROD-148); null means not linked in CAAT. */
  schoolId: number | null;
  /** The owner's application at that university, if one exists. */
  application: { id: string; status: ApplicationStatus } | null;
}

export interface Shortlist {
  courses: ShortlistCourse[];
  scholarships: ShortlistScholarship[];
  schools: ShortlistSchool[];
  majors: ShortlistMajor[];
}

type Row = Record<string, unknown>;

export async function loadShortlist(supabase: SupabaseClient, userId: string, signal: AbortSignal = new AbortController().signal): Promise<Shortlist> {
  const [schRes, schoolRes, majorRes, appRes, courseRes] = await Promise.all([
    supabase
      .from("user_bookmarked_scholarships")
      .select("scholarship_id, status, school_id, created_at, schools(name), scholarships(id, title, provider_name, amount_display, deadline_at, is_active)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }).abortSignal(signal),
    supabase
      .from("user_bookmarked_schools")
      .select("school_id, created_at, schools(id, name, country)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }).abortSignal(signal),
    supabase
      .from("user_bookmarked_majors")
      .select("major_id, created_at, majors(id, name, category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }).abortSignal(signal),
    supabase.from("user_school_applications").select("id, school_id, status").eq("user_id", userId).abortSignal(signal),
    supabase.from("user_course_bookmarks").select("course_id, created_at, course_offerings(id, name, institution_name, campus, active, source_url, school_id)").eq("user_id", userId).order("created_at", { ascending: false }).abortSignal(signal),
  ]);
  for (const res of [schRes, schoolRes, majorRes, appRes, courseRes]) {
    if (res.error) throw new Error("Could not load your shortlist");
  }

  const appsBySchool = new Map<number, { id: string; status: ApplicationStatus }>();
  for (const a of (appRes.data ?? []) as Row[]) {
    appsBySchool.set(Number(a.school_id), { id: a.id as string, status: a.status as ApplicationStatus });
  }

  // Only an attachment to one of the owner's own applications is shown.
  const attachmentFor = (r: Row): ShortlistScholarship["attachedTo"] => {
    const schoolId = typeof r.school_id === "number" ? r.school_id : null;
    const app = schoolId === null ? undefined : appsBySchool.get(schoolId);
    const name = (r.schools as Row | null)?.name;
    return schoolId !== null && app && typeof name === "string" ? { schoolId, schoolName: name, applicationId: app.id } : null;
  };

  return {
    courses: ((courseRes.data ?? []) as Row[]).flatMap(r => {
      const c = r.course_offerings as Row | null;
      if (!c) return [];
      const schoolId = typeof c.school_id === 'number' && Number.isSafeInteger(c.school_id) && c.school_id > 0 ? c.school_id : null;
      return [{ id: c.id as string, name: c.name as string, institutionName: c.institution_name as string, campus: (c.campus as string | null) ?? null, active: c.active === true, sourceUrl: (c.source_url as string | null) ?? null, schoolId, application: schoolId === null ? null : appsBySchool.get(schoolId) ?? null }];
    }),
    scholarships: ((schRes.data ?? []) as Row[]).flatMap((r) => {
      const s = r.scholarships as Row | null;
      if (!s) return [];
      return [{
        id: s.id as string,
        title: s.title as string,
        active: s.is_active === true,
        provider: (s.provider_name as string | null) ?? null,
        amount: (s.amount_display as string | null) ?? null,
        deadlineAt: (s.deadline_at as string | null) ?? null,
        status: ((r.status as ScholarshipStatus | null) ?? "interested") as ScholarshipStatus,
        attachedTo: attachmentFor(r),
      }];
    }),
    schools: ((schoolRes.data ?? []) as Row[]).flatMap((r) => {
      const s = r.schools as Row | null;
      if (!s) return [];
      const id = Number(s.id);
      return [{ id, name: s.name as string, country: (s.country as string | null) ?? null, application: appsBySchool.get(id) ?? null }];
    }),
    majors: ((majorRes.data ?? []) as Row[]).flatMap((r) => {
      const m = r.majors as Row | null;
      if (!m) return [];
      return [{ id: m.id as string, name: m.name as string, category: (m.category as string | null) ?? null }];
    }),
  };
}

export type ShortlistKind = "scholarship" | "school" | "major" | "course";

const TABLE: Record<ShortlistKind, { table: string; column: string }> = {
  course: { table: "user_course_bookmarks", column: "course_id" },
  scholarship: { table: "user_bookmarked_scholarships", column: "scholarship_id" },
  school: { table: "user_bookmarked_schools", column: "school_id" },
  major: { table: "user_bookmarked_majors", column: "major_id" },
};

/** Remove a saved item. Legacy kinds are idempotent: already removed counts as
 *  removed. Courses must prove the owner's row was actually deleted. */
export async function removeFromShortlist(
  supabase: SupabaseClient,
  userId: string,
  kind: ShortlistKind,
  id: string | number,
): Promise<void> {
  if (kind === "course") {
    try { return await removeCourseBookmark(supabase, userId, String(id)); }
    catch (cause) { throw new Error("Could not remove it. Please try again.", { cause }); }
  }
  const { table, column } = TABLE[kind];
  const { error } = await supabase.from(table).delete().eq("user_id", userId).eq(column, id);
  if (error) throw new Error("Could not remove it. Please try again.");
}
