/**
 * Server-side loader for the Today view (PROD-74). One round of parallel
 * owner-scoped reads; essay and document contents are never selected.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchUnifiedDeadlines, type UnifiedDeadline } from "@/lib/unified-deadlines";
import type { ApplicationStatus } from "@/types/applications";
import type { TodayApplication, TodayInput } from "@/lib/today";

/** Today's date in Australia/Sydney: the server runs in UTC, the audience does not. */
export function sydneyTodayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function sydneyHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" }).format(now),
  );
}

export interface RecentWork {
  kind: "essay" | "resume" | "application";
  title: string;
  detail: string;
  href: string;
  updatedAt: string;
}

export interface TodayTodo {
  id: string;
  text: string;
  dueDate: string | null;
  priority: number;
}

export interface SavedPreview {
  kind: "scholarship" | "school" | "major";
  id: string;
  title: string;
  href: string;
}

export interface TodayData {
  firstName: string | null;
  input: TodayInput;
  recent: RecentWork[];
  todos: TodayTodo[];
  savedPreview: SavedPreview[];
}

type Row = Record<string, unknown>;

export async function loadToday(supabase: SupabaseClient, userId: string, now: Date = new Date()): Promise<TodayData> {
  const todayISO = sydneyTodayISO(now);
  const [profileRes, appsRes, draftsRes, docsRes, savedSchRes, savedSchoolRes, savedMajorRes, todosRes, resumesRes, promptsRes, customRes, deadlines] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, year_level, student_status, journey_stage, target_majors, preferred_countries, graduation_year, onboarding_completed_at, onboarding_dismissed_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_school_applications")
        .select("id, school_id, status, deadline_at, updated_at, schools(name)")
        .eq("user_id", userId),
      supabase.from("essay_drafts").select("id, prompt_id, label, school_id, updated_at").eq("user_id", userId),
      supabase.from("documents").select("school_id").eq("user_id", userId),
      supabase
        .from("user_bookmarked_scholarships")
        .select("scholarship_id, created_at, scholarships(id, title)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_bookmarked_schools")
        .select("school_id, created_at, schools(id, name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_bookmarked_majors")
        .select("major_id, created_at, majors(id, name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_todos")
        .select("id, text, due_date, priority")
        .eq("user_id", userId)
        .eq("done", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(6),
      supabase
        .from("resumes")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase.from("essay_prompts").select("id, title"),
      supabase.from("custom_essay_prompts").select("id, title").eq("user_id", userId),
      fetchUnifiedDeadlines(supabase, userId).catch((): UnifiedDeadline[] => []),
    ]);

  const profile = (profileRes.data ?? null) as Row | null;
  const hasBasics = Boolean(
    profile &&
      ((profile.year_level as string | null) || (profile.graduation_year as number | null)) &&
      ((profile.target_majors as string[] | null)?.length || (profile.preferred_countries as string[] | null)?.length),
  );

  const applications: TodayApplication[] = ((appsRes.data ?? []) as Row[]).map((r) => ({
    id: r.id as string,
    schoolId: r.school_id as number,
    schoolName: ((r.schools as { name?: string } | null)?.name ?? "Your university") as string,
    status: r.status as ApplicationStatus,
    deadlineAt: (r.deadline_at as string | null) ?? null,
    updatedAt: (r.updated_at as string | null) ?? null,
  }));

  const drafts = (draftsRes.data ?? []) as Row[];
  const savedSch = (savedSchRes.data ?? []) as Row[];
  const savedSchools = (savedSchoolRes.data ?? []) as Row[];
  const savedMajors = (savedMajorRes.data ?? []) as Row[];

  const promptTitles = new Map<string, string>();
  for (const p of [...((promptsRes.data ?? []) as Row[]), ...((customRes.data ?? []) as Row[])]) {
    promptTitles.set(p.id as string, p.title as string);
  }

  const recent: RecentWork[] = [];
  const latestDraft = [...drafts].sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0];
  if (latestDraft?.updated_at) {
    recent.push({
      kind: "essay",
      title: promptTitles.get(latestDraft.prompt_id as string) ?? "Essay draft",
      detail: (latestDraft.label as string | null) ?? "Draft",
      href: `/essays?prompt=${latestDraft.prompt_id as string}`,
      updatedAt: latestDraft.updated_at as string,
    });
  }
  const resume = ((resumesRes.data ?? []) as Row[])[0];
  if (resume?.updated_at) {
    recent.push({
      kind: "resume",
      title: (resume.title as string | null) || "Resume",
      detail: "Resume",
      href: "/resume-builder",
      updatedAt: resume.updated_at as string,
    });
  }
  const latestApp = [...applications].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  if (latestApp?.updatedAt) {
    recent.push({
      kind: "application",
      title: latestApp.schoolName,
      detail: "Application",
      href: `/applications/${latestApp.id}`,
      updatedAt: latestApp.updatedAt,
    });
  }
  recent.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const savedPreview: SavedPreview[] = [
    ...savedSch.flatMap((r) => {
      const s = r.scholarships as { id: string; title: string } | null;
      return s ? [{ kind: "scholarship" as const, id: s.id, title: s.title, href: `/scholarships/${s.id}` }] : [];
    }),
    ...savedSchools.flatMap((r) => {
      const s = r.schools as { id: number; name: string } | null;
      return s ? [{ kind: "school" as const, id: String(s.id), title: s.name, href: `/schools/${s.id}` }] : [];
    }),
    ...savedMajors.flatMap((r) => {
      const m = r.majors as { id: string; name: string } | null;
      return m ? [{ kind: "major" as const, id: m.id, title: m.name, href: `/majors/${m.id}` }] : [];
    }),
  ].slice(0, 3);

  return {
    firstName: (profile?.first_name as string | null) ?? null,
    input: {
      todayISO,
      onboarding: {
        completed: Boolean(profile?.onboarding_completed_at),
        dismissed: Boolean(profile?.onboarding_dismissed_at),
        hasBasics,
      },
      applications,
      essayDraftSchoolIds: drafts.map((d) => (d.school_id as number | null) ?? null),
      documentSchoolIds: ((docsRes.data ?? []) as Row[]).map((d) => (d.school_id as number | null) ?? null),
      saved: { scholarships: savedSch.length, schools: savedSchools.length, majors: savedMajors.length },
      deadlines,
    },
    recent,
    todos: ((todosRes.data ?? []) as Row[]).map((t) => ({
      id: t.id as string,
      text: t.text as string,
      dueDate: (t.due_date as string | null) ?? null,
      priority: (t.priority as number | null) ?? 2,
    })),
    savedPreview,
  };
}
