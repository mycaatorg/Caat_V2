/**
 * Today view (PROD-74): pure derivation of what a student should do next.
 *
 * Every task comes from data the student already sees elsewhere (application
 * status, deadlines, the hub's readiness rules, their own to-dos). Nothing
 * here invents urgency or a completion percentage.
 */

import type { ApplicationStatus } from "@/types/applications";
import type { UnifiedDeadline } from "@/lib/unified-deadlines";

export const SOON_DAYS = 14;
export const COMING_UP_DAYS = 60;

export interface TodayApplication {
  id: string;
  schoolId: number;
  schoolName: string;
  status: ApplicationStatus;
  deadlineAt: string | null;
  updatedAt: string | null;
}

export interface TodayInput {
  todayISO: string;
  onboarding: { completed: boolean; dismissed: boolean; hasBasics: boolean };
  applications: TodayApplication[];
  /** school_id of each essay draft; null means shared across applications. */
  essayDraftSchoolIds: (number | null)[];
  /** school_id of each uploaded document; null means shared. */
  documentSchoolIds: (number | null)[];
  saved: { scholarships: number; schools: number; majors: number };
  deadlines: UnifiedDeadline[];
}

export type TaskKind = "deadline-soon" | "set-deadline" | "start-essay" | "upload-documents";

export interface TodayTask {
  id: string;
  kind: TaskKind;
  title: string;
  detail: string;
  href: string;
  /** ISO date the task is tied to, when it has one. */
  dueISO?: string;
}

export type NextStepKind = "onboarding" | "first-save" | "save-university" | "start-application" | "task" | "deadline" | "explore";

export interface NextStep {
  kind: NextStepKind;
  title: string;
  body: string;
  cta: string;
  href: string;
}

/** Whole days from today to a YYYY-MM-DD date (negative when past). */
export function daysBetween(todayISO: string, dateISO: string): number {
  const [y1, m1, d1] = todayISO.split("-").map(Number);
  const [y2, m2, d2] = dateISO.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Applications that are still being worked on (not decided or withdrawn). */
function isActive(status: ApplicationStatus): boolean {
  return status === "researching" || status === "applying";
}

function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

export function deriveTasks(input: TodayInput): TodayTask[] {
  const sharedEssay = input.essayDraftSchoolIds.some((id) => id == null);
  const sharedDocs = input.documentSchoolIds.some((id) => id == null);
  const soon: TodayTask[] = [];
  const rest: TodayTask[] = [];

  for (const app of input.applications) {
    if (!isActive(app.status)) continue;
    const hub = `/applications/${app.id}`;

    if (!app.deadlineAt) {
      rest.push({
        id: `deadline-${app.id}`,
        kind: "set-deadline",
        title: `Add the deadline for ${app.schoolName}`,
        detail: "Deadlines drive your reminders and what shows up here first.",
        href: hub,
      });
    } else {
      const days = daysBetween(input.todayISO, app.deadlineAt);
      if (days <= SOON_DAYS) {
        soon.push({
          id: `soon-${app.id}`,
          kind: "deadline-soon",
          title: `${app.schoolName} is ${dueLabel(days)}`,
          detail: "Check what is left on the application before it closes.",
          href: hub,
          dueISO: app.deadlineAt.slice(0, 10),
        });
      }
    }

    // Preparation tasks only once the student says they are applying, using
    // the same "shared or tagged to this school" rule as the hub checklist.
    if (app.status !== "applying") continue;
    const hasEssay = sharedEssay || input.essayDraftSchoolIds.includes(app.schoolId);
    if (!hasEssay) {
      rest.push({
        id: `essay-${app.id}`,
        kind: "start-essay",
        title: `Start an essay for ${app.schoolName}`,
        detail: "No draft yet, shared or for this university.",
        href: `/essays?school=${app.schoolId}`,
      });
    }
    const hasDocs = sharedDocs || input.documentSchoolIds.includes(app.schoolId);
    if (!hasDocs) {
      rest.push({
        id: `docs-${app.id}`,
        kind: "upload-documents",
        title: `Upload documents for ${app.schoolName}`,
        detail: "Transcripts and ID are usually the first things asked for.",
        href: `/documents?school=${app.schoolId}`,
      });
    }
  }

  soon.sort((a, b) => (a.dueISO ?? "").localeCompare(b.dueISO ?? ""));
  return [...soon, ...rest];
}

/** Deadlines from today up to COMING_UP_DAYS ahead, nearest first. */
export function comingUp(input: Pick<TodayInput, "todayISO" | "deadlines">): UnifiedDeadline[] {
  return input.deadlines
    .filter((d) => {
      const days = daysBetween(input.todayISO, d.dateISO);
      return days >= 0 && days <= COMING_UP_DAYS;
    })
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

export function chooseNextStep(input: TodayInput, tasks: TodayTask[] = deriveTasks(input)): NextStep {
  const savedTotal = input.saved.scholarships + input.saved.schools + input.saved.majors;
  const { onboarding } = input;

  if (!onboarding.completed && !onboarding.dismissed && !onboarding.hasBasics && savedTotal === 0) {
    return {
      kind: "onboarding",
      title: "Tell us where you are up to",
      body: "Five quick questions, all skippable. We use them to show scholarships and universities that fit.",
      cta: "Get started",
      href: "/welcome",
    };
  }
  if (savedTotal === 0 && input.applications.length === 0) {
    return {
      kind: "first-save",
      title: "Save your first scholarship",
      body: "Browse scholarships at Australian universities and save the ones worth a closer look.",
      cta: "Browse scholarships",
      href: "/scholarships",
    };
  }
  if (input.applications.length === 0 && input.saved.schools === 0) {
    return {
      kind: "save-university",
      title: "Add a university you are considering",
      body: "Save the universities you might apply to. Each one can become an application with its own deadline and checklist.",
      cta: "Browse universities",
      href: "/schools",
    };
  }
  if (input.applications.length === 0) {
    return {
      kind: "start-application",
      title: "Turn a saved university into an application",
      body: "Tracking an application gives you its deadline, checklist and the essays and documents it needs.",
      cta: "Open my shortlist",
      href: "/shortlist",
    };
  }
  const first = tasks[0];
  if (first) {
    return { kind: "task", title: first.title, body: first.detail, cta: "Do this now", href: first.href };
  }
  const nearest = comingUp(input)[0];
  if (nearest) {
    const days = daysBetween(input.todayISO, nearest.dateISO);
    return {
      kind: "deadline",
      title: `${nearest.title} is ${dueLabel(days)}`,
      body: "Nothing else needs you right now. This is the next date on your calendar.",
      cta: "Open it",
      href: nearest.href,
    };
  }
  return {
    kind: "explore",
    title: "You are on top of things",
    body: "No open tasks or upcoming deadlines. A good time to look for more scholarships.",
    cta: "Explore scholarships",
    href: "/scholarships",
  };
}

