/**
 * Unified deadlines — merge user_school_applications, bookmarked
 * scholarships, the student's own scholarships (user_scholarships) and
 * calendar_events into one chronological feed.
 *
 * The fetch and the pure merge are split so the merge can be unit-tested
 * without hitting Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { todayKey } from "@/lib/local-date";

/** "custom" is a scholarship the student added themselves (user_scholarships). */
export type DeadlineSource = "app" | "scholarship" | "custom" | "event";

/** Where students manage the scholarships they added themselves. */
export const CUSTOM_SCHOLARSHIPS_HREF = "/scholarships?view=mine";

export interface UnifiedDeadline {
  id: string;
  source: DeadlineSource;
  title: string;
  dateISO: string;
  href: string;
  timeStart?: string;
  timeEnd?: string;
}

export interface RawAppDeadline {
  id: string;
  school_name: string;
  deadline_at: string;
  status: string;
}
export interface RawScholarshipDeadline {
  id: string;
  title: string;
  deadline_at: string;
}
export interface RawEventDeadline {
  id: string;
  title: string;
  event_date: string;
  time_start?: string | null;
  time_end?: string | null;
}

const HIDDEN_APP_STATUSES = new Set(["withdrawn", "rejected"]);

export function mergeDeadlines(
  apps: RawAppDeadline[],
  scholarships: RawScholarshipDeadline[],
  events: RawEventDeadline[],
  todayISO: string,
  customScholarships: RawScholarshipDeadline[] = []
): UnifiedDeadline[] {
  const merged: UnifiedDeadline[] = [];

  for (const a of apps) {
    if (HIDDEN_APP_STATUSES.has(a.status)) continue;
    if (a.deadline_at < todayISO) continue;
    merged.push({
      id: `app-${a.id}`,
      source: "app",
      title: a.school_name,
      dateISO: a.deadline_at,
      href: "/applications",
    });
  }

  for (const s of scholarships) {
    const date = s.deadline_at.slice(0, 10);
    if (date < todayISO) continue;
    merged.push({
      id: `sch-${s.id}`,
      source: "scholarship",
      title: s.title,
      dateISO: date,
      href: `/scholarships/${s.id}`,
    });
  }

  for (const s of customScholarships) {
    const date = s.deadline_at.slice(0, 10);
    if (date < todayISO) continue;
    merged.push({
      id: `cus-${s.id}`,
      source: "custom",
      title: s.title,
      dateISO: date,
      href: CUSTOM_SCHOLARSHIPS_HREF,
    });
  }

  for (const e of events) {
    if (e.event_date < todayISO) continue;
    merged.push({
      id: `evt-${e.id}`,
      source: "event",
      title: e.title,
      dateISO: e.event_date,
      href: "/dashboard",
      timeStart: e.time_start ?? undefined,
      timeEnd: e.time_end ?? undefined,
    });
  }

  merged.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  return merged;
}

export async function fetchUnifiedDeadlines(
  supabase: SupabaseClient,
  userId: string
): Promise<UnifiedDeadline[]> {
  // Local calendar day, not UTC — otherwise users west of UTC drop or keep
  // deadlines a day early/late when comparing against date-only strings.
  const todayISO = todayKey();

  const [appRes, schRes, evtRes, customRes] = await Promise.all([
    supabase
      .from("user_school_applications")
      .select("id, deadline_at, status, schools(name)")
      .eq("user_id", userId)
      .not("deadline_at", "is", null),
    supabase
      .from("user_bookmarked_scholarships")
      .select("scholarship_id, scholarships(id, title, deadline_at)")
      .eq("user_id", userId),
    supabase
      .from("calendar_events")
      .select("id, title, event_date, time_start, time_end")
      .eq("user_id", userId),
    supabase
      .from("user_scholarships")
      .select("id, title, deadline_at")
      .eq("user_id", userId)
      .not("deadline_at", "is", null),
  ]);

  // Supabase returns query failures alongside data; a successful promise is
  // not proof that every source loaded. Never present a partial feed as empty.
  for (const result of [appRes, schRes, evtRes, customRes]) {
    if (result.error) throw new Error("Could not load deadlines", { cause: result.error });
  }

  const apps: RawAppDeadline[] = (appRes.data ?? []).flatMap((row: unknown) => {
    const r = row as {
      id: string;
      deadline_at: string;
      status: string;
      schools: { name: string } | null;
    };
    if (!r.deadline_at || !r.schools) return [];
    return [{
      id: r.id,
      school_name: r.schools.name,
      deadline_at: r.deadline_at,
      status: r.status,
    }];
  });

  const schols: RawScholarshipDeadline[] = (schRes.data ?? []).flatMap((row: unknown) => {
    const r = row as {
      scholarship_id: string;
      scholarships: { id: string; title: string; deadline_at: string | null } | null;
    };
    if (!r.scholarships?.deadline_at) return [];
    return [{
      id: r.scholarships.id,
      title: r.scholarships.title,
      deadline_at: r.scholarships.deadline_at,
    }];
  });

  const evts: RawEventDeadline[] = (evtRes.data ?? []).map((row: unknown) => {
    const r = row as {
      id: string;
      title: string;
      event_date: string;
      time_start: string | null;
      time_end: string | null;
    };
    return {
      id: r.id,
      title: r.title,
      event_date: r.event_date,
      time_start: r.time_start,
      time_end: r.time_end,
    };
  });

  const custom: RawScholarshipDeadline[] = (customRes.data ?? []).flatMap((row: unknown) => {
    const r = row as { id: string; title: string; deadline_at: string | null };
    return r.deadline_at ? [{ id: r.id, title: r.title, deadline_at: r.deadline_at }] : [];
  });

  return mergeDeadlines(apps, schols, evts, todayISO, custom);
}
