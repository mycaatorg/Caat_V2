"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import { getDefaultSections } from "./defaultSections";
import { ResumeSection } from "./types";

// Supabase API helpers
import { loadOrCreateResumeState, saveResumeState } from "./api";

import DocumentStructurePanel from "./DocumentStructurePanel";
import SectionEditorPanel from "./SectionEditorPanel";
import ResumePreviewPanel from "./ResumePreviewPanel";

export default function ResumeBuilderShell() {
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>("");

  // Resume metadata (needed for save/load)
  const [resumeId, setResumeId] = useState<string>("");
  const [resumeTitle, setResumeTitle] = useState<string>("My Professional Resume");

  // Basic UX state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Which section should be immediately renamed (newly added)
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);

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

        // If anything fails, fall back to local defaults so UI still works
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
  function onDragEnd(event: any) {
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
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-blue-600 text-white grid place-items-center text-xs font-bold">
            CA
          </div>
          <div className="font-semibold">{resumeTitle}</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-md border px-3 py-1.5 text-sm">Print / PDF</button>

          <button
            onClick={onSave}
            disabled={isLoading || isSaving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* 3-panel body */}
      <div className="grid h-full grid-cols-[360px_1fr_520px]">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <DocumentStructurePanel
              sections={sections}
              activeSectionId={activeSectionId}
              onSelect={setActiveSectionId}
              onAdd={addSection}
              onRename={(id, label) => updateSection(id, { label })}
              onDelete={deleteSection}
              renamingSectionId={renamingSectionId}
              onFinishRenaming={() => setRenamingSectionId(null)}
            />
          </SortableContext>
        </DndContext>

        <SectionEditorPanel
          section={activeSection}
          onChange={(patch) => {
            if (!activeSection) return;
            updateSection(activeSection.id, patch);
          }}
        />

        <ResumePreviewPanel sections={sections} />
      </div>
    </div>
  );
}
