"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DeadlineCalendarDownload } from "@/components/today/deadline-calendar-download";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  X,
  BookOpen,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, differenceInCalendarDays } from "date-fns";
import { scholarshipDateKey, scholarshipDeadlineGroup, selectPersonalScholarships, type ScholarshipFilter, type ScholarshipSort } from "@/lib/personal-scholarship-workspace";
import { todayKey, parseLocalDate } from "@/lib/local-date";
import {
  fetchUserScholarships,
  addUserScholarship,
  updateUserScholarship,
  deleteUserScholarship,
  type UserScholarship,
  type UserScholarshipInput,
} from "./user-scholarships-api";
import { safeHref } from "@/lib/safe-href";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STUDY_LEVELS = ["undergraduate", "postgraduate"] as const;
const FUNDING_TYPES = ["merit", "need", "full_ride", "tuition"] as const;
const FUNDING_LABELS: Record<string, string> = {
  merit: "Merit-Based",
  need: "Need-Based",
  full_ride: "Full Ride",
  tuition: "Tuition Remission",
};
const FREQUENCY_OPTIONS = [
  { value: "", label: "Select" },
  { value: "one_time", label: "One-time" },
  { value: "yearly", label: "Yearly" },
  { value: "semester", label: "Per Semester" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------
const EMPTY_FORM: UserScholarshipInput = {
  title: "",
  provider_name: "",
  description: "",
  amount_display: "",
  amount_value: null,
  amount_currency: "USD",
  awards_count: null,
  frequency: null,
  study_level: [],
  funding_type: [],
  eligible_countries: [],
  country: "",
  deadline_at: null,
  external_url: "",
  notes: "",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function deadlineLabel(deadline_at: string | null): string | null {
  if (!scholarshipDateKey(deadline_at)) return null;
  const days = differenceInCalendarDays(parseLocalDate(scholarshipDateKey(deadline_at)!), new Date());
  if (days < 0) return "Deadline passed";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

function deadlineColor(deadline_at: string | null): string {
  if (!scholarshipDateKey(deadline_at)) return "";
  const days = differenceInCalendarDays(parseLocalDate(scholarshipDateKey(deadline_at)!), new Date());
  if (days < 0) return "text-muted-foreground line-through";
  if (days <= 7) return "font-bold text-foreground";
  if (days <= 30) return "text-foreground";
  return "text-muted-foreground";
}

function toggleArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

// ---------------------------------------------------------------------------
// Scholarship form dialog (add + edit)
// ---------------------------------------------------------------------------
interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: UserScholarship | null;
  onSaved: (scholarship: UserScholarship) => void;
}

function ScholarshipFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: FormDialogProps) {
  const isEdit = !!initial;
  const [form, setForm] = useState<UserScholarshipInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ title?: string; provider_name?: string }>({});

  // Populate form when editing
  useEffect(() => {
    if (open) {
       
      setErrors({});
      setSaveError(null);
      if (initial) {
        setForm({
          title: initial.title,
          provider_name: initial.provider_name,
          description: initial.description ?? "",
          amount_display: initial.amount_display ?? "",
          amount_value: initial.amount_value,
          amount_currency: initial.amount_currency ?? "USD",
          awards_count: initial.awards_count,
          frequency: initial.frequency ?? null,
          study_level: initial.study_level ?? [],
          funding_type: initial.funding_type ?? [],
          eligible_countries: initial.eligible_countries ?? [],
          country: initial.country ?? "",
          deadline_at: initial.deadline_at
            ? initial.deadline_at.slice(0, 10)
            : null,
          external_url: initial.external_url ?? "",
          notes: initial.notes ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, initial]);

  function set<K extends keyof UserScholarshipInput>(
    key: K,
    value: UserScholarshipInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = "Scholarship name is required.";
    if (!form.provider_name.trim())
      errs.provider_name = "University / provider is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (savingRef.current || !validate()) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);

    // Clean up empty strings → null
    const payload: UserScholarshipInput = {
      ...form,
      description: form.description?.trim() || null,
      amount_display: form.amount_display?.trim() || null,
      external_url: form.external_url?.trim() || null,
      country: form.country?.trim() || null,
      notes: form.notes?.trim() || null,
      frequency: form.frequency || null,
      deadline_at: form.deadline_at || null,
    };

    try {
      const saved = isEdit
        ? await updateUserScholarship(initial!.id, payload)
        : await addUserScholarship(payload);
      onSaved(saved);
      onOpenChange(false);
      toast.success(isEdit ? "Scholarship updated." : "Scholarship added.");
    } catch {
      setSaveError("Could not save your scholarship. Your changes are still here. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!savingRef.current) onOpenChange(next); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        {/* Centering wrapper: offset by sidebar width (16rem) on md+ so the dialog is centred in the content area, not the full viewport */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:pl-[16rem] pointer-events-none">
        <Dialog.Content className="pointer-events-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background border border-foreground/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <Dialog.Title className="sr-only">
            {isEdit ? "Edit Scholarship" : "Add Scholarship"}
          </Dialog.Title>
          <Dialog.Description className="sr-only">Save details and a deadline for a scholarship you found.</Dialog.Description>

          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {isEdit ? "Edit Scholarship" : "Add Scholarship"}
              </h2>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" type="button" aria-label="Close scholarship form" disabled={saving}>
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>

            {/* Body */}
            <fieldset disabled={saving} className="px-6 py-5 space-y-5 min-w-0">
              {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
              {/* Required section */}
              <div className="space-y-4">
                <p className="text-[11px] font-code tracking-[0.15em] uppercase text-muted-foreground">
                  Required
                </p>

                <div className="space-y-1.5">
                  <Label htmlFor="s-title">
                    Scholarship Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="s-title"
                    placeholder="e.g. Melbourne International Scholarship"
                    value={form.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                  {errors.title && (
                    <p className="text-xs text-destructive">{errors.title}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="s-provider">
                    University / Provider{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="s-provider"
                    placeholder="e.g. University of Melbourne"
                    value={form.provider_name}
                    onChange={(e) => set("provider_name", e.target.value)}
                  />
                  {errors.provider_name && (
                    <p className="text-xs text-destructive">
                      {errors.provider_name}
                    </p>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Optional section */}
              <div className="space-y-4">
                <p className="text-[11px] font-code tracking-[0.15em] uppercase text-muted-foreground">
                  Optional — fill in what you know
                </p>

                {/* Amount + deadline in a grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-amount">Amount</Label>
                    <Input
                      id="s-amount"
                      placeholder='e.g. $10,000 / year'
                      value={form.amount_display ?? ""}
                      onChange={(e) => set("amount_display", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="s-deadline">Application Deadline</Label>
                    <Input
                      id="s-deadline"
                      type="date"
                      value={form.deadline_at ?? ""}
                      onChange={(e) =>
                        set("deadline_at", e.target.value || null)
                      }
                    />
                  </div>
                </div>

                {/* Website + country */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-url">Application / Website URL</Label>
                    <Input
                      id="s-url"
                      type="url"
                      placeholder="https://..."
                      value={form.external_url ?? ""}
                      onChange={(e) => set("external_url", e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="s-country">Country</Label>
                    <Input
                      id="s-country"
                      placeholder="e.g. Australia"
                      value={form.country ?? ""}
                      onChange={(e) => set("country", e.target.value)}
                    />
                  </div>
                </div>

                {/* Frequency + awards count */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="s-frequency">Frequency</Label>
                    <Select
                      disabled={saving}
                      value={form.frequency || undefined}
                      onValueChange={(v) => set("frequency", v || null)}
                    >
                      <SelectTrigger id="s-frequency" className="h-9 w-full">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.filter((o) => o.value).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="s-awards">Number of Awards</Label>
                    <Input
                      id="s-awards"
                      type="number"
                      min={1}
                      placeholder="e.g. 50"
                      value={form.awards_count ?? ""}
                      onChange={(e) =>
                        set(
                          "awards_count",
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    />
                  </div>
                </div>

                {/* Study level */}
                <div className="space-y-2">
                  <Label>Study Level</Label>
                  <div className="flex flex-wrap gap-3">
                    {STUDY_LEVELS.map((level) => (
                      <label
                        key={level}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(form.study_level ?? []).includes(level)}
                          onChange={() =>
                            set(
                              "study_level",
                              toggleArray(form.study_level ?? [], level),
                            )
                          }
                          className="rounded border-input"
                        />
                        <span className="capitalize">{level}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Funding type */}
                <div className="space-y-2">
                  <Label>Funding Type</Label>
                  <div className="flex flex-wrap gap-3">
                    {FUNDING_TYPES.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(form.funding_type ?? []).includes(type)}
                          onChange={() =>
                            set(
                              "funding_type",
                              toggleArray(form.funding_type ?? [], type),
                            )
                          }
                          className="rounded border-input"
                        />
                        <span>{FUNDING_LABELS[type]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Eligible countries */}
                <div className="space-y-1.5">
                  <Label htmlFor="s-countries">
                    Eligible Countries{" "}
                    <span className="text-muted-foreground font-normal">
                      (comma-separated)
                    </span>
                  </Label>
                  <Input
                    id="s-countries"
                    placeholder="e.g. Australia, New Zealand, UK"
                    value={(form.eligible_countries ?? []).join(", ")}
                    onChange={(e) =>
                      set(
                        "eligible_countries",
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="s-description">Description</Label>
                  <Textarea
                    id="s-description"
                    placeholder="Overview of the scholarship, eligibility criteria, etc."
                    rows={3}
                    value={form.description ?? ""}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </div>

                {/* Personal notes */}
                <div className="space-y-1.5">
                  <Label htmlFor="s-notes">Personal Notes</Label>
                  <Textarea
                    id="s-notes"
                    placeholder="Reminders, requirements you still need to check, etc."
                    rows={2}
                    value={form.notes ?? ""}
                    onChange={(e) => set("notes", e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
              <Dialog.Close asChild>
                <Button variant="outline" type="button" disabled={saving}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={saving} className="bg-[#9a1a27] hover:bg-[#7d1520] text-white">
                {saving
                  ? "Saving…"
                  : isEdit
                    ? "Save Changes"
                    : "Add Scholarship"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Individual user scholarship card
// ---------------------------------------------------------------------------
function UserScholarshipCard({
  scholarship,
  onEdit,
  onDelete,
}: {
  scholarship: UserScholarship;
  onEdit: (s: UserScholarship) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deadline = scholarshipDateKey(scholarship.deadline_at);
  const daysLabel = deadlineLabel(scholarship.deadline_at);
  const daysColor = deadlineColor(scholarship.deadline_at);

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(scholarship.id);
    } catch {
      // Surface the failure instead of silently leaving the scholarship in place.
      toast.error("Failed to remove scholarship. Please try again.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const hasTags =
    scholarship.study_level.length > 0 || scholarship.funding_type.length > 0;

  return (
    <Card className="flex min-w-0 flex-col h-full break-words transition-colors duration-100 hover:border-foreground">
      <CardHeader className="pb-3 gap-2">
        {/* Provider + actions */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-code tracking-[0.12em] uppercase text-muted-foreground leading-tight min-w-0 [overflow-wrap:anywhere]">
            {scholarship.provider_name}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onEdit(scholarship)}
              aria-label="Edit scholarship"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  className="h-7 px-2 text-xs font-medium text-destructive hover:bg-muted transition-colors"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? "…" : "Delete"}
                </button>
                <button
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <Button
                size="icon-sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete scholarship"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-[15px] leading-snug [overflow-wrap:anywhere]">
          {scholarship.title}
        </h3>

        {/* Badges */}
        {hasTags && (
          <div className="flex flex-wrap gap-1.5">
            {scholarship.funding_type.map((t) => (
              <span
                key={t}
                className="text-[10px] font-code tracking-[0.08em] uppercase border border-foreground/70 px-2 py-0.5"
              >
                {FUNDING_LABELS[t] ?? t}
              </span>
            ))}
            {scholarship.study_level.map((l) => (
              <span
                key={l}
                className="text-[10px] font-code tracking-[0.08em] uppercase border border-border text-muted-foreground px-2 py-0.5"
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-grow pb-3 space-y-2">
        {/* Amount */}
        {scholarship.amount_display && (
          <p className="text-2xl font-bold leading-tight">
            {scholarship.amount_display}
          </p>
        )}

        {/* Deadline */}
        {scholarship.deadline_at && (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              {deadline ? format(parseLocalDate(deadline), "MMM d, yyyy") : "Check deadline"}
            </span>
            {daysLabel && (
              <span className={`font-medium text-xs ${daysColor}`}>
                · {daysLabel}
              </span>
            )}
          </div>
        )}

        {/* Description or notes */}
        {(scholarship.description || scholarship.notes) && (
          <p className="text-sm text-muted-foreground line-clamp-3 mt-1">
            {scholarship.description ?? scholarship.notes}
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-0 gap-2">
        {safeHref(scholarship.external_url) ? (
          <Button
            asChild
            className="w-full bg-[#9a1a27] hover:bg-[#7d1520] text-white font-code tracking-[0.1em] uppercase text-[11px] transition-colors duration-100"
          >
            <a
              href={safeHref(scholarship.external_url)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Visit Site
            </a>
          </Button>
        ) : (
          <Button
            className="w-full bg-transparent text-[#9a1a27] dark:text-[#e06b78] border border-[#9a1a27] dark:border-[#e06b78] hover:bg-[#9a1a27] hover:text-white font-code tracking-[0.1em] uppercase text-[11px] transition-colors duration-100"
            onClick={() => onEdit(scholarship)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit Details
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------
export default function MyScholarshipsPanel() {
  const [scholarships, setScholarships] = useState<UserScholarship[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ScholarshipFilter>("all");
  const [sort, setSort] = useState<ScholarshipSort>("deadline");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserScholarship | null>(null);

  useEffect(() => {
    let active = true;
    fetchUserScholarships()
      .then(rows => { if (active) setScholarships(rows); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  const today = todayKey();
  const visible = selectPersonalScholarships(scholarships, query, filter, sort, today);
  const groups: { value: ScholarshipFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: scholarships.length },
    ...(['upcoming', 'past', 'undated'] as const).map(value => ({
      value, label: { upcoming: 'Upcoming', past: 'Past deadlines', undated: 'No deadline' }[value],
      count: scholarships.filter(row => scholarshipDeadlineGroup(row, today) === value).length,
    })),
  ];
  function resetFilters() { setQuery(''); setFilter('all'); setSort('deadline'); }

  const handleSaved = useCallback((saved: UserScholarship) => {
    setScholarships((prev) => {
      const exists = prev.find((s) => s.id === saved.id);
      if (exists) return prev.map((s) => (s.id === saved.id ? saved : s));
      return [saved, ...prev];
    });
    setEditing(null);
  }, []);

  const handleEdit = useCallback((s: UserScholarship) => {
    setEditing(s);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await deleteUserScholarship(id);
    setScholarships((prev) => prev.filter((s) => s.id !== id));
    toast.success("Scholarship removed.");
  }, []);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Panel header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <h2 className="text-xl font-bold">My Scholarships</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track scholarships you&apos;ve found outside this platform.
          </p>
        </div>
        <Button
          onClick={openAdd}
          disabled={loading || loadError}
          className="gap-2 bg-[#9a1a27] hover:bg-[#7d1520] text-white font-code tracking-[0.1em] uppercase text-[11px] transition-colors duration-100"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Add Scholarship
        </Button>
      </div>

      <nav aria-label="Scholarship planning" className="flex flex-wrap gap-4 text-sm underline underline-offset-4">
        <Link href="/today">Today</Link>
      </nav>
      <DeadlineCalendarDownload />
      {!loading && !loadError && scholarships.length > 0 && (
        <section aria-label="Your scholarship deadlines" className="space-y-4">
          <p className="text-sm text-muted-foreground">Your own collection. Dates and award details are entered by you; check the provider before applying.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {groups.map(group => <Button key={group.value} variant={filter === group.value ? 'default' : 'outline'} aria-pressed={filter === group.value} aria-label={group.label} onClick={() => setFilter(group.value)} className="h-auto min-h-16 flex flex-col gap-1">
              <span className="text-xl font-bold">{group.count}</span><span>{group.label}</span>
            </Button>)}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input aria-label="Search my scholarships" placeholder="Search name, provider or country" value={query} onChange={e => setQuery(e.target.value)} className="flex-1 min-w-0" />
            <select aria-label="Sort my scholarships" value={sort} onChange={e => setSort(e.target.value as ScholarshipSort)} className="h-9 border border-input bg-background px-3 text-sm">
              <option value="deadline">Deadline first</option><option value="newest">Newest added</option><option value="name">Name A–Z</option>
            </select>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
            <p role="status" aria-label="Scholarship results">Showing {visible.length} of {scholarships.length} scholarships</p>
            <Button variant="ghost" onClick={resetFilters}>Reset filters</Button>
          </div>
        </section>
      )}
      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-40 w-full" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div role="alert" className="border p-6 space-y-3">
          <p>Could not load your scholarships.</p>
          <p className="text-sm text-muted-foreground">Try again to see your complete collection.</p>
          <Button onClick={() => { setLoading(true); setLoadError(false); setReload(value => value + 1); }}>Try again</Button>
        </div>
      ) : scholarships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-6 border border-border">
          <BookOpen className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          <div>
            <p className="text-base font-bold">
              No scholarships added yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Found a scholarship elsewhere? Add it here to keep track.
            </p>
          </div>
          <Button
            onClick={openAdd}
            className="gap-2 bg-transparent text-[#9a1a27] dark:text-[#e06b78] border border-[#9a1a27] dark:border-[#e06b78] hover:bg-[#9a1a27] hover:text-white font-code tracking-[0.1em] uppercase text-[11px] transition-colors duration-100"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Add your first scholarship
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="border p-8 text-center"><p>No scholarships match your search and filters.</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visible.map((s) => (
            <UserScholarshipCard
              key={s.id}
              scholarship={s}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <ScholarshipFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        initial={editing}
        onSaved={handleSaved}
      />
    </div>
  );
}
