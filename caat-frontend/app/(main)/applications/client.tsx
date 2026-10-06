"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Trash2,
  ExternalLink,
  ClipboardList,
  Bookmark,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchApplications,
  addApplication,
  updateApplication,
  deleteApplication,
  searchSchools,
  fetchUnimportedBookmarkCount,
  importBookmarkedSchools,
  fetchGlobalReadinessSignals,
} from "./api";
import type { ApplicationRow, ApplicationStatus } from "@/types/applications";
import { STATUS_CONFIG, APPLICATION_STATUSES, isSubmittedStatus } from "@/types/applications";

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------
type FilterKey = "all" | "active" | "outcome";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "In Progress" },
  { key: "outcome", label: "Outcome" },
];

const ACTIVE_STATUSES = new Set<ApplicationStatus>([
  "researching",
  "applying",
  "submitted",
  "decision_pending",
]);
const OUTCOME_STATUSES = new Set<ApplicationStatus>([
  "accepted",
  "rejected",
  "waitlisted",
  "withdrawn",
]);

function matchesFilter(status: ApplicationStatus, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "active") return ACTIVE_STATUSES.has(status);
  return OUTCOME_STATUSES.has(status);
}

// ---------------------------------------------------------------------------
// Countdown helper
// ---------------------------------------------------------------------------
function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Round, not ceil: a DST transition makes the span 23h or 25h, and ceil turns
  // a same-count day into an off-by-one. Round keeps the whole-day count stable.
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function deadlineLabel(dateStr: string) {
  const days = daysUntil(dateStr);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "text-[#9a1a27] dark:text-[#e06b78]" };
  if (days === 0) return { text: "Today", color: "text-[#9a1a27] dark:text-[#e06b78]" };
  if (days <= 7) return { text: `${days}d`, color: "text-[#9a1a27] dark:text-[#e06b78]" };
  if (days <= 30) return { text: `${days}d`, color: "text-amber-600 dark:text-amber-400" };
  return { text: `${days}d`, color: "text-green-600 dark:text-green-400" };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
type EditableField = "status" | "deadline_at" | "notes";

export default function ApplicationsClient() {
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  // Add-school search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: number; name: string; country: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addingSchoolRef = useRef(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Bulk-import bookmarks bridge
  const [unimportedCount, setUnimportedCount] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  // Global readiness signals (any essay draft, any document) shared by every
  // card's readiness bar in v1; combined per-card with deadline + status.
  const [globalReady, setGlobalReady] = useState<{ essayDrafted: boolean; keyDocsUploaded: boolean }>({
    essayDrafted: false,
    keyDocsUploaded: false,
  });

  // Writes for one application run in the order the student made them, so the
  // database never ends on an older value than the screen shows.
  const writeChains = useRef(new Map<string, Promise<unknown>>());
  // Applications removed in this session: a pending autosave that lands after
  // the removal is moot, not a failure worth reporting.
  const removedIds = useRef(new Set<string>());

  function enqueueWrite(id: string, write: () => Promise<void>): Promise<void> {
    const previous = writeChains.current.get(id) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(write);
    writeChains.current.set(id, next);
    return next;
  }

  // Per application field: the last value the server confirmed, and the
  // newest write. Only the newest write may undo, and it undoes to the last
  // confirmed value, never to an earlier optimistic value that also failed.
  const confirmedValues = useRef(new Map<string, ApplicationRow[EditableField]>());
  const latestWrite = useRef(new Map<string, number>());

  const loadApplications = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    fetchApplications()
      .then(setApps)
      .catch(() => {
        // A failed load is not an empty list: never show "No applications yet".
        setLoadError(true);
        toast.error("Failed to load applications.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadApplications();
    fetchUnimportedBookmarkCount()
      .then(setUnimportedCount)
      .catch(() => setUnimportedCount(0));
    fetchGlobalReadinessSignals()
      .then(setGlobalReady)
      .catch(() => {});
  }, [loadApplications]);

  async function handleImportBookmarks() {
    if (importing) return;
    setImporting(true);
    try {
      const { added } = await importBookmarkedSchools();
      if (added.length === 0) {
        toast.info("All bookmarked schools are already in your applications.");
      } else {
        setApps((prev) => [...added, ...prev]);
        setFreshIds(new Set(added.map((a) => a.id)));
        const names = added.map((a) => a.schools?.name ?? "Unknown").join(", ");
        toast.success(
          `Added ${added.length} school${added.length === 1 ? "" : "s"} as Researching: ${names}`,
          { duration: 6000 }
        );
      }
    } catch {
      toast.error("Failed to import bookmarks.");
      setImporting(false);
      return;
    }
    // The import already succeeded; a failed badge refresh must not report it
    // as a failed import. Every bookmark was just imported, so hide the badge.
    try {
      setUnimportedCount(await fetchUnimportedBookmarkCount());
    } catch {
      setUnimportedCount(0);
    } finally {
      setImporting(false);
    }
  }

  // Debounced school search
  const handleSearchInput = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchSchools(q);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
        toast.error("School search failed. Please try again.");
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  async function handleAddSchool(schoolId: number) {
    // Check if already tracked
    if (apps.some((a) => a.school_id === schoolId)) {
      toast.info("This school is already in your applications.");
      return;
    }
    // In-flight guard: a rapid double-click would otherwise fire two
    // addApplication calls (the apps.some check hasn't updated yet), creating
    // a duplicate application.
    if (addingSchoolRef.current) return;
    addingSchoolRef.current = true;
    try {
      const row = await addApplication(schoolId);
      setApps((prev) => [row, ...prev]);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      toast.success("School added to applications.");
    } catch {
      toast.error("Failed to add school.");
    } finally {
      addingSchoolRef.current = false;
    }
  }

  /** Optimistically set one field, persist it in order, and on failure undo
   *  only that field (a refetch could itself fail and drop other edits). */
  async function saveField<K extends EditableField>(
    id: string,
    key: K,
    value: ApplicationRow[K],
    failureMessage: string
  ): Promise<boolean> {
    const slot = `${id}:${key}`;
    // The first write to a field starts from the loaded (server) value.
    if (!confirmedValues.current.has(slot)) {
      confirmedValues.current.set(slot, apps.find((a) => a.id === id)?.[key] ?? null);
    }
    const seq = (latestWrite.current.get(slot) ?? 0) + 1;
    latestWrite.current.set(slot, seq);
    setApps((cur) => cur.map((a) => (a.id === id ? { ...a, [key]: value } : a)));
    try {
      await enqueueWrite(id, () => updateApplication(id, { [key]: value }));
      confirmedValues.current.set(slot, value);
      return true;
    } catch {
      // A newer write for this field supersedes this one; a removed row's
      // field is restored from confirmed values if the removal fails.
      if (removedIds.current.has(id) || latestWrite.current.get(slot) !== seq) return false;
      toast.error(failureMessage);
      const confirmed = confirmedValues.current.get(slot) as ApplicationRow[K];
      setApps((cur) => cur.map((a) => (a.id === id ? { ...a, [key]: confirmed } : a)));
      return false;
    }
  }

  /** The row as the server has it: confirmed values over a click-time copy. */
  function withConfirmedValues(row: ApplicationRow): ApplicationRow {
    const restored = { ...row };
    for (const key of ["status", "deadline_at", "notes"] as const) {
      const slot = `${row.id}:${key}`;
      if (confirmedValues.current.has(slot)) {
        Object.assign(restored, { [key]: confirmedValues.current.get(slot) });
      }
    }
    return restored;
  }

  function handleStatusChange(id: string, status: ApplicationStatus) {
    void saveField(id, "status", status, "Failed to update status.");
  }

  function handleDeadlineChange(id: string, deadline_at: string) {
    void saveField(id, "deadline_at", deadline_at || null, "Failed to update deadline.");
  }

  function handleNotesChange(id: string, notes: string): Promise<boolean> {
    return saveField(id, "notes", notes || null, "Failed to update notes.");
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null);
    const index = apps.findIndex((a) => a.id === id);
    const removed = apps[index];
    removedIds.current.add(id);
    setApps((a) => a.filter((x) => x.id !== id));
    try {
      await enqueueWrite(id, () => deleteApplication(id));
      toast.success("Application removed.");
    } catch {
      removedIds.current.delete(id);
      // Put the row back where it was, as last saved, without rolling back
      // other cards. Writes queued before the removal have settled by now.
      setApps((cur) =>
        !removed || cur.some((a) => a.id === id)
          ? cur
          : [...cur.slice(0, index), withConfirmedValues(removed), ...cur.slice(index)]
      );
      toast.error("Failed to remove application.");
    }
  }

  const filtered = useMemo(
    () => apps.filter((a) => matchesFilter(a.status, filter)),
    [apps, filter]
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">My Applications</h1>
          <Badge variant="secondary" className="text-sm font-semibold">
            {apps.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unimportedCount !== null && unimportedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleImportBookmarks}
              disabled={importing}
              className="gap-1.5"
            >
              <Bookmark className="h-4 w-4" />
              Import from Bookmarks
              <span className="ml-1 inline-flex items-center justify-center text-[10px] font-semibold bg-[#9a1a27] text-white px-1.5 rounded-md leading-none py-0.5">
                {unimportedCount}
              </span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="gap-1.5 bg-[#9a1a27] text-white hover:bg-[#7d141f] border-[#9a1a27] dark:border-[#e06b78]"
          >
            <Plus className="h-4 w-4" />
            Add School
          </Button>
        </div>
      </div>

      {/* Add school search panel */}
      {showSearch && (
        <div className="mb-6 rounded-lg border bg-card p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search for a school by name..."
              className="pl-9"
              autoFocus
            />
          </div>
          {searching && (
            <p className="text-sm text-muted-foreground">Searching…</p>
          )}
          {searchResults.length > 0 && (
            <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
              {searchResults.map((school) => {
                const alreadyTracked = apps.some(
                  (a) => a.school_id === school.id
                );
                return (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => handleAddSchool(school.id)}
                    disabled={alreadyTracked}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>
                      {school.name}
                      {school.country && (
                        <span className="text-muted-foreground ml-1.5">
                          · {school.country}
                        </span>
                      )}
                    </span>
                    {alreadyTracked ? (
                      <span className="text-xs text-muted-foreground">
                        Already tracked
                      </span>
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {searchQuery && !searching && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">No schools found.</p>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`inline-flex items-center rounded-md px-3 py-1 text-sm font-medium transition-colors border ${
              filter === f.key
                ? "bg-[#9a1a27] text-white border-[#9a1a27] dark:border-[#e06b78]"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Applications list */}
      {loadError ? (
        <div role="alert" className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <p className="text-base font-medium">Couldn&apos;t load your applications.</p>
          <Button size="sm" variant="outline" onClick={loadApplications}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-base font-medium text-muted-foreground">
            {apps.length === 0
              ? "No applications yet"
              : "No applications match this filter"}
          </p>
          {apps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Click &quot;Add School&quot; to start tracking your first
              application.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              onStatusChange={handleStatusChange}
              onDeadlineChange={handleDeadlineChange}
              onNotesChange={handleNotesChange}
              onDelete={handleDelete}
              confirmDeleteId={confirmDeleteId}
              setConfirmDeleteId={setConfirmDeleteId}
              isFresh={freshIds.has(app.id)}
              globalReady={globalReady}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Application card
// ---------------------------------------------------------------------------
function ApplicationCard({
  app,
  onStatusChange,
  onDeadlineChange,
  onNotesChange,
  onDelete,
  confirmDeleteId,
  setConfirmDeleteId,
  isFresh = false,
  globalReady,
}: {
  app: ApplicationRow;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDeadlineChange: (id: string, deadline: string) => void;
  onNotesChange: (id: string, notes: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  isFresh?: boolean;
  globalReady: { essayDrafted: boolean; keyDocsUploaded: boolean };
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(app.notes ?? "");
  const [notesState, setNotesState] = useState<"saved" | "saving" | "failed">("saved");
  const notesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesSaveSeq = useRef(0);

  // B18 — mark Saved only once the write resolves; a failed save must say so
  // rather than spin on "Saving…". Only the newest save may set the indicator.
  async function saveNotes(val: string) {
    const seq = ++notesSaveSeq.current;
    setNotesState("saving");
    const ok = await onNotesChange(app.id, val);
    if (seq === notesSaveSeq.current) setNotesState(ok ? "saved" : "failed");
  }

  function handleNotesInput(val: string) {
    setLocalNotes(val);
    // Newer unsent text makes any in-flight save's result stale.
    notesSaveSeq.current++;
    setNotesState("saving");
    if (notesTimeout.current) clearTimeout(notesTimeout.current);
    notesTimeout.current = setTimeout(() => void saveNotes(val), 800);
  }

  const schoolName = app.schools?.name ?? "Unknown School";
  const schoolCountry = app.schools?.country;
  const dl = app.deadline_at ? deadlineLabel(app.deadline_at) : null;

  // Readiness rollup (same 4 signals as the hub): deadline set, an essay
  // drafted, a document uploaded, status advanced to submitted-or-later.
  const readyScore =
    (app.deadline_at ? 1 : 0) +
    (globalReady.essayDrafted ? 1 : 0) +
    (globalReady.keyDocsUploaded ? 1 : 0) +
    (isSubmittedStatus(app.status) ? 1 : 0);

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isFresh ? "bg-[#FFF8E1] dark:bg-amber-950/40 border-l-[3px] border-l-[#9a1a27] dark:border-l-[#e06b78]" : "bg-card"}`}>
      {/* Top row: school info + status + actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <Link
              href={`/schools/${app.school_id}`}
              className="text-sm font-semibold hover:underline underline-offset-2 flex items-center gap-1.5"
            >
              {isFresh && (
                <span className="text-[9px] font-bold uppercase tracking-wide bg-[#9a1a27] text-white px-1.5 py-0.5">
                  New
                </span>
              )}
              {schoolName}
              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            </Link>
            {schoolCountry && (
              <span className="text-xs text-muted-foreground">
                {schoolCountry}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Status select */}
          <div className="relative">
            <Select
              value={app.status}
              onValueChange={(v) => onStatusChange(app.id, v as ApplicationStatus)}
            >
              <SelectTrigger
                size="sm"
                className={`h-auto w-auto rounded-md px-3 py-1 text-xs font-medium border-0 gap-1 ${STATUS_CONFIG[app.status].className}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Deadline */}
          <input
            type="date"
            value={app.deadline_at ?? ""}
            onChange={(e) => onDeadlineChange(app.id, e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            title="Application deadline"
            aria-label={`Application deadline for ${schoolName}`}
          />

          {/* Deadline countdown */}
          {dl && (
            <span className={`text-xs font-medium ${dl.color}`}>
              {dl.text}
            </span>
          )}

          {/* Notes toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 text-muted-foreground relative"
            onClick={() => setNotesOpen(!notesOpen)}
          >
            Notes
            {!notesOpen && localNotes.trim() && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500" />
            )}
          </Button>

          {/* Delete */}
          {confirmDeleteId === app.id ? (
            <div className="flex items-center gap-1">
              <button
                className="h-7 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors"
                onClick={() => onDelete(app.id)}
              >
                Confirm
              </button>
              <button
                className="h-7 px-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded transition-colors"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(app.id)}
              className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              aria-label="Remove application"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Notes section */}
      {notesOpen && (
        <div className="space-y-2">
          <textarea
            value={localNotes}
            onChange={(e) => handleNotesInput(e.target.value)}
            placeholder="Add notes about this application…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[60px]"
          />
          <div className="flex items-center justify-between">
            <span
              aria-live="polite"
              className={`text-xs ${notesState === "failed" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {notesState === "saved" ? "Saved" : notesState === "saving" ? "Saving…" : "Not saved"}
            </span>
            <div className="flex items-center gap-2">
              {localNotes.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                  onClick={async () => {
                    // Cancel any pending debounced save so it can't fire with
                    // the old text and re-add the notes we just cleared.
                    if (notesTimeout.current) clearTimeout(notesTimeout.current);
                    setLocalNotes("");
                    await saveNotes("");
                  }}
                >
                  Clear Notes
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs px-3"
                onClick={async () => {
                  if (notesTimeout.current) clearTimeout(notesTimeout.current);
                  await saveNotes(localNotes);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Readiness bar + open-hub link */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex-1">
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <div className="h-full bg-[#9a1a27]" style={{ width: `${(readyScore / 4) * 100}%` }} />
          </div>
        </div>
        <span className="font-code text-[10px] uppercase tracking-[0.06em] text-muted-foreground whitespace-nowrap">
          readiness {readyScore}/4
        </span>
        <Link
          href={`/applications/${app.id}`}
          className="font-code text-[11px] text-[#9a1a27] dark:text-[#e06b78] hover:underline whitespace-nowrap inline-flex items-center gap-1"
        >
          open <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
