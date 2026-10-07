"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";

import { getDefaultSections } from "./defaultSections";
import { ResumeSection, SectionType } from "./types";
import {
  type ResumeSettings,
  type MarginPreset,
  DEFAULT_SETTINGS,
  MARGIN_LABELS,
  marginPxOf,
} from "./settings";

// Supabase API helpers
import {
  loadOrCreateResumeState,
  saveResumeState,
  listResumes,
  loadResumeById,
  createResume,
  deleteResume,
  deleteSection as deleteSectionFromDb,
} from "./api";

import { Pencil, Trash2, Printer } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import DocumentStructurePanel from "./DocumentStructurePanel";
import SectionEditorPanel from "./SectionEditorPanel";
import ResumePreviewPanel, { ResumePage } from "./ResumePreviewPanel";
import type { PageModel, PersonalHeader } from "./ResumePreviewPanel";

type ResumeSavePayload = Parameters<typeof saveResumeState>[0];

function makeSavePayload(
  resumeId: string,
  title: string,
  settings: ResumeSettings,
  sections: ResumeSection[],
): ResumeSavePayload {
  return {
    resumeId,
    title,
    template: null,
    settings,
    sections: sections.map((section, sortOrder) => ({
      id: section.id,
      type: section.type,
      label: section.label,
      mode: section.mode,
      contentHtml: section.contentHtml,
      structuredData: section.structuredData,
      sortOrder,
    })),
  };
}

export default function ResumeBuilderShell() {
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [settings, setSettings] = useState<ResumeSettings>(DEFAULT_SETTINGS);

  // Resume metadata (needed for save/load)
  const [resumeId, setResumeId] = useState<string>("");
  const [resumeTitle, setResumeTitle] = useState<string>("My Professional Resume");
  const [resumeList, setResumeList] = useState<{ id: string; title: string | null }[]>([]);

  // Basic UX state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // Initial-load failure. We must NOT silently fall back to a blank editor with
  // an empty resumeId, because then onSave / autosave both early-return forever
  // and the user's work is lost on refresh. Instead surface an error + retry.
  const [loadError, setLoadError] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Which section should be immediately renamed (newly added)
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);

  // Computed page layout from the preview panel — used by the print container
  const [printPages, setPrintPages] = useState<PageModel[]>([]);
  const [printPersonal, setPrintPersonal] = useState<PersonalHeader>({
    isFree: false,
    html: "",
    data: {},
  });

  // Resume title edit (inline, same as section rename)
  const [editingResumeTitle, setEditingResumeTitle] = useState(false);
  const [draftResumeTitle, setDraftResumeTitle] = useState("");
  const [deleteResumeDialogOpen, setDeleteResumeDialogOpen] = useState(false);

  // Mobile tab navigation
  type MobileTab = "structure" | "editor" | "preview";
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");

  // Resizable left panel
  const [leftWidth, setLeftWidth] = useState(360);
  const LEFT_MIN = 180;
  const LEFT_MAX = 360;
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - dragStartX.current;
      setLeftWidth(Math.min(LEFT_MAX, Math.max(LEFT_MIN, dragStartWidth.current + delta)));
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  const activeSection = useMemo(() => {
    if (sections.length === 0) return undefined;
    return sections.find((s) => s.id === activeSectionId) ?? sections[0];
  }, [sections, activeSectionId]);

  // M11 — keyboard DnD as well as pointer: Tab to a section handle, Space to
  // pick up, arrow keys to reorder, Space to drop.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Mirror the live editor state into refs so the pre-switch / unmount flush can
  // persist the OUTGOING resume without depending on stale closures.
  const sectionsRef = useRef(sections);
  const settingsRef = useRef(settings);
  const resumeIdRef = useRef(resumeId);
  const resumeTitleRef = useRef(resumeTitle);
  const isLoadingRef = useRef(isLoading);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const queuedSaveCountRef = useRef(0);
  const lastSavedFingerprintRef = useRef<string | null>(null);
  const transitionLockRef = useRef(false);
  sectionsRef.current = sections;
  settingsRef.current = settings;
  resumeIdRef.current = resumeId;
  resumeTitleRef.current = resumeTitle;
  isLoadingRef.current = isLoading;

  const currentSavePayload = useCallback((): Parameters<typeof saveResumeState>[0] | null => {
    const currentResumeId = resumeIdRef.current;
    if (!currentResumeId) return null;

    return makeSavePayload(currentResumeId, resumeTitleRef.current, settingsRef.current, sectionsRef.current);
  }, []);

  const enqueueSave = useCallback((payload: Parameters<typeof saveResumeState>[0]): Promise<void> => {
    queuedSaveCountRef.current += 1;
    setIsSaving(true);
    const save = saveQueueRef.current.catch(() => {}).then(async () => {
      await saveResumeState(payload);
      lastSavedFingerprintRef.current = JSON.stringify(payload);
      setLastSavedAt(new Date());
    }).finally(() => {
      queuedSaveCountRef.current -= 1;
      setIsSaving(queuedSaveCountRef.current > 0);
    });
    saveQueueRef.current = save;
    return save;
  }, []);

  // --------------------------------------------------
  // Initial load from Supabase
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setIsLoading(true);
        setLoadError(false);

        const state = await loadOrCreateResumeState();
        if (cancelled) return;

        setResumeId(state.resumeId);
        setResumeTitle(state.title || "My Professional Resume");
        setSettings(state.settings ?? DEFAULT_SETTINGS);
        const loadedTitle = state.title || "My Professional Resume";
        const loadedSettings = state.settings ?? DEFAULT_SETTINGS;
        resumeIdRef.current = state.resumeId;
        resumeTitleRef.current = loadedTitle;
        settingsRef.current = loadedSettings;

        // Load resume list for switcher
        const list = await listResumes();
        if (cancelled) return;
        setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));

        // If user has no sections yet, seed defaults once and save them
        if (!state.sections || state.sections.length === 0) {
          const defaults = getDefaultSections();

          sectionsRef.current = defaults;
          setSections(defaults);
          setActiveSectionId(defaults[0]?.id ?? "");

          // Save seeded defaults so next refresh loads from db
          const seedPayload = currentSavePayload();
          if (seedPayload) await enqueueSave(seedPayload);

          const list = await listResumes();
          if (cancelled) return;
          setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));
          return;
        }

        // Otherwise load from DB
        const loadedSections: ResumeSection[] = state.sections
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            id: s.id,
            type: s.type,
            label: s.label,
            mode: s.mode,
            contentHtml: s.contentHtml,
            structuredData: s.structuredData,
          }));

        sectionsRef.current = loadedSections;
        lastSavedFingerprintRef.current = JSON.stringify(
          makeSavePayload(state.resumeId, loadedTitle, loadedSettings, loadedSections),
        );
        setSections(loadedSections);
        setActiveSectionId(loadedSections[0]?.id ?? "");
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error(err);
        if (cancelled) return;
        // Do NOT drop the user into a blank editor with resumeId="" — every
        // save would silently no-op. Surface the failure and offer a retry.
        toast.error("Could not load your resume. Please retry.");
        setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
     
  }, [reloadNonce, currentSavePayload, enqueueSave]);

  // --------------------------------------------------
  // Drag & drop ordering
  // --------------------------------------------------
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    setSections((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  // --------------------------------------------------
  // Update a section (editor changes)
  // --------------------------------------------------
  function updateSection(id: string, patch: Partial<ResumeSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  // --------------------------------------------------
  // Add section
  // --------------------------------------------------
  function addSection(type: SectionType = "custom") {
    const newId = crypto.randomUUID();

    // Preset guided sections get the same defaults as the initial seed
    const PRESET_DEFAULTS: Partial<Record<SectionType, Partial<ResumeSection>>> = {
      education: { label: "Education", mode: "guided", structuredData: {} },
      experience: { label: "Experience", mode: "guided", structuredData: {} },
      skills: { label: "Skills & Interests", mode: "guided", structuredData: {} },
    };

    const preset = PRESET_DEFAULTS[type];
    const newSection: ResumeSection = {
      id: newId,
      type,
      label: preset?.label ?? "Custom Section",
      mode: preset?.mode ?? "free",
      contentHtml: "",
      structuredData: preset?.structuredData,
    };

    setSections((prev) => [...prev, newSection]);
    setActiveSectionId(newId);

    // Only enter rename mode for custom sections (presets have a fixed label)
    if (type === "custom") {
      setRenamingSectionId(newId);
    }
  }

  // --------------------------------------------------
  // Delete section
  // --------------------------------------------------
  function deleteSection(id: string) {
    // M1 — confirm before removing a section (destructive, loses its content).
    const target = sections.find((s) => s.id === id);
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete the "${target?.label ?? "section"}" section? This cannot be undone.`)
    ) {
      return;
    }
    const removedIndex = sections.findIndex((s) => s.id === id);
    const owningResumeId = resumeIdRef.current;
    setSections((prev) => {
      const next = prev.filter((s) => s.id !== id);

      if (next.length === 0) {
        setActiveSectionId("");
        return next;
      }

      if (activeSectionId === id) {
        setActiveSectionId(next[0].id);
      }

      return next;
    });

    // Queue the server delete behind any save already queued or in flight.
    // Those saves upsert every section they captured, so one that landed after
    // the delete would bring the removed section back on the next load.
    queuedSaveCountRef.current += 1;
    setIsSaving(true);
    const removal = saveQueueRef.current.catch(() => {}).then(() => deleteSectionFromDb(id)).finally(() => {
      queuedSaveCountRef.current -= 1;
      setIsSaving(queuedSaveCountRef.current > 0);
    });
    saveQueueRef.current = removal;
    removal.catch((err) => {
      if (process.env.NODE_ENV !== "production") console.error("Failed to delete section from database:", err);
      // The row still exists and would return on the next load, so put the
      // section back where it was instead of showing it as deleted.
      if (target && resumeIdRef.current === owningResumeId) {
        setSections((prev) => {
          if (prev.some((s) => s.id === id)) return prev;
          const next = [...prev];
          next.splice(Math.min(Math.max(removedIndex, 0), next.length), 0, target);
          return next;
        });
      }
      toast.error("Could not delete the section. It has been restored.");
    });
  }

  // --------------------------------------------------
  // Save (universal save button)
  // --------------------------------------------------
  async function onSave() {
    let payload = currentSavePayload();
    if (!payload) return;

    try {
      if (queuedSaveCountRef.current > 0) {
        try {
          await saveQueueRef.current;
        } catch {
          // A failed earlier attempt must not poison the retry queue.
        }
        payload = currentSavePayload();
        if (!payload) return;
      }
      if (JSON.stringify(payload) === lastSavedFingerprintRef.current) return;
      await enqueueSave(payload);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error("Failed to save resume. Please try again.");
    }
  }

  // -------------------------------------------------------------------------
  // Autosave — fires 2 s after any sections change, guarded by isLoading so
  // programmatic section sets (initial load, resume switch, new resume) never
  // trigger a spurious write
  // -------------------------------------------------------------------------
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // isLoading is true during all programmatic section changes
    if (isLoading || !resumeId) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      onSave();
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, settings]);

  // M1 — warn on hard close/refresh while a save is still pending in the 2s
  // autosave window (complements the flush-on-unmount for SPA navigation).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const payload = currentSavePayload();
      const hasUnsavedChanges = payload != null &&
        JSON.stringify(payload) !== lastSavedFingerprintRef.current;
      if (autosaveTimerRef.current || isSaving || hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [currentSavePayload, isSaving]);

  // Persist the currently-loaded resume's pending edits before its content is
  // replaced (switch / new / unmount), reading from refs so it never saves a
  // stale snapshot. Clears the debounce so it can't fire against the new resume.
  const flushCurrentResume = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!resumeIdRef.current || isLoadingRef.current) return;
    const outgoingResumeId = resumeIdRef.current;

    while (true) {
      if (queuedSaveCountRef.current > 0) {
        try {
          await saveQueueRef.current;
        } catch {
          // Re-evaluate the latest editor snapshot and retry it if still dirty.
        }
        continue;
      }

      const payload = currentSavePayload();
      if (!payload || payload.resumeId !== outgoingResumeId) return;
      const savedVersion = JSON.stringify(payload);
      if (savedVersion === lastSavedFingerprintRef.current) return;
      await enqueueSave(payload);

      // The editor stays usable while a save is pending. If it changed during
      // that write, persist the newer snapshot before replacing the editor.
      const latest = currentSavePayload();
      if (!latest || latest.resumeId !== outgoingResumeId) return;
      if (JSON.stringify(latest) === savedVersion) return;
    }
  }, [currentSavePayload, enqueueSave]);

  // Flush pending edits on unmount (client-side nav) and tab close.
  useEffect(() => {
    const onBeforeUnload = () => { void flushCurrentResume().catch(() => {}); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flushCurrentResume().catch(() => {});
    };
     
  }, [flushCurrentResume]);

  // --------------------------------------------------
  // Switch resume (load by id)
  // --------------------------------------------------
  async function switchResume(id: string) {
    if (id === resumeIdRef.current || transitionLockRef.current) return;
    transitionLockRef.current = true;
    try {
      // Flush the outgoing resume before its sections are replaced.
      await flushCurrentResume();
      setIsLoading(true);
      const state = await loadResumeById(id);
      if (!state) return;

      const nextTitle = state.title || "Untitled";
      const nextSettings = state.settings ?? DEFAULT_SETTINGS;
      const loadedSections: ResumeSection[] = state.sections
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => ({
          id: s.id,
          type: s.type,
          label: s.label,
          mode: s.mode,
          contentHtml: s.contentHtml,
          structuredData: s.structuredData,
        }));
      const nextSections = loadedSections.length > 0 ? loadedSections : getDefaultSections();

      resumeIdRef.current = state.resumeId;
      resumeTitleRef.current = nextTitle;
      settingsRef.current = nextSettings;
      sectionsRef.current = nextSections;
      lastSavedFingerprintRef.current = loadedSections.length > 0
        ? JSON.stringify(makeSavePayload(state.resumeId, nextTitle, nextSettings, nextSections))
        : null;
      setResumeId(state.resumeId);
      setResumeTitle(nextTitle);
      setSettings(nextSettings);
      setSections(nextSections);
      setActiveSectionId(nextSections[0]?.id ?? "");

      if (loadedSections.length === 0) {
        const seedPayload = makeSavePayload(state.resumeId, nextTitle, nextSettings, nextSections);
        await enqueueSave(seedPayload);
      }

      const list = await listResumes();
      setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error("Could not switch resume. Please try again.");
    } finally {
      setIsLoading(false);
      transitionLockRef.current = false;
    }
  }

  // --------------------------------------------------
  // New resume
  // --------------------------------------------------
  async function onNewResume() {
    if (transitionLockRef.current) return;
    transitionLockRef.current = true;
    try {
      // Flush the outgoing resume before we swap in the fresh one.
      await flushCurrentResume();
      setIsLoading(true);
      const state = await createResume();
      const defaults = getDefaultSections();
      const nextTitle = state.title || "New Resume";
      resumeIdRef.current = state.resumeId;
      resumeTitleRef.current = nextTitle;
      settingsRef.current = state.settings ?? DEFAULT_SETTINGS;
      sectionsRef.current = defaults;
      lastSavedFingerprintRef.current = null;

      setResumeId(state.resumeId);
      setResumeTitle(nextTitle);
      setSettings(state.settings ?? DEFAULT_SETTINGS);
      setSections(defaults);
      setActiveSectionId(defaults[0]?.id ?? "");

      await enqueueSave(makeSavePayload(state.resumeId, nextTitle, state.settings ?? DEFAULT_SETTINGS, defaults));

      const list = await listResumes();
      setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error("Could not create a new resume. Please try again.");
    } finally {
      setIsLoading(false);
      transitionLockRef.current = false;
    }
  }

  // --------------------------------------------------
  // Resume title edit (same behavior as section rename)
  // --------------------------------------------------
  function startEditResumeTitle() {
    setDraftResumeTitle(resumeTitle);
    setEditingResumeTitle(true);
  }

  function cancelEditResumeTitle() {
    setEditingResumeTitle(false);
    setDraftResumeTitle("");
  }

  async function commitEditResumeTitle() {
    const next = draftResumeTitle.trim();
    if (next.length > 0 && next !== resumeTitle && resumeId) {
      resumeTitleRef.current = next;
      setResumeTitle(next);
      const payload = makeSavePayload(resumeId, next, settings, sections);
      await enqueueSave(payload);
      const list = await listResumes();
      setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));
    }
    setEditingResumeTitle(false);
    setDraftResumeTitle("");
  }

  // --------------------------------------------------
  // Delete resume (with confirmation)
  // --------------------------------------------------
  async function confirmDeleteResume() {
    if (!resumeIdRef.current || transitionLockRef.current) return;
    const toDeleteId = resumeIdRef.current;
    const rest = resumeList.filter((r) => r.id !== toDeleteId);
    let fingerprintToRestore = lastSavedFingerprintRef.current;
    let replacementIdToCleanup: string | null = null;

    transitionLockRef.current = true;
    const outgoingFlush = flushCurrentResume();
    setIsLoading(true);

    try {
      // Keep the current resume alive until its latest edits and the next
      // editor state are ready. A later switch/new call would flush the
      // deleted id and can fail when sections are upserted against its FK.
      await outgoingFlush;
      fingerprintToRestore = lastSavedFingerprintRef.current;

      let replacement: Awaited<ReturnType<typeof loadResumeById>>;
      let createdReplacement = false;
      if (rest.length > 0) {
        replacement = await loadResumeById(rest[0].id);
        if (!replacement) throw new Error("Could not load the replacement resume");
      } else {
        replacement = await createResume();
        createdReplacement = true;
        replacementIdToCleanup = replacement.resumeId;
      }

      const nextTitle = replacement.title || "Untitled";
      const loadedSections: ResumeSection[] = replacement.sections
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((section) => ({
          id: section.id,
          type: section.type,
          label: section.label,
          mode: section.mode,
          contentHtml: section.contentHtml,
          structuredData: section.structuredData,
        }));
      const nextSections = loadedSections.length > 0 ? loadedSections : getDefaultSections();
      const nextSettings = replacement.settings ?? DEFAULT_SETTINGS;
      const nextPayload = makeSavePayload(replacement.resumeId, nextTitle, nextSettings, nextSections);

      // Seed a fresh/empty replacement before deleting the current one so a
      // failed initialization leaves the user's existing resume intact.
      if (createdReplacement || loadedSections.length === 0) {
        await enqueueSave(nextPayload);
      }

      await deleteResume(toDeleteId);
      setDeleteResumeDialogOpen(false);
      resumeIdRef.current = replacement.resumeId;
      resumeTitleRef.current = nextTitle;
      settingsRef.current = nextSettings;
      sectionsRef.current = nextSections;
      lastSavedFingerprintRef.current = JSON.stringify(nextPayload);
      setResumeId(replacement.resumeId);
      setResumeTitle(nextTitle);
      setSettings(nextSettings);
      setSections(nextSections);
      setActiveSectionId(nextSections[0]?.id ?? "");
      setResumeList(
        rest.length > 0
          ? rest
          : [{ id: replacement.resumeId, title: nextTitle }],
      );
      replacementIdToCleanup = null;
    } catch (err) {
      lastSavedFingerprintRef.current = fingerprintToRestore;
      if (replacementIdToCleanup) {
        try {
          await deleteResume(replacementIdToCleanup);
        } catch (cleanupErr) {
          if (process.env.NODE_ENV !== "production") console.error(cleanupErr);
        }
      }
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error("Could not delete resume. Please try again.");
    } finally {
      setIsLoading(false);
      transitionLockRef.current = false;
    }
  }

  // --------------------------------------------------
  // Print / PDF
  // --------------------------------------------------
  async function handlePrint() {
    // Save latest state before printing so the PDF reflects persisted content
    await onSave();

    const previousTitle = document.title;
    document.title = resumeTitle;

    window.print();

    // Restore after print dialog closes (onafterprint fires when dialog is dismissed)
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    // Fallback timeout in case afterprint doesn't fire
    setTimeout(restore, 5000);
  }

  if (loadError) {
    return (
      <div className="flex h-[calc(100vh-64px)] w-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="max-w-md space-y-2">
          <h2 className="text-lg font-semibold">We could not load your resume</h2>
          <p className="text-sm text-muted-foreground">
            Something went wrong reaching your saved resume. To avoid overwriting
            your work, we did not open a blank editor. Please retry.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadNonce((n) => n + 1)}
          disabled={isLoading}
          className="rounded-md bg-[#9a1a27] px-4 py-2 text-sm font-medium text-white hover:bg-[#7d141f] disabled:opacity-50"
        >
          {isLoading ? "Retrying…" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full">
      {/* Top bar — wraps instead of running off-screen on small viewports (D8) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          {editingResumeTitle ? (
            <input
              value={draftResumeTitle}
              onChange={(e) => setDraftResumeTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEditResumeTitle();
                if (e.key === "Escape") cancelEditResumeTitle();
              }}
              onBlur={() => commitEditResumeTitle()}
              autoFocus
              className="rounded border px-2 py-1 text-sm font-semibold w-40"
            />
          ) : (
            <>
              <Select
                value={resumeId || undefined}
                onValueChange={(v) => switchResume(v)}
                disabled={isLoading}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Switch resume"
                  className="font-semibold border-none shadow-none bg-transparent gap-1.5 px-1 text-sm min-w-[140px] focus-visible:ring-0"
                >
                  <SelectValue placeholder="Select a resume" />
                </SelectTrigger>
                <SelectContent>
                  {resumeList.length === 0 && resumeId ? (
                    <SelectItem value={resumeId}>{resumeTitle}</SelectItem>
                  ) : (
                    resumeList.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={startEditResumeTitle}
                disabled={isLoading}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Rename resume"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteResumeDialogOpen(true)}
                disabled={isLoading}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                aria-label="Delete resume"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onNewResume}
            disabled={isLoading}
            className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            + New resume
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isSaving ? (
            <span className="text-xs text-muted-foreground">Saving…</span>
          ) : lastSavedAt ? (
            <span className="text-xs text-muted-foreground">
              Last saved on: {format(lastSavedAt, "MMM d, yyyy 'at' h:mm a")}
            </span>
          ) : null}

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Margins</span>
            <Select
              value={settings.marginPreset}
              onValueChange={(v) => setSettings((s) => ({ ...s, marginPreset: v as MarginPreset }))}
            >
              <SelectTrigger size="sm" className="h-8 w-auto gap-1.5 text-sm" aria-label="Page margins">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="narrow">{MARGIN_LABELS.narrow}</SelectItem>
                <SelectItem value="normal">{MARGIN_LABELS.normal}</SelectItem>
                <SelectItem value="wide">{MARGIN_LABELS.wide}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={handlePrint}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>

          <button
            onClick={onSave}
            disabled={isLoading || isSaving}
            className="rounded-md bg-[#9a1a27] hover:bg-[#7d1520] px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Mobile/tablet tab bar — the 3-panel split needs ~880px of fixed width
          (360 + 520), so single-panel tabs run up to lg (D8). */}
      <div className="flex border-b lg:hidden">
        {(["structure", "editor", "preview"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2 text-sm capitalize font-medium ${
              mobileTab === tab
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "structure" ? "Sections" : tab === "editor" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      {/* 3-panel body */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Desktop: flex row with draggable divider */}
        <div className="hidden lg:flex flex-1 min-h-0 overflow-hidden">
          <div
            className="flex flex-col overflow-hidden shrink-0"
            style={{ width: leftWidth }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <DocumentStructurePanel
                  sections={sections}
                  activeSectionId={activeSectionId}
                  onSelect={(id) => setActiveSectionId(id)}
                  onAdd={(type) => addSection(type)}
                  onRename={(id, label) => updateSection(id, { label })}
                  onDelete={deleteSection}
                  renamingSectionId={renamingSectionId}
                  onFinishRenaming={() => setRenamingSectionId(null)}
                />
              </SortableContext>
            </DndContext>
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onDividerMouseDown}
            className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors select-none"
          />

          <div className="flex flex-col flex-1 min-w-0 overflow-auto" aria-busy={isLoading} inert={isLoading}>
            <SectionEditorPanel
              section={activeSection}
              onChange={(patch) => {
                if (isLoading || !activeSection) return;
                updateSection(activeSection.id, patch);
              }}
            />
          </div>

          <div className="flex flex-col min-h-0 overflow-hidden border-l shrink-0" style={{ width: 520 }}>
            <ResumePreviewPanel
              sections={sections}
              marginPx={marginPxOf(settings)}
              onPagesComputed={(pages, personal) => {
                setPrintPages(pages);
                setPrintPersonal(personal);
              }}
            />
          </div>
        </div>

        {/* Mobile/tablet: single-panel with tab switching */}
        <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
          {mobileTab === "structure" && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <DocumentStructurePanel
                  sections={sections}
                  activeSectionId={activeSectionId}
                  onSelect={(id) => {
                    setActiveSectionId(id);
                    setMobileTab("editor");
                  }}
                  onAdd={(type) => addSection(type)}
                  onRename={(id, label) => updateSection(id, { label })}
                  onDelete={deleteSection}
                  renamingSectionId={renamingSectionId}
                  onFinishRenaming={() => setRenamingSectionId(null)}
                />
              </SortableContext>
            </DndContext>
          )}
          {mobileTab === "editor" && (
            <div aria-busy={isLoading} inert={isLoading}>
              <SectionEditorPanel
                section={activeSection}
                onChange={(patch) => {
                  if (isLoading || !activeSection) return;
                  updateSection(activeSection.id, patch);
                }}
              />
            </div>
          )}
          {mobileTab === "preview" && (
            <ResumePreviewPanel
              sections={sections}
              marginPx={marginPxOf(settings)}
              onPagesComputed={(pages, personal) => {
                setPrintPages(pages);
                setPrintPersonal(personal);
              }}
            />
          )}
        </div>
      </div>

      {/* Print container — portalled to document.body so @media print CSS
          can hide the app root and show only this. Uses the identical
          ResumePage component as the preview so output matches exactly. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div data-print-resume aria-hidden="true">
            {printPages.map((page) => (
              <div key={page.pageIndex} className="resume-print-page">
                <ResumePage
                  page={page}
                  totalPages={printPages.length}
                  personalHeader={printPersonal}
                  marginPx={marginPxOf(settings)}
                  showFooter={false}
                />
              </div>
            ))}
          </div>,
          document.body
        )}

      <Dialog.Root open={deleteResumeDialogOpen} onOpenChange={setDeleteResumeDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <Dialog.Title className="text-sm font-semibold">Delete resume</Dialog.Title>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you wish to delete this resume? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteResumeDialogOpen(false)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteResume}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
