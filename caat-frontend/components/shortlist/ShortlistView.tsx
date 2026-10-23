"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, BookOpen, GraduationCap, Loader2, School, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { getClientUserId } from "@/lib/current-user";
import { startApplicationForSchool } from "@/lib/application-for-school";
import { SCHOLARSHIP_STATUS_LABELS } from "@/lib/scholarship-tracking";
import { removeFromShortlist, type Shortlist, type ShortlistKind } from "@/lib/shortlist";
import { STATUS_CONFIG } from "@/types/applications";
import { ProviderLink } from "@/components/courses/course-source";
import { CourseApplicationAction } from "@/components/courses/course-application-action";

const MAROON = "text-[#9a1a27] dark:text-[#e06b78]";
type Filter = "all" | ShortlistKind;
type ScholarshipStatus = "all" | "interested" | "applied" | "awarded" | "not_selected";
type ViewState = { filter: Filter; page: number; search: string; status: ScholarshipStatus };

const PAGE_SIZE = 20;
const OVERVIEW_LIMIT = 5;
const VALID_FILTERS = new Set<Filter>(["all", "scholarship", "school", "major", "course"]);
const VALID_STATUSES = new Set<ScholarshipStatus>(["all", "interested", "applied", "awarded", "not_selected"]);

function readViewState(query: string): ViewState {
  const params = new URLSearchParams(query);
  const rawFilter = params.get("tab") as Filter | null;
  const rawStatus = params.get("status") as ScholarshipStatus | null;
  const rawPage = Number(params.get("page"));
  return {
    filter: rawFilter && VALID_FILTERS.has(rawFilter) ? rawFilter : "all",
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
    search: params.get("q")?.trim() ?? "",
    status: rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : "all",
  };
}

function writeViewState(state: ViewState) {
  const url = new URL(window.location.href);
  if (state.filter === "all") url.searchParams.delete("tab");
  else url.searchParams.set("tab", state.filter);
  if (state.page === 1) url.searchParams.delete("page");
  else url.searchParams.set("page", String(state.page));
  if (state.search) url.searchParams.set("q", state.search);
  else url.searchParams.delete("q");
  if (state.status === "all") url.searchParams.delete("status");
  else url.searchParams.set("status", state.status);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

const FIELDS = { scholarship: "scholarships", school: "schools", major: "majors", course: "courses" } as const;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "scholarship", label: "Scholarships" },
  { key: "school", label: "Universities" },
  { key: "major", label: "Majors" },
  { key: "course", label: "University courses" },
];

function closes(deadlineAt: string | null) {
  if (!deadlineAt) return "No closing date listed";
  return `Closes ${new Date(deadlineAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-code text-[10px] uppercase tracking-[0.08em] bg-muted text-muted-foreground px-2 py-0.5">
      {children}
    </span>
  );
}

function Section({
  title,
  count,
  icon: Icon,
  empty,
  hasItems,
  viewAll,
  children,
}: {
  title: string;
  count: number;
  icon: typeof School;
  empty: React.ReactNode;
  hasItems?: boolean;
  viewAll?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{count} saved</span>
      </div>
      {hasItems ?? count > 0 ? <ul className="border divide-y bg-card">{children}</ul> : <div className="border border-dashed px-4 py-5 text-sm text-muted-foreground">{empty}</div>}
      {viewAll ? (
        <button type="button" onClick={viewAll.onClick} className={`mt-3 text-sm ${MAROON} hover:underline`}>
          {viewAll.label}
        </button>
      ) : null}
    </section>
  );
}

function Pagination({ kind, page, pages, onPage }: { kind: ShortlistKind; page: number; pages: number; onPage: (page: number) => void }) {
  if (pages < 2) return null;
  const name = kind === "scholarship" ? "Scholarship" : kind === "school" ? "University" : kind === "major" ? "Major" : "University course";
  return (
    <nav aria-label={`${name} pages`} className="flex items-center justify-between gap-3 pt-3">
      <Button variant="outline" className="rounded-none" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous page</Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">Page {page} of {pages}</span>
      <Button variant="outline" className="rounded-none" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next page</Button>
    </nav>
  );
}

function RemoveButton({ label, onRemove, busy }: { label: string; onRemove: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={busy}
      aria-label={`Remove ${label} from shortlist`}
      className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 shrink-0"
    >
      <X className="h-4 w-4" />
    </button>
  );
}

export function ShortlistView({ initial, initialQuery = "" }: { initial: Shortlist | null; initialQuery?: string }) {
  const router = useRouter();
  const [list, setList] = useState<Shortlist | null>(initial);
  const [view, setView] = useState<ViewState>(() => readViewState(initialQuery));
  const [restored, setRestored] = useState<{ kind: ShortlistKind; id: string | number; label: string } | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const isBusy = (key: string) => busy.has(key);
  const setBusyKey = (key: string, on: boolean) =>
    setBusy((cur) => {
      const next = new Set(cur);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  function updateView(next: ViewState) {
    setView(next);
    writeViewState(next);
  }

  useEffect(() => {
    const restore = () => setView(readViewState(window.location.search));
    const initialView = readViewState(window.location.search);
    setView(initialView);
    writeViewState(initialView);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useEffect(() => {
    if (!list || view.filter === "all") return;
    const term = view.search.toLowerCase();
    const count = view.filter === "scholarship"
      ? list.scholarships.filter((s) => (view.status === "all" || s.status === view.status) && `${s.title} ${s.provider ?? ""} ${s.amount ?? ""}`.toLowerCase().includes(term)).length
      : view.filter === "school"
        ? list.schools.filter((s) => `${s.name} ${s.country ?? ""}`.toLowerCase().includes(term)).length
        : view.filter === "course"
          ? list.courses.filter(c => `${c.name} ${c.institutionName} ${c.campus ?? ""}`.toLowerCase().includes(term)).length
          : list.majors.filter((m) => `${m.name} ${m.category ?? ""}`.toLowerCase().includes(term)).length;
    const page = Math.min(view.page, Math.max(1, Math.ceil(count / PAGE_SIZE)));
    if (page !== view.page) updateView({ ...view, page });
  }, [list, view]);

  if (!list) {
    return (
      <div className="p-6 pt-0 max-w-5xl">
        <div role="alert" className="border px-6 py-10 text-center">
          <p className="font-medium">Couldn&apos;t load your shortlist.</p>
          <Button variant="outline" className="mt-3 rounded-none" onClick={() => router.refresh()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const restoredItems = restored ? list[FIELDS[restored.kind]] : [];
  const restoredIndex = restored ? restoredItems.findIndex(item => item.id === restored.id) : -1;
  const total = list.scholarships.length + list.schools.length + list.majors.length + list.courses.length;
  const show = (kind: ShortlistKind) => view.filter === "all" || view.filter === kind;
  const filteredScholarships = list.scholarships.filter((s) =>
    (view.status === "all" || s.status === view.status) &&
    `${s.title} ${s.provider ?? ""} ${s.amount ?? ""}`.toLowerCase().includes(view.search.toLowerCase()),
  );
  const filteredSchools = list.schools.filter((s) => `${s.name} ${s.country ?? ""}`.toLowerCase().includes(view.search.toLowerCase()));
  const filteredMajors = list.majors.filter((m) => `${m.name} ${m.category ?? ""}`.toLowerCase().includes(view.search.toLowerCase()));
  const filteredCourses = list.courses.filter(c => `${c.name} ${c.institutionName} ${c.campus ?? ""}`.toLowerCase().includes(view.search.toLowerCase()));
  const paged = <T,>(items: T[], matching: T[]) => {
    const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const page = Math.min(view.page, pageCount);
    const visible = view.filter === "all" ? items.slice(0, OVERVIEW_LIMIT) : matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { visible, matchingCount: matching.length, pageCount, page };
  };
  const scholarshipPage = paged(list.scholarships, filteredScholarships);
  const schoolPage = paged(list.schools, filteredSchools);
  const coursePage = paged(list.courses, filteredCourses);
  const majorPage = paged(list.majors, filteredMajors);
  const searchLabel = view.filter === "scholarship" ? "Search scholarships" : view.filter === "school" ? "Search universities" : view.filter === "major" ? "Search majors" : "Search university courses";

  /** Remove one item optimistically; on failure put back only that item, at
   *  its old position, so other removals that succeeded stay removed. */
  async function remove(kind: ShortlistKind, id: string | number, label: string) {
    const key = `${kind}-${id}`;
    if (isBusy(key)) return;
    const field = FIELDS[kind];
    const before = list![field] as { id: string | number }[];
    const index = before.findIndex((item) => item.id === id);
    const item = before[index];
    setBusyKey(key, true);
    setList((cur) => cur && { ...cur, [field]: (cur[field] as { id: string | number }[]).filter((x) => x.id !== id) });
    try {
      const userId = await getClientUserId();
      if (!userId) throw new Error("Not authenticated");
      await removeFromShortlist(supabase, userId, kind, id);
      toast.success(`Removed ${label}.`);
    } catch {
      setList((cur) => {
        if (!cur || !item) return cur;
        const items = cur[field] as { id: string | number }[];
        if (items.some((x) => x.id === id)) return cur;
        const at = Math.min(index, items.length);
        return { ...cur, [field]: [...items.slice(0, at), item, ...items.slice(at)] } as Shortlist;
      });
      setRestored({ kind, id, label });
      toast.error(`Could not remove ${label}. Please try again.`);
    } finally {
      setBusyKey(key, false);
    }
  }

  /** Only ever called from a labelled click. The busy key is per university,
   *  so a university row and its saved course rows share one in-flight start,
   *  and the result updates every row for that university. */
  async function startApplication(schoolId: number, name: string) {
    const key = `apply-${schoolId}`;
    // The ref, not state, guards two clicks in one tick (state updates batch).
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setBusyKey(key, true);
    try {
      const { application, created } = await startApplicationForSchool(schoolId);
      setList((cur) =>
        cur && {
          ...cur,
          schools: cur.schools.map((s) => (s.id === schoolId ? { ...s, application } : s)),
          courses: cur.courses.map((c) => (c.schoolId === schoolId ? { ...c, application } : c)),
        },
      );
      toast.success(created ? `Added ${name} to My applications.` : `You're already tracking ${name}.`);
    } catch {
      toast.error("Couldn't start tracking. Try again.");
    } finally {
      inFlight.current.delete(key);
      setBusyKey(key, false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-6 pt-0 max-w-5xl">
      <header>
        <p className="font-code text-[10px] uppercase tracking-[0.15em] text-muted-foreground">My shortlist</p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">
          Everything you have <span className={`italic ${MAROON}`}>saved</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Scholarships, universities, majors and courses you are considering, each with what to do next.
        </p>
      </header>

      {restored && restoredIndex >= 0 ? (
        <div role="alert" className="flex flex-col items-start gap-3 border border-[#9a1a27]/30 bg-muted/40 px-4 py-3 text-sm sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 break-words">Could not remove {restored.label}. It is still saved.</p>
          <Button variant="outline" className="rounded-none" onClick={() => {
            updateView({ filter: restored.kind, page: Math.floor(restoredIndex / PAGE_SIZE) + 1, search: "", status: "all" });
            setRestored(null);
          }}>Show restored item</Button>
        </div>
      ) : null}

      {total === 0 ? (
        <div className="border px-6 py-12 text-center">
          <p className="font-display text-xl">Nothing saved yet</p>
          <p className="text-sm text-muted-foreground mt-2">Save anything that looks promising while you explore. It all collects here.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              ["/scholarships", "Browse scholarships"],
              ["/schools", "Browse universities"],
              ["/majors", "Browse majors"],
              ["/courses", "Browse university courses"],
            ].map(([href, label]) => (
              <Button key={href} asChild variant="outline" className="rounded-none">
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Filter shortlist" className="flex max-w-full overflow-x-auto border self-start">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={view.filter === f.key}
                onClick={() => updateView({ filter: f.key, page: 1, search: "", status: "all" })}
                className={`shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 font-code text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.12em] ${
                  view.filter === f.key ? "bg-[#9a1a27] text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {view.filter !== "all" ? (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end max-w-2xl">
              <label className="flex-1 text-sm font-medium">
                Search {view.filter === "scholarship" ? "scholarships" : view.filter === "school" ? "universities" : view.filter === "major" ? "majors" : "university courses"}
                <input
                  type="search"
                  aria-label={searchLabel}
                  value={view.search}
                  onChange={(event) => updateView({ ...view, search: event.target.value, page: 1 })}
                  className="mt-1 block w-full h-10 border bg-background px-3 font-normal"
                />
              </label>
              {view.filter === "scholarship" ? (
                <label className="text-sm font-medium">
                  Status
                  <select
                    aria-label="Scholarship status"
                    value={view.status}
                    onChange={(event) => updateView({ ...view, status: event.target.value as ScholarshipStatus, page: 1 })}
                    className="mt-1 block w-full sm:w-44 h-10 border bg-background px-3 font-normal"
                  >
                    <option value="all">Any status</option>
                    {Object.entries(SCHOLARSHIP_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {show("scholarship") ? (
            <Section
              title="Scholarships"
              count={list.scholarships.length}
              icon={GraduationCap}
              empty={
                <>
                  {view.filter === "all" ? "No saved scholarships." : "No scholarships match these filters."}{" "}
                  <Link href="/scholarships" className={`${MAROON} hover:underline`}>Browse scholarships</Link>
                </>
              }
              hasItems={scholarshipPage.visible.length > 0}
              viewAll={view.filter === "all" && list.scholarships.length > OVERVIEW_LIMIT ? {
                label: `View all scholarships (${list.scholarships.length})`,
                onClick: () => updateView({ filter: "scholarship", page: 1, search: "", status: "all" }),
              } : undefined}
            >
              {scholarshipPage.visible.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex-1 min-w-[14rem]">
                    <Link href={`/scholarships/${s.id}`} className="font-medium text-sm hover:underline">{s.title}</Link>
                    <p className="text-xs text-muted-foreground">
                      {[s.provider, s.amount].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{closes(s.deadlineAt)}</span>
                  <Pill>{SCHOLARSHIP_STATUS_LABELS[s.status]}</Pill>
                  <Link href={`/scholarships/${s.id}`} className={`text-sm ${MAROON} hover:underline inline-flex items-center gap-1`}>
                    {s.status === "interested" ? "Check eligibility" : "Open"} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <RemoveButton label={s.title} busy={isBusy(`scholarship-${s.id}`)} onRemove={() => remove("scholarship", s.id, s.title)} />
                </li>
              ))}
            </Section>
          ) : null}
          {view.filter === "scholarship" && scholarshipPage.matchingCount > 0 ? <Pagination kind="scholarship" page={scholarshipPage.page} pages={scholarshipPage.pageCount} onPage={(page) => updateView({ ...view, page })} /> : null}

          {show("school") ? (
            <Section
              title="Universities"
              count={list.schools.length}
              icon={School}
              empty={
                <>
                  {view.filter === "all" ? "No saved universities." : "No universities match your search."}{" "}
                  <Link href="/schools" className={`${MAROON} hover:underline`}>Browse universities</Link>
                </>
              }
              hasItems={schoolPage.visible.length > 0}
              viewAll={view.filter === "all" && list.schools.length > OVERVIEW_LIMIT ? {
                label: `View all universities (${list.schools.length})`,
                onClick: () => updateView({ filter: "school", page: 1, search: "", status: "all" }),
              } : undefined}
            >
              {schoolPage.visible.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex-1 min-w-[14rem]">
                    <Link href={`/schools/${s.id}`} className="font-medium text-sm hover:underline">{s.name}</Link>
                    {s.country ? <p className="text-xs text-muted-foreground">{s.country}</p> : null}
                  </div>
                  {s.application ? (
                    <>
                      <Pill>{STATUS_CONFIG[s.application.status].label}</Pill>
                      <Link href={`/applications/${s.application.id}`} className={`text-sm ${MAROON} hover:underline inline-flex items-center gap-1`}>
                        Open application <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-none bg-[#9a1a27] hover:bg-[#7d141f] text-white"
                      disabled={isBusy(`apply-${s.id}`)}
                      onClick={() => startApplication(s.id, s.name)}
                    >
                      {isBusy(`apply-${s.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      Start application
                    </Button>
                  )}
                  <RemoveButton label={s.name} busy={isBusy(`school-${s.id}`)} onRemove={() => remove("school", s.id, s.name)} />
                </li>
              ))}
            </Section>
          ) : null}
          {view.filter === "school" && schoolPage.matchingCount > 0 ? <Pagination kind="school" page={schoolPage.page} pages={schoolPage.pageCount} onPage={(page) => updateView({ ...view, page })} /> : null}

          {show("course") ? (
            <Section title="University courses" count={list.courses.length} icon={BookOpen}
              empty={<>{view.filter === "all" ? "No saved university courses." : "No university courses match your search."} <Link href="/courses" className={`${MAROON} hover:underline`}>Browse university courses</Link></>}
              hasItems={coursePage.visible.length > 0}
              viewAll={view.filter === "all" && list.courses.length > OVERVIEW_LIMIT ? { label: `View all university courses (${list.courses.length})`, onClick: () => updateView({ filter: "course", page: 1, search: "", status: "all" }) } : undefined}>
              {coursePage.visible.map(c => <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="flex-1 min-w-[14rem]">
                  <Link href={`/courses?course=${encodeURIComponent(c.id)}`} className="font-medium text-sm hover:underline">{c.name}</Link>
                  <p className="text-xs text-muted-foreground">{c.institutionName}{c.campus ? ` · ${c.campus}` : ''}</p>
                  {!c.active && <p className="text-xs text-muted-foreground">No longer in the active catalogue. Check current availability. <ProviderLink href={c.sourceUrl}>Check with the provider<span className="sr-only"> about {c.name}</span></ProviderLink></p>}
                </div>
                <Link href={`/courses?course=${encodeURIComponent(c.id)}`} className={`text-sm ${MAROON} hover:underline`}>Review course details</Link>
                <CourseApplicationAction
                  institutionName={c.institutionName}
                  schoolId={c.schoolId}
                  application={c.application}
                  busy={c.schoolId !== null && isBusy(`apply-${c.schoolId}`)}
                  unavailable={false}
                  onStart={() => { if (c.schoolId !== null) void startApplication(c.schoolId, c.institutionName); }}
                  onRetry={() => router.refresh()}
                />
                <RemoveButton label={c.name} busy={isBusy(`course-${c.id}`)} onRemove={() => remove("course", c.id, c.name)} />
              </li>)}
            </Section>
          ) : null}
          {view.filter === "course" && coursePage.matchingCount > 0 ? <Pagination kind="course" page={coursePage.page} pages={coursePage.pageCount} onPage={(page) => updateView({ ...view, page })} /> : null}

          {show("major") ? (
            <Section
              title="Majors"
              count={list.majors.length}
              icon={BookOpen}
              empty={
                <>
                  {view.filter === "all" ? "No saved majors." : "No majors match your search."}{" "}
                  <Link href="/majors" className={`${MAROON} hover:underline`}>Browse majors</Link>
                </>
              }
              hasItems={majorPage.visible.length > 0}
              viewAll={view.filter === "all" && list.majors.length > OVERVIEW_LIMIT ? {
                label: `View all majors (${list.majors.length})`,
                onClick: () => updateView({ filter: "major", page: 1, search: "", status: "all" }),
              } : undefined}
            >
              {majorPage.visible.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="flex-1 min-w-[14rem]">
                    <Link href={`/majors/${m.id}`} className="font-medium text-sm hover:underline">{m.name}</Link>
                    {m.category ? <p className="text-xs text-muted-foreground">{m.category}</p> : null}
                  </div>
                  <Link href={`/majors/${m.id}`} className={`text-sm ${MAROON} hover:underline inline-flex items-center gap-1`}>
                    See where to study it <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <RemoveButton label={m.name} busy={isBusy(`major-${m.id}`)} onRemove={() => remove("major", m.id, m.name)} />
                </li>
              ))}
            </Section>
          ) : null}
          {view.filter === "major" && majorPage.matchingCount > 0 ? <Pagination kind="major" page={majorPage.page} pages={majorPage.pageCount} onPage={(page) => updateView({ ...view, page })} /> : null}
        </>
      )}
    </div>
  );
}
