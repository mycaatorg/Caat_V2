"use client";

import { useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  FileUser,
  FolderOpen,
  GraduationCap,
  School,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleTodo } from "@/components/dashboard/api";
import { dismissOnboarding } from "@/lib/onboarding";
import { daysBetween, type NextStep, type TaskKind, type TodayTask } from "@/lib/today";
import type { RecentWork, SavedPreview, TodayTodo } from "@/lib/today-data";
import type { UnifiedDeadline } from "@/lib/unified-deadlines";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function relativeDays(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

function relativeEdited(iso: string, todayISO: string) {
  const days = daysBetween(iso.slice(0, 10), todayISO);
  if (days <= 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  return `Edited ${days} days ago`;
}

const TASK_ICON: Record<TaskKind, typeof CalendarClock> = {
  "deadline-soon": CalendarClock,
  "set-deadline": CalendarClock,
  "start-essay": FileText,
  "upload-documents": FolderOpen,
};

const SOURCE_LABEL: Record<UnifiedDeadline["source"], string> = {
  app: "Application",
  scholarship: "Scholarship",
  event: "Calendar",
};

const SAVED_ICON: Record<SavedPreview["kind"], typeof School> = {
  scholarship: GraduationCap,
  school: School,
  major: BookOpen,
};

const RECENT_ICON: Record<RecentWork["kind"], typeof FileText> = {
  essay: FileText,
  resume: FileUser,
  application: ClipboardList,
};

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{eyebrow}</p>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export interface TodayViewProps {
  name: string | null;
  hour: number;
  todayISO: string;
  nextStep: NextStep;
  tasks: TodayTask[];
  comingUp: UnifiedDeadline[];
  recent: RecentWork[];
  todos: TodayTodo[];
  saved: { scholarships: number; schools: number; majors: number };
  savedPreview: SavedPreview[];
  showOnboardingNudge: boolean;
}

export function TodayView(props: TodayViewProps) {
  const { name, hour, todayISO, nextStep, tasks, comingUp, recent, saved, savedPreview } = props;
  const [todos, setTodos] = useState(props.todos);
  const [nudge, setNudge] = useState(props.showOnboardingNudge && nextStep.kind !== "onboarding");
  const savedTotal = saved.scholarships + saved.schools + saved.majors;

  async function completeTodo(todo: TodayTodo) {
    setTodos((cur) => cur.filter((t) => t.id !== todo.id));
    try {
      await toggleTodo(todo.id, true);
    } catch {
      // Put it back where it was; the student's list must not silently lose it.
      setTodos((cur) => (cur.some((t) => t.id === todo.id) ? cur : [...cur, todo].sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"))));
      toast.error("Could not update that to-do. Please try again.");
    }
  }

  async function hideNudge() {
    setNudge(false);
    try {
      await dismissOnboarding();
    } catch {
      // Hiding is still right for this visit; it may show again next time.
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 pt-0 max-w-6xl">
      <header>
        <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{longDate(todayISO)}</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          {greeting(hour)}
          {name ? (
            <>
              , <span className={MAROON}>{name}</span>
            </>
          ) : null}
        </h1>
      </header>

      {/* The one thing to do next, chosen from real state. */}
      <section aria-labelledby="next-step" className="border border-l-4 border-l-[#9a1a27] dark:border-l-[#e06b78] bg-card p-6">
        <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Your next step</p>
        <h2 id="next-step" className="text-2xl font-bold tracking-tight mt-1">
          {nextStep.title}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{nextStep.body}</p>
        <Button asChild className="mt-4 rounded-none bg-[#9a1a27] hover:bg-[#7d141f] text-white gap-2">
          <Link href={nextStep.href} onClick={() => track("today_next_step_clicked", { kind: nextStep.kind })}>
            {nextStep.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {nudge ? (
        <div className="flex flex-wrap items-center gap-3 border border-dashed px-4 py-3 text-sm">
          <span className="flex-1 min-w-[12rem]">
            Answer five quick questions and we will tailor scholarships and universities to you.
          </span>
          <Link href="/welcome" className={`${MAROON} font-medium hover:underline inline-flex items-center gap-1`}>
            Start <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button type="button" onClick={hideNudge} aria-label="Not now" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-8">
          <section aria-label="Needs attention">
            <SectionHeading
              eyebrow={tasks.length ? `${tasks.length} open` : "All clear"}
              title="Needs attention"
            />
            {tasks.length ? (
              <ul className="border divide-y bg-card">
                {tasks.map((task) => {
                  const Icon = TASK_ICON[task.kind];
                  const urgent = task.kind === "deadline-soon";
                  return (
                    <li key={task.id}>
                      <Link href={task.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 outline-none">
                        <Icon className={`h-4 w-4 shrink-0 ${urgent ? MAROON : "text-muted-foreground"}`} strokeWidth={1.5} />
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-medium ${urgent ? MAROON : ""}`}>{task.title}</span>
                          <span className="block text-xs text-muted-foreground">{task.detail}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border bg-card px-4 py-5 text-sm text-muted-foreground">
                Nothing needs you right now. Tasks appear here when an application is missing its deadline, an essay or its documents.
              </p>
            )}
          </section>

          <section aria-label="Coming up">
            <SectionHeading eyebrow="Next 60 days" title="Coming up" />
            {comingUp.length ? (
              <ul className="border divide-y bg-card">
                {comingUp.map((d) => {
                  const days = daysBetween(todayISO, d.dateISO);
                  const [, m, day] = d.dateISO.split("-");
                  const month = new Date(Date.UTC(2000, Number(m) - 1, 1)).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
                  return (
                    <li key={d.id}>
                      <Link href={d.href} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 outline-none">
                        <span className="w-10 text-center shrink-0">
                          <span className="block font-display text-xl leading-none">{Number(day)}</span>
                          <span className="block font-code text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{month}</span>
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{d.title}</span>
                          <span className="block font-code text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{SOURCE_LABEL[d.source]}</span>
                        </span>
                        <span className={`text-sm font-medium shrink-0 ${days <= 7 ? MAROON : "text-muted-foreground"}`}>{relativeDays(days)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border bg-card px-4 py-5 text-sm text-muted-foreground">
                No deadlines in the next 60 days. Add one from an application or a saved scholarship.
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-8">
          {recent.length ? (
            <section aria-label="Pick up where you left off">
              <SectionHeading eyebrow="Recent work" title="Pick up where you left off" />
              <ul className="border divide-y bg-card">
                {recent.map((r) => {
                  const Icon = RECENT_ICON[r.kind];
                  return (
                    <li key={`${r.kind}-${r.href}`}>
                      <Link href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50 outline-none">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{r.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {r.detail} · {relativeEdited(r.updatedAt, todayISO)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section aria-label="Your to-dos">
            <SectionHeading
              eyebrow={todos.length ? `${todos.length} open` : "None open"}
              title="Your to-dos"
              action={
                <Link href="/dashboard" className={`text-xs ${MAROON} hover:underline`}>
                  Manage
                </Link>
              }
            />
            {todos.length ? (
              <ul className="border divide-y bg-card">
                {todos.map((t) => {
                  const overdue = t.dueDate ? daysBetween(todayISO, t.dueDate) < 0 : false;
                  return (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                      <Checkbox
                        id={`todo-${t.id}`}
                        className="mt-0.5 rounded-none"
                        onCheckedChange={() => completeTodo(t)}
                        aria-label={`Mark "${t.text}" done`}
                      />
                      <label htmlFor={`todo-${t.id}`} className="flex-1 min-w-0 text-sm cursor-pointer">
                        <span className="block">{t.text}</span>
                        {t.dueDate ? (
                          <span className={`block text-xs ${overdue ? MAROON : "text-muted-foreground"}`}>
                            {overdue ? "Overdue · " : "Due "}
                            {new Date(t.dueDate + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border bg-card px-4 py-5 text-sm text-muted-foreground">No open to-dos.</p>
            )}
          </section>

          <section aria-label="My shortlist">
            <SectionHeading
              eyebrow={`${savedTotal} saved`}
              title="My shortlist"
              action={
                <Link href="/shortlist" className={`text-xs ${MAROON} hover:underline`}>
                  View all
                </Link>
              }
            />
            <div className="border bg-card">
              <div className="flex divide-x border-b">
                {[
                  ["Scholarships", saved.scholarships],
                  ["Universities", saved.schools],
                  ["Courses", saved.majors],
                ].map(([label, count]) => (
                  <div key={label as string} className="flex-1 px-2 py-3 text-center">
                    <span className="block font-display text-2xl leading-none">{count}</span>
                    <span className="block font-code text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-1">{label}</span>
                  </div>
                ))}
              </div>
              {savedPreview.length ? (
                <ul className="divide-y">
                  {savedPreview.map((s) => {
                    const Icon = SAVED_ICON[s.kind];
                    return (
                      <li key={`${s.kind}-${s.id}`}>
                        <Link href={s.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 focus-visible:bg-muted/50 outline-none">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{s.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">
                  Save scholarships, universities and courses as you explore. They collect here.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
