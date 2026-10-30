"use client";

import { DeadlineCalendarDownload } from "@/components/today/deadline-calendar-download";
import { TaskEditor } from "@/components/today/task-editor";
import { WeekAgenda } from "@/components/today/week-agenda";
import type { TaskDetails } from "@/lib/personal-tasks";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { TIME_ZONE_COOKIE, type RecentWork, type SavedPreview, type TodayTodo } from "@/lib/today-data";
import { CUSTOM_SOURCE_PILL, type UnifiedDeadline } from "@/lib/unified-deadlines";

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
  custom: "Custom",
  event: "Calendar",
};

const SAVED_ICON: Record<SavedPreview["kind"], typeof School> = {
  scholarship: GraduationCap,
  school: School,
  major: BookOpen,
  course: BookOpen,
};

const RECENT_ICON: Record<RecentWork["kind"], typeof FileText> = {
  essay: FileText,
  resume: FileUser,
  application: ClipboardList,
};

type FocusView = "attention" | "upcoming" | "recent" | "todos";
type FocusState = { view: FocusView | null; page: number };
const PAGE_SIZE = 10;
const PREVIEW_LIMIT: Record<FocusView | "saved", number> = {
  attention: 3,
  upcoming: 4,
  recent: 3,
  todos: 3,
  saved: 3,
};
const FOCUS_TITLE: Record<FocusView, string> = {
  attention: "Needs attention",
  upcoming: "Coming up",
  recent: "Recent work",
  todos: "Your to-dos",
};

function focusUrl(view: FocusView | null, page: number) {
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  url.searchParams.delete("page");
  if (view) {
    url.searchParams.set("view", view);
    url.searchParams.set("page", String(page));
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function pageCount(length: number) {
  return Math.max(1, Math.ceil(length / PAGE_SIZE));
}

function TaskRows({ items, compact = false }: { items: TodayTask[]; compact?: boolean }) {
  return (
    <ul className="border divide-y bg-card">
      {items.map((task) => {
        const Icon = TASK_ICON[task.kind];
        const urgent = task.kind === "deadline-soon";
        return (
          <li key={task.id}>
            <Link href={task.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9a1a27]">
              <Icon className={`h-4 w-4 shrink-0 ${urgent ? MAROON : "text-muted-foreground"}`} strokeWidth={1.5} />
              <span className="flex-1 min-w-0">
                <span className={`block break-words text-sm font-medium ${urgent ? MAROON : ""}`}>{task.title}</span>
                {!compact ? <span className="block text-xs text-muted-foreground">{task.detail}</span> : null}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ComingUpRows({ items, todayISO, compact = false }: { items: UnifiedDeadline[]; todayISO: string; compact?: boolean }) {
  return (
    <ul className="border divide-y bg-card">
      {items.map((d) => {
        const days = daysBetween(todayISO, d.dateISO);
        const [, m, day] = d.dateISO.split("-");
        const month = new Date(Date.UTC(2000, Number(m) - 1, 1)).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" });
        return (
          <li key={d.id}>
            <Link href={d.href} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9a1a27]">
              <span className="w-10 text-center shrink-0">
                <span className="block font-display text-xl leading-none">{Number(day)}</span>
                <span className="block font-code text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{month}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${compact ? "line-clamp-2" : "block break-words"}`}>{d.title}</span>
                <span className="block font-code text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{d.source === "custom" ? (
                  <>
                    <span aria-hidden="true">{CUSTOM_SOURCE_PILL.visible}</span>
                    <span className="sr-only">{CUSTOM_SOURCE_PILL.spoken}</span>
                  </>
                ) : SOURCE_LABEL[d.source]}</span>
              </span>
              <span className={`text-sm font-medium shrink-0 ${days <= 7 ? MAROON : "text-muted-foreground"}`}>{relativeDays(days)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function RecentRows({ items, todayISO }: { items: RecentWork[]; todayISO: string }) {
  return (
    <ul className="border divide-y bg-card">
      {items.map((r) => {
        const Icon = RECENT_ICON[r.kind];
        return (
          <li key={`${r.kind}-${r.href}`}>
            <Link href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9a1a27]">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{r.title}</span>
                <span className="block text-xs text-muted-foreground">{r.detail} · {relativeEdited(r.updatedAt, todayISO)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

type TodayTodoRow = TodayTodo & { done: boolean };

function TodoRows({ items, todayISO, pendingIds, onToggle, onSaved, onMissing, fallbackFocusRef, returnTo }: { items: TodayTodoRow[]; todayISO: string; pendingIds: Set<string>; onToggle: (todo: TodayTodoRow, done: boolean) => void; onSaved: (saved: TaskDetails) => void; onMissing: (id: string) => void; fallbackFocusRef: RefObject<HTMLElement | null>; returnTo: string }) {
  return (
    <ul className="border divide-y bg-card">
      {items.map((t) => {
        const overdue = t.dueDate ? daysBetween(todayISO, t.dueDate) < 0 : false;
        return (
          <li key={t.id} className={`flex items-start gap-3 px-4 py-3 ${t.done ? "opacity-60" : ""}`}>
            <Checkbox id={`todo-${t.id}`} checked={t.done} disabled={pendingIds.has(t.id)} className="mt-0.5 rounded-none" onCheckedChange={(checked) => onToggle(t, checked === true)} aria-label={t.done ? `Restore "${t.text}"` : `Mark "${t.text}" done`} />
            <label htmlFor={`todo-${t.id}`} className="flex-1 min-w-0 text-sm cursor-pointer">
              <span className={`block break-words ${t.done ? "line-through" : ""}`}>{t.text}</span>
              {t.dueDate && !t.done ? (
                <span className={`block text-xs ${overdue ? MAROON : "text-muted-foreground"}`}>
                  {overdue ? "Overdue · " : "Due "}
                  {new Date(t.dueDate + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })}
                </span>
              ) : null}
            </label>
            <TaskEditor task={t} disabled={pendingIds.has(t.id)} onSaved={onSaved} onMissing={onMissing} fallbackFocusRef={fallbackFocusRef} returnTo={returnTo} />
          </li>
        );
      })}
    </ul>
  );
}

function SavedRows({ items }: { items: SavedPreview[] }) {
  return (
    <ul className="divide-y">
      {items.map((s) => {
        const Icon = SAVED_ICON[s.kind];
        return (
          <li key={`${s.kind}-${s.id}`}>
            <Link href={s.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#9a1a27]">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="truncate">{s.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {action}
    </div>
  );
}

function ViewAll({ view, label, count, onClick }: { view: FocusView; label: string; count: number; onClick: (view: FocusView) => void }) {
  return (
    <Link
      href={`?view=${view}&page=1`}
      aria-label={`View all ${label}`}
      onClick={(event) => { event?.preventDefault(); onClick(view); }}
      className={`shrink-0 whitespace-nowrap text-xs ${MAROON} hover:underline`}
    >
      View all ({count})
    </Link>
  );
}

/** Shown when Today's data could not be read; never an empty "new student" view. */
export function TodayLoadError() {
  const router = useRouter();
  return (
    <div className="p-6 pt-0 max-w-6xl">
      <div role="alert" className="border px-6 py-10 text-center">
        <p className="font-medium">Couldn&apos;t load Today.</p>
        <p className="text-sm text-muted-foreground mt-1">Your work is safe. Try again in a moment.</p>
        <Button variant="outline" className="mt-4 rounded-none" onClick={() => router.refresh()}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export interface TodayViewProps {
  initialQuery?: string;
  name: string | null;
  hour: number;
  todayISO: string;
  nextStep: NextStep;
  tasks: TodayTask[];
  comingUp: UnifiedDeadline[];
  recent: RecentWork[];
  todos: TodayTodo[];
  saved: { scholarships: number; schools: number; majors: number; courses: number };
  savedPreview: SavedPreview[];
  showOnboardingNudge: boolean;
  /** Zone the server used for dates; refreshed once if the browser's differs. */
  timeZone?: string;
}

/** Reports the browser's time zone so dates and greetings match the student. */
function useReportTimeZone(serverZone: string | undefined) {
  const router = useRouter();
  useEffect(() => {
    if (!serverZone) return;
    let zone: string;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!zone || zone === serverZone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    // Refresh at most once per session, even if the server rejects the zone.
    try {
      if (sessionStorage.getItem(TIME_ZONE_COOKIE) === zone) return;
      sessionStorage.setItem(TIME_ZONE_COOKIE, zone);
    } catch {
      return;
    }
    router.refresh();
  }, [serverZone, router]);
}

export function TodayView(props: TodayViewProps) {
  const router = useRouter();
  const { name, hour, todayISO, nextStep, tasks, comingUp, recent, saved, savedPreview } = props;
  useReportTimeZone(props.timeZone);
  const [todos, setTodos] = useState<TodayTodoRow[]>(() => props.todos.map((todo) => ({ ...todo, done: false })));
  const [pendingTodoIds, setPendingTodoIds] = useState<Set<string>>(() => new Set());
  const pendingTodoIdsRef = useRef(new Set<string>());
  const todoVersionsRef = useRef(new Map<string, number>());
  const [nudge, setNudge] = useState(props.showOnboardingNudge && nextStep.kind !== "onboarding");
  const [focus, setFocus] = useState<FocusState>(() => {
    const params = new URLSearchParams(props.initialQuery ?? "");
    const requestedView = params.get("view");
    const view = requestedView === "attention" || requestedView === "upcoming" || requestedView === "recent" || requestedView === "todos" ? requestedView : null;
    const items = view === "attention" ? tasks : view === "upcoming" ? comingUp : view === "recent" ? recent : view === "todos" ? props.todos : [];
    const requestedPage = Number(params.get("page"));
    return { view, page: Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount(items.length)) : 1 };
  });
  const focusedHeadingRef = useRef<HTMLHeadingElement>(null);
  const agendaTaskFocusRef = useRef<string | null>(null);
  const todoSectionRef = useRef<HTMLElement>(null);
  const [removedTaskCount, setRemovedTaskCount] = useState(0);
  const taskNotice = removedTaskCount > 0
    ? `Removed ${removedTaskCount} unavailable task${removedTaskCount === 1 ? "" : "s"} from Today.`
    : "";
  const todayHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusMountedRef = useRef(false);
  const focusedItems = focus.view === "attention" ? tasks : focus.view === "upcoming" ? comingUp : focus.view === "recent" ? recent : focus.view === "todos" ? todos : [];
  const currentPageCount = pageCount(focusedItems.length);
  const visiblePage = Math.min(focus.page, currentPageCount);

  useEffect(() => {
    const restore = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("view");
      const view: FocusView | null = requestedView === "attention" || requestedView === "upcoming" || requestedView === "recent" || requestedView === "todos" ? requestedView : null;
      const items = view === "attention" ? tasks : view === "upcoming" ? comingUp : view === "recent" ? recent : view === "todos" ? todos : [];
      const maxPage = pageCount(items.length);
      const requestedPage = Number(params.get("page"));
      const page = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, maxPage) : 1;
      setFocus({ view, page });
      if (view !== requestedView || (view && (params.get("page") !== String(page)))) {
        window.history.replaceState(null, "", focusUrl(view, page));
      }
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [tasks, comingUp, recent, todos]);

  useEffect(() => {
    if (focus.view && focus.page !== visiblePage) {
      window.history.replaceState(null, "", focusUrl(focus.view, visiblePage));
    }
  }, [focus, visiblePage]);

  useEffect(() => {
    if (!focusMountedRef.current) {
      focusMountedRef.current = true;
      return;
    }
    const agendaTaskId = agendaTaskFocusRef.current;
    agendaTaskFocusRef.current = null;
    if (focus.view === "todos" && agendaTaskId) {
      const control = document.getElementById(`todo-${agendaTaskId}`);
      control?.focus();
      if (document.activeElement !== control) focusedHeadingRef.current?.focus();
    }
    else if (focus.view) focusedHeadingRef.current?.focus();
    else todayHeadingRef.current?.focus();
  }, [focus.view, visiblePage]);

  function showFocus(view: FocusView) {
    const next = { view, page: 1 };
    setFocus(next);
    window.history.replaceState(null, "", focusUrl(next.view, next.page));
  }

  function showAgendaTodo(taskId?: string) {
    agendaTaskFocusRef.current = taskId ?? null;
    const index = taskId ? todos.findIndex(todo => todo.id === taskId) : 0;
    const page = Math.floor(Math.max(0, index) / PAGE_SIZE) + 1;
    setFocus({ view: "todos", page });
    window.history.replaceState(null, "", focusUrl("todos", page));
  }

  function showPage(page: number) {
    if (!focus.view) return;
    const next = { view: focus.view, page: Math.max(1, Math.min(currentPageCount, page)) };
    setFocus(next);
    window.history.replaceState(null, "", focusUrl(next.view, next.page));
  }

  function backToToday() {
    setFocus({ view: null, page: 1 });
    window.history.replaceState(null, "", focusUrl(null, 1));
  }

  function savedTask(saved: TaskDetails) {
    // A completion/Undo can settle separately; only apply fields this edit owns.
    setTodos(current => current.map(todo => todo.id === saved.id ? { ...todo, text: saved.text, dueDate: saved.due_date } : todo));
    router.refresh();
  }

  function missingTask(id: string) {
    // Invalidate an old toast Undo and any completion response for this row only.
    todoVersionsRef.current.set(id, (todoVersionsRef.current.get(id) ?? 0) + 1);
    setTodos(current => current.filter(todo => todo.id !== id));
    setRemovedTaskCount(count => count + 1);
    router.refresh();
  }

  async function toggleTodoState(todo: TodayTodoRow, done: boolean) {
    if (pendingTodoIdsRef.current.has(todo.id)) return;
    const version = (todoVersionsRef.current.get(todo.id) ?? 0) + 1;
    todoVersionsRef.current.set(todo.id, version);
    pendingTodoIdsRef.current.add(todo.id);
    setPendingTodoIds(new Set(pendingTodoIdsRef.current));
    setTodos((cur) => cur.map((t) => (t.id === todo.id ? { ...t, done } : t)));
    try {
      await toggleTodo(todo.id, done);
      pendingTodoIdsRef.current.delete(todo.id);
      setPendingTodoIds(new Set(pendingTodoIdsRef.current));
      if (todoVersionsRef.current.get(todo.id) === version) {
        if (done) {
          toast.success("To-do completed", {
            duration: 5000,
            action: {
              label: "Undo",
              onClick: () => {
                if (todoVersionsRef.current.get(todo.id) === version) void toggleTodoState({ ...todo, done: true }, false);
              },
            },
          });
        }
        router.refresh();
      }
    } catch {
      pendingTodoIdsRef.current.delete(todo.id);
      setPendingTodoIds(new Set(pendingTodoIdsRef.current));
      if (todoVersionsRef.current.get(todo.id) === version) {
        setTodos((cur) => cur.map((t) => (t.id === todo.id ? { ...t, done: todo.done } : t)));
        toast.error("Could not update that to-do. Please try again.");
      }
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

  if (focus.view) {
    const start = (visiblePage - 1) * PAGE_SIZE;
    const visible = focusedItems.slice(start, start + PAGE_SIZE);
    return (
      <div className="flex flex-1 flex-col gap-5 p-6 pt-0 max-w-4xl">
        <p role="status" aria-label="Task updates" className="sr-only">{taskNotice}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="-ml-3 rounded-none" onClick={backToToday}>← Back to Today</Button>
          <span className="text-sm text-muted-foreground" aria-live="polite">Page {visiblePage} of {currentPageCount}</span>
        </div>
        <section aria-label={FOCUS_TITLE[focus.view]}>
          <h1 ref={focusedHeadingRef} tabIndex={-1} className="font-display text-3xl font-semibold tracking-tight mb-4">{FOCUS_TITLE[focus.view]}</h1>
          {visible.length ? (
            <>
              {focus.view === "attention" ? <TaskRows items={visible as TodayTask[]} /> : null}
              {focus.view === "upcoming" ? <ComingUpRows items={visible as UnifiedDeadline[]} todayISO={todayISO} /> : null}
              {focus.view === "recent" ? <RecentRows items={visible as RecentWork[]} todayISO={todayISO} /> : null}
              {focus.view === "todos" ? <TodoRows items={visible as TodayTodoRow[]} todayISO={todayISO} pendingIds={pendingTodoIds} onToggle={toggleTodoState} onSaved={savedTask} onMissing={missingTask} fallbackFocusRef={focusedHeadingRef} returnTo={`/today?view=todos&page=${visiblePage}`} /> : null}
            </>
          ) : (
            <p className="border bg-card px-4 py-5 text-sm text-muted-foreground">
              {focus.view === "attention" ? "Nothing needs you right now." : null}
              {focus.view === "upcoming" ? "No deadlines in the next 60 days." : null}
              {focus.view === "recent" ? "No recent work yet." : null}
              {focus.view === "todos" ? "No open to-dos." : null}
            </p>
          )}
          {focus.view === "upcoming" ? <DeadlineCalendarDownload /> : null}
        </section>
        <nav aria-label="List pages" className="flex items-center justify-between">
          <Button variant="outline" className="rounded-none" onClick={() => showPage(visiblePage - 1)} disabled={visiblePage <= 1}>Previous page</Button>
          <Button variant="outline" className="rounded-none" onClick={() => showPage(visiblePage + 1)} disabled={visiblePage >= currentPageCount}>Next page</Button>
        </nav>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 pb-6 sm:px-6 max-w-6xl">
      <header>
        <p className="text-sm text-muted-foreground">{longDate(todayISO)}</p>
        <h1 ref={todayHeadingRef} tabIndex={-1} className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 break-words">
          {greeting(hour)}
          {name ? (
            <>
              , {name}
            </>
          ) : null}
        </h1>
      </header>

      {/* The one thing to do next, chosen from real state. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section aria-labelledby="next-step" className="min-w-0 rounded-xl bg-[#9a1a27] text-white p-5 sm:p-7 flex flex-col items-start">
        <p className="text-sm text-white/85">Your next step</p>
        <h2 id="next-step" className="max-w-full text-2xl sm:text-3xl font-bold tracking-tight mt-2 break-words">
          {nextStep.title}
        </h2>
        <p className="mt-3 mb-5 max-w-prose text-sm leading-relaxed text-white/90">{nextStep.body}</p>
        <Button asChild className="mt-auto h-auto min-h-10 max-w-full whitespace-normal bg-white hover:bg-white/90 text-[#7d141f] gap-2 focus-visible:ring-white">
          <Link href={nextStep.href} onClick={() => track("today_next_step_clicked", { kind: nextStep.kind })}>
            {nextStep.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>
      <nav aria-label="Your workspace" className="min-w-0 rounded-xl border bg-card px-5 py-2">
        {[
          { href: "/scholarships", title: "Explore scholarships", detail: "Find opportunities worth saving.", Icon: GraduationCap },
          { href: "/shortlist", title: "My shortlist", detail: "Bring your saved options together.", Icon: BookOpen },
          { href: "/applications", title: "Applications", detail: "Work through your requirements.", Icon: ClipboardList },
        ].map(({ href, title, detail, Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 border-b last:border-0 py-4 hover:text-[#9a1a27] dark:hover:text-[#e06b78] rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="block text-sm text-muted-foreground">{detail}</span></span>
            <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
        ))}
      </nav>
      </div>

      <WeekAgenda todayISO={todayISO} deadlines={comingUp} todos={todos} onViewTodos={showAgendaTodo} />

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
            <SectionHeading title="Needs attention" action={tasks.length > PREVIEW_LIMIT.attention ? <ViewAll view="attention" label="Needs attention" count={tasks.length} onClick={showFocus} /> : null} />
            {tasks.length ? (
              <TaskRows items={tasks.slice(0, PREVIEW_LIMIT.attention)} compact />
            ) : (
              <p className="border bg-card px-4 py-5 text-sm text-muted-foreground">
                Nothing needs you right now. Tasks appear here when an application is missing its deadline, an essay or its documents.
              </p>
            )}
          </section>

          <section aria-label="Coming up">
            <SectionHeading title="Coming up" action={comingUp.length > PREVIEW_LIMIT.upcoming ? <ViewAll view="upcoming" label="Coming up" count={comingUp.length} onClick={showFocus} /> : null} />
            {comingUp.length ? (
              <ComingUpRows items={comingUp.slice(0, PREVIEW_LIMIT.upcoming)} todayISO={todayISO} compact />
            ) : (
              <p className="border bg-card px-4 py-5 text-sm text-muted-foreground">
                No deadlines in the next 60 days. Add one from an application or a saved scholarship.
              </p>
            )}
            <DeadlineCalendarDownload />
          </section>
        </div>

        <aside className="flex flex-col gap-8">
          {recent.length ? (
            <section aria-label="Recent work">
              <SectionHeading title="Recent work" action={recent.length > PREVIEW_LIMIT.recent ? <ViewAll view="recent" label="Recent work" count={recent.length} onClick={showFocus} /> : null} />
              <RecentRows items={recent.slice(0, PREVIEW_LIMIT.recent)} todayISO={todayISO} />
            </section>
          ) : null}

          <section ref={todoSectionRef} tabIndex={-1} aria-label="Your to-dos">
            <p role="status" aria-label="Task updates" className="sr-only">{taskNotice}</p>
            <SectionHeading
              title="Your to-dos"
              action={
                <span className="flex items-center gap-3">
                  {todos.length > PREVIEW_LIMIT.todos ? <ViewAll view="todos" label="to-dos" count={todos.length} onClick={showFocus} /> : null}
                  <Link href="/dashboard" className={`shrink-0 whitespace-nowrap text-xs ${MAROON} hover:underline`}>Manage</Link>
                </span>
              }
            />
            {todos.length ? (
              <TodoRows items={todos.slice(0, PREVIEW_LIMIT.todos)} todayISO={todayISO} pendingIds={pendingTodoIds} onToggle={toggleTodoState} onSaved={savedTask} onMissing={missingTask} fallbackFocusRef={todoSectionRef} returnTo="/today" />
            ) : (
              <p className="border bg-card px-4 py-5 text-sm text-muted-foreground">No open to-dos.</p>
            )}
          </section>

          <section aria-label="My shortlist">
            <SectionHeading
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
                  ["Majors", saved.majors],
                  ["University courses", saved.courses],
                ].map(([label, count]) => (
                  <div key={label as string} className="flex-1 px-2 py-3 text-center">
                    <span className="block font-display text-2xl leading-none">{count}</span>
                    <span className="block font-code text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-1">{label}</span>
                  </div>
                ))}
              </div>
              {savedPreview.length ? (
                <SavedRows items={savedPreview.slice(0, PREVIEW_LIMIT.saved)} />
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
