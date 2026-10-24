"use client";

import { useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { requirementsChecklist, type ChecklistItem } from "@/lib/requirements-checklist";
import {
  SCHOLARSHIP_STATUS_LABELS,
  attachScholarship,
  detachScholarship,
  mentionsSchool,
  setPrepCheck,
  type SavedScholarshipForHub,
} from "@/lib/scholarship-tracking";
import { ScholarshipRequirementsCard } from "@/components/applications/scholarship-requirements-card";
import { AttachScholarshipDialog, attachCopy } from "@/components/applications/attach-scholarship-dialog";

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-code text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70 mb-2.5">
      {children}
    </div>
  );
}

/**
 * PROD-77 (minimal), groups 1 and 2 of the hub's scholarships card:
 * 1. "Attached to this application": a requirements checklist per attached
 *    scholarship, with persisted preparation ticks and Detach.
 * 2. "Saved scholarships that mention <school>": a name-match suggestion
 *    only, each with Attach. Nothing is attached automatically.
 * Writes are not optimistic for attach/detach (pending, then local update);
 * ticks are optimistic per key and roll back only that key on failure. None of
 * this touches the application's status or its 3-step preparation score.
 */
export function HubScholarshipAttachments({
  schoolId,
  schoolName,
  saved,
  savedUnavailable,
  prepChecks,
  prepUnavailable,
  onSavedChange,
  onRetry,
  retrying,
  now,
}: {
  schoolId: number;
  schoolName: string;
  saved: SavedScholarshipForHub[];
  savedUnavailable: boolean;
  prepChecks: Record<string, string[]>;
  prepUnavailable: boolean;
  onSavedChange: (next: SavedScholarshipForHub[]) => void;
  onRetry: () => void;
  retrying: boolean;
  now: Date;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ticks, setTicks] = useState<Record<string, string[]>>(prepChecks);
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const inFlight = useRef(new Set<string>());
  const [seededFrom, setSeededFrom] = useState(prepChecks);
  if (seededFrom !== prepChecks) {
    // A card-level retry delivered fresh ticks: start from them.
    setSeededFrom(prepChecks);
    setTicks(prepChecks);
  }

  const attached = saved.filter((s) => s.schoolId === schoolId);
  const suggested = saved.filter((s) => s.schoolId !== schoolId && mentionsSchool(s.scholarshipSchoolName, schoolName));

  const write = async (s: SavedScholarshipForHub, to: number | null) => {
    if (busyId) return;
    setBusyId(s.id);
    try {
      // Pass the attachment this tab saw, so a change made elsewhere is refused.
      if (to === null) await detachScholarship(s.id, s.schoolId ?? schoolId);
      else await attachScholarship(s.id, to, s.schoolId);
      onSavedChange(
        saved.map((row) => (row.id === s.id ? { ...row, schoolId: to, attachedSchoolName: to === null ? null : schoolName } : row)),
      );
      if (to !== null) setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : to === null ? "Couldn't detach this scholarship. Try again." : "Couldn't attach. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (scholarshipId: string, item: ChecklistItem, checked: boolean) => {
    const id = `${scholarshipId}:${item.key}`;
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    const apply = (on: boolean) =>
      setTicks((cur) => {
        const keys = new Set(cur[scholarshipId] ?? []);
        if (on) keys.add(item.key);
        else keys.delete(item.key);
        return { ...cur, [scholarshipId]: [...keys] };
      });
    apply(checked);
    setPending((cur) => new Set(cur).add(id));
    try {
      await setPrepCheck(scholarshipId, item.key, checked);
    } catch {
      apply(!checked);
      toast.error("Couldn't save that tick. Try again.");
    } finally {
      inFlight.current.delete(id);
      setPending((cur) => {
        const next = new Set(cur);
        next.delete(id);
        return next;
      });
    }
  };

  if (savedUnavailable) {
    return (
      <div className="mb-5">
        <div role="status" className="rounded-lg border border-dashed bg-muted/20 px-6 py-6 text-center text-sm text-muted-foreground">
          <p>Couldn&apos;t load your saved scholarships.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-none"
            disabled={retrying}
            aria-label="Retry loading saved scholarships"
            onClick={onRetry}
          >
            {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Retry
          </Button>
        </div>
        <Button variant="outline" size="sm" className="mt-3 rounded-none w-full" disabled>
          <Plus className="h-4 w-4" aria-hidden="true" /> Attach a saved scholarship
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-5">
      <section role="region" aria-label="Attached to this application" data-scholarship-group>
        <GroupHeading>Attached to this application</GroupHeading>
        {attached.length > 0 ? <p className="text-xs text-muted-foreground mb-3">{attachCopy(schoolName)}</p> : null}
        {prepUnavailable && attached.length > 0 ? (
          <p role="status" className="text-xs text-muted-foreground mb-2">
            <span>Couldn&apos;t load your ticks. Retry to tick items.</span>{" "}
            <button type="button" className="underline" disabled={retrying} onClick={onRetry}>Retry</button>
          </p>
        ) : null}
        {attached.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-4 text-center text-sm text-muted-foreground">
            You haven&apos;t attached a scholarship to this application.
          </p>
        ) : (
          <ul className="space-y-3">
            {attached.map((s) => {
              const pendingKeys = new Set([...pending].filter((p) => p.startsWith(`${s.id}:`)).map((p) => p.slice(s.id.length + 1)));
              return (
                <ScholarshipRequirementsCard
                  key={s.id}
                  scholarship={s}
                  checklist={requirementsChecklist(s.checklist, now)}
                  schoolName={schoolName}
                  ticked={new Set(ticks[s.id] ?? [])}
                  pendingKeys={pendingKeys}
                  ticksAvailable={!prepUnavailable}
                  onToggle={(item, checked) => void toggle(s.id, item, checked)}
                  detaching={busyId === s.id}
                  onDetach={() => void write(s, null)}
                />
              );
            })}
          </ul>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-3 rounded-none w-full"
          disabled={busyId !== null}
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Attach a saved scholarship
        </Button>
      </section>

      {suggested.length > 0 ? (
        <section role="region" aria-label={`Saved scholarships that mention ${schoolName}`} data-scholarship-group>
          <GroupHeading>Saved scholarships that mention {schoolName}</GroupHeading>
          <ul className="space-y-2.5">
            {suggested.map((s) => (
              <li key={s.id} className="rounded-lg border bg-muted/20 px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm break-words">{s.title}</div>
                  <div className="text-xs text-muted-foreground break-words">
                    {s.amount ?? s.provider}
                    {s.schoolId !== null ? ` · Attached to ${s.attachedSchoolName ?? "another application"}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {SCHOLARSHIP_STATUS_LABELS[s.status]}
                </span>
                {s.schoolId === null ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none shrink-0"
                    disabled={busyId !== null}
                    aria-label={`Attach ${s.title}`}
                    onClick={() => void write(s, schoolId)}
                  >
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Attach
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <AttachScholarshipDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        schoolId={schoolId}
        schoolName={schoolName}
        saved={saved}
        busyId={busyId}
        onAttach={(s) => void write(s, schoolId)}
      />
    </div>
  );
}
