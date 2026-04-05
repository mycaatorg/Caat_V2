"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { getDefaultSections } from "./defaultSections";
import { ResumeSection } from "./types";

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
import { toast } from "sonner";

import DocumentStructurePanel from "./DocumentStructurePanel";
import SectionEditorPanel from "./SectionEditorPanel";
import ResumePreviewPanel, { ResumePage } from "./ResumePreviewPanel";
import type { PageModel } from "./ResumePreviewPanel";

export default function ResumeBuilderShell() {
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>("");

  // Resume metadata (needed for save/load)
  const [resumeId, setResumeId] = useState<string>("");
  const [resumeTitle, setResumeTitle] = useState<string>("My Professional Resume");
  const [resumeList, setResumeList] = useState<{ id: string; title: string | null }[]>([]);

  // Basic UX state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Which section should be immediately renamed (newly added)
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);

  // Computed page layout from the preview panel — used by the print container
  const [printPages, setPrintPages] = useState<PageModel[]>([]);
  const [printPersonal, setPrintPersonal] = useState<Record<string, unknown>>({});

  // Resume title edit (inline, same as section rename)
  const [editingResumeTitle, setEditingResumeTitle] = useState(false);
  const [draftResumeTitle, setDraftResumeTitle] = useState("");
  const [deleteResumeDialogOpen, setDeleteResumeDialogOpen] = useState(false);

  // Mobile tab navigation
  type MobileTab = "structure" | "editor" | "preview";
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");

  const activeSection = useMemo(() => {
    if (sections.length === 0) return undefined;
    return sections.find((s) => s.id === activeSectionId) ?? sections[0];
  }, [sections, activeSectionId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // --------------------------------------------------
  // Initial load from Supabase
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setIsLoading(true);

        const state = await loadOrCreateResumeState();
        if (cancelled) return;

        setResumeId(state.resumeId);
        setResumeTitle(state.title || "My Professional Resume");

        // Load resume list for switcher
        const list = await listResumes();
        if (!cancelled) setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));

        // If user has no sections yet, seed defaults once and save them
        if (!state.sections || state.sections.length === 0) {
          const defaults = getDefaultSections();

          setSections(defaults);
          setActiveSectionId(defaults[0]?.id ?? "");

          // Save seeded defaults so next refresh loads from db
          await saveResumeState({
            resumeId: state.resumeId,
            title: state.title || "My Professional Resume",
            template: state.template ?? null,
            sections: defaults.map((s, idx) => ({
              id: s.id,
              type: s.type,
              label: s.label,
              mode: s.mode,
              contentHtml: s.contentHtml,
              structuredData: s.structuredData,
              sortOrder: idx,
            })),
          });

          const list = await listResumes();
          if (!cancelled) setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));
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

        setSections(loadedSections);
        setActiveSectionId(loadedSections[0]?.id ?? "");
      } catch (err) {
        console.error(err);
        toast.error("Could not load your resume. Working offline with default sections.");

        // Fall back to local defaults so the UI still works
        const defaults = getDefaultSections();
        if (cancelled) return;

        setSections(defaults);
        setActiveSectionId(defaults[0]?.id ?? "");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

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
  function addSection() {
    const newId = crypto.randomUUID(); // real UUID for Supabase
    const newSection: ResumeSection = {
      id: newId,
      type: "custom",
      label: "Custom Section",
      mode: "free",
      contentHtml: "",
    };

    setSections((prev) => [...prev, newSection]);
    setActiveSectionId(newId);

    // Immediately enter rename mode for the newly added section
    setRenamingSectionId(newId);
  }

  // --------------------------------------------------
  // Delete section
  // --------------------------------------------------
  function deleteSection(id: string) {
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

    deleteSectionFromDb(id).catch((err) => {
      console.error("Failed to delete section from database:", err);
      toast.error("Section removed locally but could not be deleted from the server.");
    });
  }

  // --------------------------------------------------
  // Save (universal save button)
  // --------------------------------------------------
  async function onSave() {
    if (!resumeId) return;

    try {
      setIsSaving(true);

      await saveResumeState({
        resumeId,
        title: resumeTitle,
        template: null,
        sections: sections.map((s, idx) => ({
          id: s.id,
          type: s.type,
          label: s.label,
          mode: s.mode,
          contentHtml: s.contentHtml,
          structuredData: s.structuredData,
          sortOrder: idx,
        })),
      });

      setLastSavedAt(new Date());
    } catch (err) {
      console.error(err);
      toast.error("Failed to save resume. Please try again.");
    } finally {
      setIsSaving(false);
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
  }, [sections]);

  // --------------------------------------------------
  // Switch resume (load by id)
  // --------------------------------------------------
  async function switchResume(id: string) {
    if (id === resumeId) return;
    try {
      setIsLoading(true);
      const state = await loadResumeById(id);
      if (!state) return;

      setResumeId(state.resumeId);
      setResumeTitle(state.title || "Untitled");

      if (!state.sections || state.sections.length === 0) {
        const defaults = getDefaultSections();
        setSections(defaults);
        setActiveSectionId(defaults[0]?.id ?? "");
        await saveResumeState({
          resumeId: state.resumeId,
          title: state.title || "Untitled",
          template: state.template ?? null,
          sections: defaults.map((s, idx) => ({
            id: s.id,
            type: s.type,
            label: s.label,
            mode: s.mode,
            contentHtml: s.contentHtml,
            structuredData: s.structuredData,
            sortOrder: idx,
          })),
        });
      } else {
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
        setSections(loadedSections);
        setActiveSectionId(loadedSections[0]?.id ?? "");
      }

      const list = await listResumes();
      setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));
    } catch (err) {
      console.error(err);
      toast.error("Could not switch resume. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // --------------------------------------------------
  // New resume
  // --------------------------------------------------
  async function onNewResume() {
    try {
      setIsLoading(true);
      const state = await createResume();
      const defaults = getDefaultSections();

      setResumeId(state.resumeId);
      setResumeTitle(state.title || "New Resume");
      setSections(defaults);
      setActiveSectionId(defaults[0]?.id ?? "");

      await saveResumeState({
        resumeId: state.resumeId,
        title: state.title || "New Resume",
        template: null,
        sections: defaults.map((s, idx) => ({
          id: s.id,
          type: s.type,
          label: s.label,
          mode: s.mode,
          contentHtml: s.contentHtml,
          structuredData: s.structuredData,
          sortOrder: idx,
        })),
      });

      const list = await listResumes();
      setResumeList(list.map((r) => ({ id: r.id, title: r.title ?? "Untitled" })));
    } catch (err) {
      console.error(err);
      toast.error("Could not create a new resume. Please try again.");
    } finally {
      setIsLoading(false);
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
      setResumeTitle(next);
      await saveResumeState({
        resumeId,
        title: next,
        template: null,
        sections: sections.map((s, idx) => ({
          id: s.id,
          type: s.type,
          label: s.label,
          mode: s.mode,
          contentHtml: s.contentHtml,
          structuredData: s.structuredData,
          sortOrder: idx,
        })),
      });
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
    if (!resumeId) return;
    const toDeleteId = resumeId;
    const rest = resumeList.filter((r) => r.id !== toDeleteId);

    try {
      await deleteResume(toDeleteId);
      setDeleteResumeDialogOpen(false);

      if (rest.length > 0) {
        await switchResume(rest[0].id);
      } else {
        await onNewResume();
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not delete resume. Please try again.");
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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
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
              <select
                value={resumeId}
                onChange={(e) => switchResume(e.target.value)}
                disabled={isLoading}
                className="font-semibold bg-transparent border-none cursor-pointer focus:ring-0 focus:outline-none text-sm py-0 pr-6 min-w-[140px]"
              >
                {resumeList.length === 0 && resumeId ? (
                  <option value={resumeId}>{resumeTitle}</option>
                ) : (
                  resumeList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))
                )}
              </select>
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
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Mobile tab bar */}
      <div className="flex border-b md:hidden">
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

      {/* 3-panel body — desktop grid / mobile single-panel */}
      <div className="flex-1 min-h-0 md:grid md:grid-cols-[360px_1fr_520px] flex flex-col overflow-hidden">
        <div className={`${mobileTab === "structure" ? "flex" : "hidden"} flex-col md:flex`}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <DocumentStructurePanel
                sections={sections}
                activeSectionId={activeSectionId}
                onSelect={(id) => {
                  setActiveSectionId(id);
                  setMobileTab("editor");
                }}
                onAdd={addSection}
                onRename={(id, label) => updateSection(id, { label })}
                onDelete={deleteSection}
                renamingSectionId={renamingSectionId}
                onFinishRenaming={() => setRenamingSectionId(null)}
              />
            </SortableContext>
          </DndContext>
        </div>

        <div className={`${mobileTab === "editor" ? "flex" : "hidden"} flex-col md:flex overflow-auto`}>
          <SectionEditorPanel
            section={activeSection}
            onChange={(patch) => {
              if (!activeSection) return;
              updateSection(activeSection.id, patch);
            }}
          />
        </div>

        <div className={`${mobileTab === "preview" ? "flex" : "hidden"} flex-col md:flex`}>
          <ResumePreviewPanel
            sections={sections}
            onPagesComputed={(pages, personal) => {
              setPrintPages(pages);
              setPrintPersonal(personal);
            }}
          />
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
                  personal={printPersonal}
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
