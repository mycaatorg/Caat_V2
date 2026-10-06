"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Plus,
  Check,
  ChevronDown,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { parseLocalDate } from "@/lib/local-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchApplicationHub,
  updateApplicationStatus,
  updateApplicationDeadline,
  fetchMajorOptions,
  type ApplicationHub,
} from "./api";
import { updateApplicationMajors } from "@/app/(main)/applications/api";
import { SCHOLARSHIP_STATUS_LABELS } from "@/lib/scholarship-tracking";
import {
  APPLICATION_STATUSES,
  STATUS_CONFIG,
  isSubmittedStatus,
  type ApplicationRow,
  type ApplicationStatus,
} from "@/types/applications";

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr.slice(0, 10) + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Round, not ceil: a DST transition makes the span 23h or 25h, which ceil
  // turns into an off-by-one day count.
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
function deadlineParts(dateStr: string | null) {
  if (!dateStr) return { num: "-", label: "no deadline set", color: "text-muted-foreground" };
  const d = daysUntil(dateStr);
  const color = d < 0 || d <= 7 ? "text-[#9a1a27] dark:text-[#e06b78]" : d <= 30 ? "text-amber-600 dark:text-amber-400" : "text-green-600";
  const num = d < 0 ? `${Math.abs(d)}d` : d === 0 ? "Today" : `${d}d`;
  const label = d < 0 ? "overdue" : "until due";
  return { num, label, color };
}
function fmtDate(s: string | null) {
  if (!s) return null;
  // Parse the date-only portion in local time so a UTC-midnight parse doesn't
  // display the previous calendar day for users west of UTC.
  return parseLocalDate(s.slice(0, 10)).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function ApplicationHubClient({ applicationId }: { applicationId: string }) {
  const [hub, setHub] = useState<ApplicationHub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [majorOptions, setMajorOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchMajorOptions().then(setMajorOptions).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchApplicationHub(applicationId);
      setHub(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this application");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
     
    void load();
  }, [load]);

  // Status and deadline writes go out in the order they were made, so the
  // saved row always matches the last thing the student chose.
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());

  /** Optimistically set one application field and persist it. On failure undo
   *  only that field, and only if a newer edit has not replaced it. Readiness
   *  is derived from the application at render time, so no refetch is needed
   *  (one could also overwrite an edit that is still saving). */
  const saveField = async <K extends "status" | "deadline_at">(
    key: K,
    value: ApplicationRow[K],
    write: (id: string) => Promise<void>,
    fallbackMessage: string
  ) => {
    if (!hub) return;
    const id = hub.application.id;
    const previous = hub.application[key];
    const setField = (from: ApplicationRow[K] | undefined, to: ApplicationRow[K]) =>
      setHub((cur) =>
        cur && (from === undefined || cur.application[key] === from)
          ? { ...cur, application: { ...cur.application, [key]: to } }
          : cur
      );
    setField(undefined, value);
    const pending = writeChain.current.catch(() => {}).then(() => write(id));
    writeChain.current = pending;
    try {
      await pending;
    } catch (e) {
      setField(value, previous);
      toast.error(e instanceof Error ? e.message : fallbackMessage);
    }
  };

  const onStatusChange = async (status: ApplicationStatus) => {
    setSavingStatus(true);
    try {
      await saveField("status", status, (id) => updateApplicationStatus(id, status), "Could not update status");
    } finally {
      setSavingStatus(false);
    }
  };

  // M9 — set/clear the application deadline from the hub (was read-only).
  const onDeadlineChange = (value: string) => {
    const deadline_at = value || null;
    void saveField("deadline_at", deadline_at, (id) => updateApplicationDeadline(id, deadline_at), "Could not update deadline");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-2/3" />
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0 space-y-6">
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
            <div className="w-full lg:w-[300px] lg:shrink-0 space-y-6">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (error || !hub) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto py-20 text-center">
          <p className="text-muted-foreground mb-4">{error ?? "Application not found."}</p>
          <Link href="/applications" className="text-sm text-[#9a1a27] dark:text-[#e06b78] hover:underline">
            ← Back to applications
          </Link>
        </div>
      </div>
    );
  }

  const {
    application,
    schoolId,
    schoolName,
    schoolCountry,
    intendedMajors,
    trackedScholarships,
    readiness,
    essaysForSchool,
    essaysShared,
    schoolDocuments,
    sharedDocuments,
    scholarships,
  } = hub;
  const dl = deadlineParts(application.deadline_at);
  // The checklist follows the application as edited here; essay and document
  // signals come from the load.
  const deadlineSet = !!application.deadline_at;
  const submitted = isSubmittedStatus(application.status);
  const readyScore =
    (deadlineSet ? 1 : 0) + (readiness.essayDrafted ? 1 : 0) + (readiness.keyDocsUploaded ? 1 : 0) + (submitted ? 1 : 0);

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        {/* back */}
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Applications
        </Link>

        {/* header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{schoolName}</h1>
          <MajorsEditor
            applicationId={application.id}
            country={schoolCountry}
            initial={intendedMajors}
            options={majorOptions}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT */}
          <div className="flex-1 min-w-0 w-full space-y-6">
            {/* readiness */}
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Readiness</CardTitle>
                <span className="text-sm text-muted-foreground">{readyScore} of 4 ready</span>
              </CardHeader>
              <CardContent>
                <div className="h-1.5 w-full rounded-full bg-muted mb-5">
                  <div
                    className="h-full rounded-full bg-[#9a1a27] transition-all"
                    style={{ width: `${(readyScore / 4) * 100}%` }}
                  />
                </div>
                <ul className="space-y-3">
                  <ReadyItem done={deadlineSet}>Deadline is set</ReadyItem>
                  <ReadyItem done={readiness.essayDrafted}>At least one essay drafted</ReadyItem>
                  <ReadyItem done={readiness.keyDocsUploaded}>Key documents uploaded</ReadyItem>
                  <ReadyItem done={submitted}>
                    Status reached <span className="font-medium text-foreground">Submitted</span>
                  </ReadyItem>
                </ul>
              </CardContent>
            </Card>

            {/* essays */}
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Essays</CardTitle>
                <Link
                  href="/essays"
                  className="text-sm text-[#9a1a27] dark:text-[#e06b78] hover:underline inline-flex items-center gap-1"
                >
                  Open essays <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </CardHeader>
              <CardContent>
                {essaysForSchool.length > 0 ? (
                  <>
                    <GroupLabel>For this school</GroupLabel>
                    <ul className="divide-y mb-1">
                      {essaysForSchool.map((e) => (
                        <EssayRow key={e.promptId} e={e} />
                      ))}
                    </ul>
                  </>
                ) : null}
                {essaysShared.length > 0 ? (
                  <>
                    <GroupLabel>Shared across all your applications</GroupLabel>
                    <ul className="divide-y">
                      {essaysShared.map((e) => (
                        <EssayRow key={e.promptId} e={e} />
                      ))}
                    </ul>
                  </>
                ) : null}
                <Link
                  href={`/essays?school=${schoolId}`}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-2.5 text-sm text-[#9a1a27] dark:text-[#e06b78] hover:bg-muted/40"
                >
                  <Plus className="h-4 w-4" /> Start an essay for {schoolName}
                </Link>
              </CardContent>
            </Card>

            {/* documents */}
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Documents</CardTitle>
                <Link
                  href="/documents"
                  className="text-sm text-[#9a1a27] dark:text-[#e06b78] hover:underline inline-flex items-center gap-1"
                >
                  Open documents <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </CardHeader>
              <CardContent>
                {schoolDocuments.length > 0 ? (
                  <>
                    <GroupLabel>For this school</GroupLabel>
                    <ul className="divide-y mb-1">
                      {schoolDocuments.map((d) => (
                        <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                          <span className="font-medium text-sm truncate">{d.fileName}</span>
                          {d.status === "verified" ? (
                            <StatusText tone="green">Verified</StatusText>
                          ) : (
                            <StatusText tone="amber">Pending review</StatusText>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <GroupLabel>Shared documents</GroupLabel>
                <ul className="divide-y">
                  {sharedDocuments.map((d) => (
                    <li key={d.category} className="flex items-center justify-between gap-3 py-3">
                      <span className="font-medium text-sm">{d.label}</span>
                      {d.status === "verified" ? (
                        <StatusText tone="green">Verified</StatusText>
                      ) : d.status === "pending" ? (
                        <StatusText tone="amber">Pending review</StatusText>
                      ) : (
                        <StatusText tone="maroon">Not uploaded</StatusText>
                      )}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/documents?school=${schoolId}`}
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-2.5 text-sm text-[#9a1a27] dark:text-[#e06b78] hover:bg-muted/40"
                >
                  <Plus className="h-4 w-4" /> Attach a document for {schoolName}
                </Link>
              </CardContent>
            </Card>

            {/* scholarships */}
            <Card className="shadow-sm">
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Scholarships for this school</CardTitle>
                <Link
                  href="/scholarships"
                  className="text-sm text-[#9a1a27] dark:text-[#e06b78] hover:underline inline-flex items-center gap-1"
                >
                  Browse all <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </CardHeader>
              <CardContent>
                {trackedScholarships.length > 0 ? (
                  <div className="mb-5">
                    <GroupLabel>You&apos;re tracking</GroupLabel>
                    <ul className="space-y-2.5">
                      {trackedScholarships.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-lg border bg-muted/20 px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{s.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {s.amount ?? s.provider}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                            {SCHOLARSHIP_STATUS_LABELS[s.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {scholarships.length > 0 ? (
                      <GroupLabel>Also listed for this school</GroupLabel>
                    ) : null}
                  </div>
                ) : null}
                {scholarships.length === 0 && trackedScholarships.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center">
                    <p className="font-medium mb-1">No scholarships found for this school yet</p>
                    <p className="text-sm text-muted-foreground">
                      We don&apos;t have scholarships for {schoolCountry ?? "this country"} in our
                      database yet. As we add them, the best matches for your profile will appear
                      here automatically.
                    </p>
                  </div>
                ) : scholarships.length === 0 ? null : (
                  <>
                    <ul className="space-y-3">
                      {scholarships.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-lg border bg-muted/20 px-4 py-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{s.title}</div>
                            <div className="text-xs text-muted-foreground truncate">{s.provider}</div>
                          </div>
                          {s.amount ? (
                            <span className="shrink-0 max-w-[40%] text-right text-sm font-semibold line-clamp-2">
                              {s.amount}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-3">
                      Listed for {schoolName}, best fit first.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT RAIL */}
          <div className="w-full lg:w-[300px] lg:shrink-0 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="space-y-0">
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={savingStatus}
                      className="w-full justify-between font-normal"
                    >
                      {STATUS_CONFIG[application.status].label}
                      {savingStatus ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    {APPLICATION_STATUSES.map((s) => (
                      <DropdownMenuItem key={s} onSelect={() => onStatusChange(s)}>
                        {STATUS_CONFIG[s].label}
                        {application.status === s ? (
                          <Check className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground mt-2">Move it along as you progress.</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="space-y-0">
                <CardTitle className="text-base">Deadline</CardTitle>
              </CardHeader>
              <CardContent>
                {application.deadline_at ? (
                  <>
                    <div className={`text-4xl font-bold tracking-tight ${dl.color}`}>{dl.num}</div>
                    <div className="text-sm text-muted-foreground mt-1">{dl.label}</div>
                    <div className="text-xs text-muted-foreground mt-3">{fmtDate(application.deadline_at)}</div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground mb-3">No deadline set</div>
                )}
                {/* M9 — make the deadline actionable from the hub. */}
                <div className="mt-4 flex items-center gap-2">
                  <label htmlFor="hub-deadline" className="text-xs text-muted-foreground">
                    {application.deadline_at ? "Change" : "Set"} deadline
                  </label>
                  <Input
                    id="hub-deadline"
                    type="date"
                    value={application.deadline_at ?? ""}
                    onChange={(e) => onDeadlineChange(e.target.value)}
                    className="h-8 w-auto text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            {submitted ? (
              <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10 px-5 py-5 text-center">
                <div className="inline-flex items-center gap-1.5 text-green-700 dark:text-green-400 font-semibold">
                  <CheckCircle2 className="h-5 w-5" /> Submitted
                </div>
                <p className="text-xs text-muted-foreground mt-1">Nice work. Now you wait.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- editable "applying for" majors (per-application) ---- */

function MajorsEditor({
  applicationId,
  country,
  initial,
  options,
}: {
  applicationId: string;
  country: string | null;
  initial: string[];
  options: string[];
}) {
  const [majors, setMajors] = useState<string[]>(initial);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  // Each save writes the whole list, so one save at a time: overlapping saves
  // could land out of order or roll back over each other.
  const [saving, setSaving] = useState(false);

  const persist = async (next: string[], typed = "") => {
    if (saving) return;
    const prev = majors;
    setSaving(true);
    setMajors(next);
    try {
      await updateApplicationMajors(applicationId, next);
    } catch {
      setMajors(prev);
      // Give back what the student typed so a retry is one keypress.
      if (typed) setInput(typed);
      toast.error("Could not save majors.");
    } finally {
      setSaving(false);
    }
  };
  const add = (name: string) => {
    const v = name.trim();
    if (saving || !v || majors.some((m) => m.toLowerCase() === v.toLowerCase())) return;
    setInput("");
    void persist([...majors, v], v);
  };
  const remove = (name: string) => void persist(majors.filter((m) => m !== name));

  const suggestions =
    input.trim().length > 0
      ? options
          .filter((o) => o.toLowerCase().includes(input.toLowerCase()) && !majors.some((m) => m.toLowerCase() === o.toLowerCase()))
          .slice(0, 6)
      : [];

  // read mode
  if (!editing) {
    const shown = majors.slice(0, 2).join(", ");
    const extra = majors.length > 2 ? ` +${majors.length - 2} more` : "";
    const clause = majors.length > 0 ? `applying for ${shown}${extra}` : null;
    const text = [country, clause].filter(Boolean).join(" · ");
    return (
      <p className="text-sm text-muted-foreground mt-1 flex items-center flex-wrap gap-x-1.5 gap-y-1">
        <span>{text || "Your application"}</span>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 text-[#9a1a27] dark:text-[#e06b78] hover:underline ml-1"
        >
          <Pencil className="h-3 w-3" />
          {majors.length > 0 ? "edit majors" : "add majors"}
        </button>
      </p>
    );
  }

  // edit mode
  return (
    <div className="mt-2 max-w-lg">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {country ? <span className="text-sm text-muted-foreground mr-1">{country} · applying for</span> : null}
        {majors.map((m) => (
          <span key={m} className="inline-flex items-center gap-1.5 text-sm rounded-md bg-muted px-2.5 py-0.5">
            {m}
            <button
              onClick={() => remove(m)}
              disabled={saving}
              aria-label={`Remove ${m}`}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {majors.length === 0 ? <span className="text-sm text-muted-foreground">No majors yet</span> : null}
      </div>
      <div className="relative">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(suggestions[0] ?? input);
            }
          }}
          placeholder="Add a major…"
          className="h-8 text-sm max-w-xs"
        />
        {suggestions.length > 0 ? (
          <ul className="absolute z-50 mt-1 w-full max-w-xs rounded-md border bg-popover shadow-md text-sm overflow-hidden">
            {suggestions.map((o) => (
              <li
                key={o}
                onMouseDown={(e) => {
                  e.preventDefault();
                  add(o);
                }}
                className="cursor-pointer px-3 py-1.5 hover:bg-accent"
              >
                {o}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <button onClick={() => { setEditing(false); setInput(""); }} className="text-xs text-[#9a1a27] dark:text-[#e06b78] hover:underline mt-2">
        Done
      </button>
    </div>
  );
}

/* ---- helpers in the app's design language ---- */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mt-4 first:mt-0 mb-1">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-muted-foreground/70">
        {children}
      </span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

function EssayRow({ e }: { e: { promptId: string; title: string; status: "drafted" | "to-write"; lastEdited: string | null } }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="font-medium text-sm">{e.title}</div>
        <div className="text-xs text-muted-foreground">
          {e.status === "drafted"
            ? e.lastEdited
              ? `Last edited ${fmtDate(e.lastEdited)}`
              : "Drafted"
            : "Not started"}
        </div>
      </div>
      {e.status === "drafted" ? (
        <StatusText tone="green">Drafted</StatusText>
      ) : (
        <StatusText tone="maroon">To write</StatusText>
      )}
    </li>
  );
}

function ReadyItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li data-state={done ? "done" : "todo"} className="flex items-center gap-2.5 text-sm">
      {done ? (
        <CheckCircle2 className="h-[18px] w-[18px] text-[#9a1a27] dark:text-[#e06b78] shrink-0" />
      ) : (
        <Circle className="h-[18px] w-[18px] text-muted-foreground/40 shrink-0" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{children}</span>
    </li>
  );
}

function StatusText({ tone, children }: { tone: "green" | "amber" | "maroon"; children: React.ReactNode }) {
  const map = {
    green: { cls: "text-green-600", Icon: CheckCircle2 },
    amber: { cls: "text-amber-600 dark:text-amber-400", Icon: Clock },
    maroon: { cls: "text-[#9a1a27] dark:text-[#e06b78]", Icon: AlertTriangle },
  } as const;
  const { cls, Icon } = map[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap ${cls}`}>
      <Icon className="h-4 w-4" /> {children}
    </span>
  );
}
