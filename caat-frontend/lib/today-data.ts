/**
 * Server-side loader for the Today view (PROD-74). One round of parallel
 * owner-scoped reads; essay and document contents are never selected.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchUnifiedDeadlines } from "@/lib/unified-deadlines";
import type { ApplicationStatus } from "@/types/applications";
import type { TodayApplication, TodayInput } from "@/lib/today";

export const DEFAULT_TIME_ZONE = "Australia/Sydney";
export const TIME_ZONE_COOKIE = "caat-tz";

/** The student's IANA time zone (reported by their browser in a cookie), or
 *  Sydney when unknown or invalid. The server runs in UTC; students do not. */
export function resolveTimeZone(value: string | null | undefined): string {
  if (!value) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Today's date (YYYY-MM-DD) in the given time zone. */
export function zonedTodayISO(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function zonedHour(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-AU", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
}

export const sydneyTodayISO = (now: Date = new Date()) => zonedTodayISO(DEFAULT_TIME_ZONE, now);
export const sydneyHour = (now: Date = new Date()) => zonedHour(DEFAULT_TIME_ZONE, now);

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
  kind: "scholarship" | "school" | "major" | "course";
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

/** View all needs more than the overview's first six tasks. Read bounded
 * pages with a stable tie-breaker; any failed page invalidates the whole list. */
async function loadOpenTodos(supabase: SupabaseClient, userId: string) {
  const pageSize = 200;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("user_todos")
      .select("id, text, due_date, priority")
      .eq("user_id", userId)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Could not load Today", { cause: error });
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

export async function loadToday(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<TodayData> {
  const todayISO = zonedTodayISO(timeZone, now);
  const [profileRes, appsRes, draftsRes, docsRes, savedSchRes, savedSchoolRes, savedMajorRes, savedCourseRes, todos, resumesRes, promptsRes, customRes, deadlines] =
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
      supabase.from("documents").select("category, school_id").eq("user_id", userId),
      supabase
        .from("user_bookmarked_scholarships")
        .select("scholarship_id, status, created_at, scholarships(id, title)")
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
      supabase.from("user_course_bookmarks").select("course_id, created_at, course_offerings(id, name, institution_name)").eq("user_id", userId).order("created_at", { ascending: false }),
      loadOpenTodos(supabase, userId),
      supabase
        .from("resumes")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1),
      supabase.from("essay_prompts").select("id, title, scope"),
      supabase.from("custom_essay_prompts").select("id, title").eq("user_id", userId),
      fetchUnifiedDeadlines(supabase, userId),
    ]);

  // A failed read must not look like an empty account (that would tell a
  // student with applications to "save your first scholarship").
  // The prompt catalogue decides which drafts count for which school, so a
  // failed read would turn into wrong "start an essay" tasks.
  for (const res of [profileRes, appsRes, draftsRes, docsRes, savedSchRes, savedSchoolRes, savedMajorRes, savedCourseRes, promptsRes]) {
    if (res.error) throw new Error("Could not load Today");
  }

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
  const savedCourses = (savedCourseRes.data ?? []) as Row[];
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
      // The editor opens the prompt's current draft, so do not name one.
      detail: "Essay",
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

  // The newest course save (query is newest first) takes one slot; legacy kinds
  // keep their previous scholarships, universities, majors order.
  const newestCourse = savedCourses.flatMap(r => {
    const c = r.course_offerings as { id: string; name: string; institution_name: string } | null;
    return c ? [{ kind: "course" as const, id: c.id, title: `${c.name} — ${c.institution_name}`, href: `/courses?course=${encodeURIComponent(c.id)}` }] : [];
  }).slice(0, 1);
  const savedPreview: SavedPreview[] = [
    ...newestCourse,
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
      // The hub's preparation-checklist inputs (lib/preparation-checklist).
      preparation: {
        prompts: ((promptsRes.data ?? []) as Row[]).map((p) => ({
          id: p.id as string,
          scope: (p.scope as string | null) ?? null,
        })),
        drafts: drafts.map((d) => ({
          prompt_id: d.prompt_id as string,
          school_id: (d.school_id as number | null) ?? null,
        })),
        documents: ((docsRes.data ?? []) as Row[]).map((d) => ({
          category: d.category as string,
          school_id: (d.school_id as number | null) ?? null,
        })),
      },
      saved: { scholarships: savedSch.length, schools: savedSchools.length, majors: savedMajors.length, courses: savedCourses.length },
      deadlines,
      scholarshipStatuses: Object.fromEntries(savedSch.map((r) => [r.scholarship_id as string, (r.status as string | null) ?? "interested"])),
    },
    recent,
    todos: todos.map((t) => ({
      id: t.id as string,
      text: t.text as string,
      dueDate: (t.due_date as string | null) ?? null,
      priority: (t.priority as number | null) ?? 2,
    })),
    savedPreview,
  };
}
