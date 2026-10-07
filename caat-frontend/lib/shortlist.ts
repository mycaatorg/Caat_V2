/**
 * My shortlist (PROD-74): one view over everything a student has saved.
 * Reads the existing bookmark tables; nothing is copied or moved.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationStatus } from "@/types/applications";
import type { ScholarshipStatus } from "@/lib/scholarship-tracking";

export interface ShortlistScholarship {
  id: string;
  title: string;
  provider: string | null;
  amount: string | null;
  deadlineAt: string | null;
  status: ScholarshipStatus;
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

export interface Shortlist {
  scholarships: ShortlistScholarship[];
  schools: ShortlistSchool[];
  majors: ShortlistMajor[];
}

type Row = Record<string, unknown>;

export async function loadShortlist(supabase: SupabaseClient, userId: string): Promise<Shortlist> {
  const [schRes, schoolRes, majorRes, appRes] = await Promise.all([
    supabase
      .from("user_bookmarked_scholarships")
      .select("scholarship_id, status, created_at, scholarships(id, title, provider_name, amount_display, deadline_at)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_bookmarked_schools")
      .select("school_id, created_at, schools(id, name, country)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_bookmarked_majors")
      .select("major_id, created_at, majors(id, name, category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("user_school_applications").select("id, school_id, status").eq("user_id", userId),
  ]);
  for (const res of [schRes, schoolRes, majorRes, appRes]) {
    if (res.error) throw new Error("Could not load your shortlist");
  }

  const appsBySchool = new Map<number, { id: string; status: ApplicationStatus }>();
  for (const a of (appRes.data ?? []) as Row[]) {
    appsBySchool.set(Number(a.school_id), { id: a.id as string, status: a.status as ApplicationStatus });
  }

  return {
    scholarships: ((schRes.data ?? []) as Row[]).flatMap((r) => {
      const s = r.scholarships as Row | null;
      if (!s) return [];
      return [{
        id: s.id as string,
        title: s.title as string,
        provider: (s.provider_name as string | null) ?? null,
        amount: (s.amount_display as string | null) ?? null,
        deadlineAt: (s.deadline_at as string | null) ?? null,
        status: ((r.status as ScholarshipStatus | null) ?? "interested") as ScholarshipStatus,
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

export type ShortlistKind = "scholarship" | "school" | "major";

const TABLE: Record<ShortlistKind, { table: string; column: string }> = {
  scholarship: { table: "user_bookmarked_scholarships", column: "scholarship_id" },
  school: { table: "user_bookmarked_schools", column: "school_id" },
  major: { table: "user_bookmarked_majors", column: "major_id" },
};

/** Remove a saved item. Idempotent: already removed counts as removed. */
export async function removeFromShortlist(
  supabase: SupabaseClient,
  userId: string,
  kind: ShortlistKind,
  id: string | number,
): Promise<void> {
  const { table, column } = TABLE[kind];
  const { error } = await supabase.from(table).delete().eq("user_id", userId).eq(column, id);
  if (error) throw new Error("Could not remove it. Please try again.");
}
