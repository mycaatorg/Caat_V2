"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { NotebookPen, Lock, AlertCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveSchoolNoteAction } from "./notes-actions";

const MAX_LENGTH = 5000;
const AUTOSAVE_DEBOUNCE_MS = 1500;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

type SchoolNotesProps = {
  ownerId: string;
  schoolId: number;
  initialNotes: string;
  initialUpdatedAt: string | null;
};

export function SchoolNotesPanel(props: SchoolNotesProps) {
  return <SchoolNotesEditor key={`${props.ownerId}:${props.schoolId}`} {...props} />;
}

function SchoolNotesEditor({ ownerId, schoolId, initialNotes, initialUpdatedAt }: SchoolNotesProps) {
  const [value, setValue] = useState(initialNotes);
  const [lastSaved, setLastSaved] = useState<string | null>(initialNotes);
  const [state, setState] = useState<SaveState>(() => {
    if (initialUpdatedAt && initialNotes.length > 0) {
      return { kind: "saved", at: new Date(initialUpdatedAt) };
    }
    return { kind: "idle" };
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // These snapshots belong to input events and save settlements, never render.
  const valueRef = useRef(initialNotes);
  const lastSavedRef = useRef<string | null>(initialNotes);
  const writing = useRef(false);
  const requested = useRef(false);
  const mounted = useRef(true);

  const requestSave = useCallback(() => {
    requested.current = true;
    if (writing.current) return;
    writing.current = true;
    void (async () => {
      try {
        while (requested.current) {
          requested.current = false;
          const next = valueRef.current;
          if (next === lastSavedRef.current) continue;
          if (mounted.current) setState({ kind: "saving" });
          const failed = (message: string) => {
            // A failed response may follow a committed write. Invalidate the
            // dedupe baseline so a queued revert or manual retry reaches storage.
            lastSavedRef.current = null;
            if (mounted.current) {
              setLastSaved(null);
              setState({ kind: "error", message });
            }
            // A later distinct edit may still be queued, but a duplicate flush
            // must not automatically retry the same failed request forever.
            if (valueRef.current === next) requested.current = false;
          };
          try {
            const { updated_at, error } = await saveSchoolNoteAction(schoolId, next, ownerId);
            if (error) {
              failed(error);
              continue;
            }
            lastSavedRef.current = next;
            if (mounted.current) {
              setLastSaved(next);
              setState({ kind: "saved", at: updated_at ? new Date(updated_at) : new Date() });
            }
          } catch {
            failed("Could not save note. Please try again.");
          }
        }
      } finally {
        writing.current = false;
      }
    })();
  }, [schoolId, ownerId]);

  // Re-render once a minute so the "Saved 2 mins ago" label stays fresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function scheduleAutoSave() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      requestSave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function handleChange(next: string) {
    if (next.length > MAX_LENGTH) return;
    valueRef.current = next;
    setValue(next);
    scheduleAutoSave();
  }

  function handleManualSave() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    requestSave();
  }

  // Client navigation uses the same queue, so its final edit cannot race an
  // older in-flight request. Browser shutdown remains best-effort delivery.
  useEffect(() => {
    mounted.current = true;
    function flush() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      requestSave();
    }
    window.addEventListener("beforeunload", flush);
    return () => {
      mounted.current = false;
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [requestSave]);

  const isDirty = value !== lastSaved;
  const isSaving = state.kind === "saving";
  const remaining = MAX_LENGTH - value.length;
  const charCountWarn = remaining < 200;

  return (
    <section className="border-t border-border pt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight">My Notes</h2>
          <span className="inline-flex items-center gap-1 text-[10px] font-code uppercase tracking-[0.12em] text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            Private
          </span>
        </div>
        <SaveIndicator state={state} isDirty={isDirty} />
      </div>

      <Textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Jot down anything you want to remember about this school. Deadlines you spotted, contacts you've reached out to, essay prompts, fit notes. Only you can see this."
        className="min-h-[160px] resize-y text-sm leading-relaxed"
        maxLength={MAX_LENGTH}
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <span
          className={`text-[11px] font-code tabular-nums ${
            charCountWarn ? "text-[#9a1a27] dark:text-[#e06b78]" : "text-muted-foreground"
          }`}
        >
          {value.length} / {MAX_LENGTH}
        </span>
        <Button
          size="sm"
          onClick={handleManualSave}
          disabled={!isDirty || isSaving}
          className="gap-1.5 bg-[#9a1a27] text-white hover:bg-[#7d1520] disabled:bg-[#9a1a27]/40 disabled:text-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" aria-hidden />
              Save
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

function SaveIndicator({
  state,
  isDirty,
}: {
  state: SaveState;
  isDirty: boolean;
}) {
  if (state.kind === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (state.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[#9a1a27] dark:text-[#e06b78]">
        <AlertCircle className="h-3 w-3" aria-hidden />
        {state.message}
      </span>
    );
  }
  if (state.kind === "saved") {
    return (
      <span className="text-[11px] text-muted-foreground">
        {isDirty
          ? "Unsaved changes"
          : `Last saved ${formatDistanceToNow(state.at, { addSuffix: true })}`}
      </span>
    );
  }
  return null;
}
