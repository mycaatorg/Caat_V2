"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  fetchApplications,
  addApplication,
  updateApplication,
  deleteApplication,
  searchSchools,
} from "./api";
import type { ApplicationRow, ApplicationStatus } from "@/types/applications";
import { STATUS_CONFIG, APPLICATION_STATUSES } from "@/types/applications";

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
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function deadlineLabel(dateStr: string) {
  const days = daysUntil(dateStr);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "text-red-500" };
  if (days === 0) return { text: "Today", color: "text-red-500" };
  if (days <= 7) return { text: `${days}d`, color: "text-red-500" };
  if (days <= 30) return { text: `${days}d`, color: "text-amber-500" };
  return { text: `${days}d`, color: "text-green-600 dark:text-green-400" };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ApplicationsClient() {
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  // Add-school search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: number; name: string; country: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications()
      .then(setApps)
      .catch(() => toast.error("Failed to load applications."))
      .finally(() => setLoading(false));
  }, []);

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
    try {
      const row = await addApplication(schoolId);
      setApps((prev) => [row, ...prev]);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      toast.success("School added to applications.");
    } catch {
      toast.error("Failed to add school.");
    }
  }

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
    try {
      await updateApplication(id, { status });
    } catch {
      toast.error("Failed to update status.");
      // revert
      const original = await fetchApplications();
      setApps(original);
    }
  }

  async function handleDeadlineChange(id: string, deadline_at: string) {
    const value = deadline_at || null;
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, deadline_at: value } : a))
    );
    try {
      await updateApplication(id, { deadline_at: value });
    } catch {
      toast.error("Failed to update deadline.");
    }
  }

  async function handleNotesChange(id: string, notes: string) {
    const value = notes || null;
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, notes: value } : a))
    );
    try {
      await updateApplication(id, { notes: value });
    } catch {
      toast.error("Failed to update notes.");
    }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null);
    const prev = apps;
    setApps((a) => a.filter((x) => x.id !== id));
    try {
      await deleteApplication(id);
      toast.success("Application removed.");
    } catch {
      setApps(prev);
      toast.error("Failed to remove application.");
    }
  }

  const filtered = useMemo(
    () => apps.filter((a) => matchesFilter(a.status, filter)),
    [apps, filter]
  );

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">My Applications</h1>
          <Badge variant="secondary" className="text-sm font-semibold">
            {apps.length}
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add School
        </Button>
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
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors border ${
              filter === f.key
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Applications list */}
      {filtered.length === 0 ? (
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
            />
          ))}
        </div>
      )}
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
}: {
  app: ApplicationRow;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDeadlineChange: (id: string, deadline: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(app.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(true);
  const notesTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNotesInput(val: string) {
    setLocalNotes(val);
    setNotesSaved(false);
    if (notesTimeout.current) clearTimeout(notesTimeout.current);
    notesTimeout.current = setTimeout(() => {
      onNotesChange(app.id, val);
      setNotesSaved(true);
    }, 800);
  }

  const schoolName = app.schools?.name ?? "Unknown School";
  const schoolCountry = app.schools?.country;
  const dl = app.deadline_at ? deadlineLabel(app.deadline_at) : null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Top row: school info + status + actions */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <Link
              href={`/schools/${app.school_id}`}
              className="text-sm font-semibold hover:underline underline-offset-2 flex items-center gap-1.5"
            >
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
            <select
              value={app.status}
              onChange={(e) =>
                onStatusChange(app.id, e.target.value as ApplicationStatus)
              }
              className={`appearance-none cursor-pointer rounded-full pl-3 pr-7 py-1 text-xs font-medium border-0 focus:ring-1 focus:ring-ring ${STATUS_CONFIG[app.status].className}`}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-50" />
          </div>

          {/* Deadline */}
          <input
            type="date"
            value={app.deadline_at ?? ""}
            onChange={(e) => onDeadlineChange(app.id, e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            title="Application deadline"
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
            <span className="text-xs text-muted-foreground">
              {notesSaved ? "Saved" : "Saving…"}
            </span>
            <div className="flex items-center gap-2">
              {localNotes.trim() && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                  onClick={() => {
                    setLocalNotes("");
                    onNotesChange(app.id, "");
                    setNotesSaved(true);
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
                onClick={() => {
                  if (notesTimeout.current) clearTimeout(notesTimeout.current);
                  onNotesChange(app.id, localNotes);
                  setNotesSaved(true);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
