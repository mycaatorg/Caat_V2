"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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

export function SchoolNotesPanel({
  schoolId,
  initialNotes,
  initialUpdatedAt,
}: {
  schoolId: number;
  initialNotes: string;
  initialUpdatedAt: string | null;
}) {
  const [value, setValue] = useState(initialNotes);
  const [lastSaved, setLastSaved] = useState(initialNotes);
  const [state, setState] = useState<SaveState>(() => {
    if (initialUpdatedAt && initialNotes.length > 0) {
      return { kind: "saved", at: new Date(initialUpdatedAt) };
    }
    return { kind: "idle" };
  });
  const [, startTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-render once a minute so the "Saved 2 mins ago" label stays fresh.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  function runSave(next: string) {
    if (next === lastSaved) return;
    setState({ kind: "saving" });
    startTransition(async () => {
      const { updated_at, error } = await saveSchoolNoteAction(schoolId, next);
      if (error) {
        setState({ kind: "error", message: error });
        return;
      }
      setLastSaved(next);
      setState({
        kind: "saved",
        at: updated_at ? new Date(updated_at) : new Date(),
      });
    });
  }

  function scheduleAutoSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSave(next);
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function handleChange(next: string) {
    if (next.length > MAX_LENGTH) return;
    setValue(next);
    scheduleAutoSave(next);
  }

  function handleManualSave() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    runSave(value);
  }

  // Flush any pending debounced save when the user navigates away so the
  // last few keystrokes aren't lost.
  useEffect(() => {
    function flushOnUnload() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (value !== lastSaved) {
        void saveSchoolNoteAction(schoolId, value);
      }
    }
    window.addEventListener("beforeunload", flushOnUnload);
    return () => {
      window.removeEventListener("beforeunload", flushOnUnload);
      flushOnUnload();
    };
  }, [value, lastSaved, schoolId]);

  const isDirty = value !== lastSaved;
  const isSaving = state.kind === "saving";
  const remaining = MAX_LENGTH - value.length;
  const charCountWarn = remaining < 200;

  return (
    <section className="border-t border-[#E5E5E5] pt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-[#525252]" aria-hidden />
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
            charCountWarn ? "text-[#9a1a27]" : "text-muted-foreground"
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
      <span className="inline-flex items-center gap-1 text-[11px] text-[#9a1a27]">
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
