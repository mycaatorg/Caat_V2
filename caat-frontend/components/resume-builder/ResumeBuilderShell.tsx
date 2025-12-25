"use client";

import React, { useMemo, useState } from "react";
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

import DocumentStructurePanel from "./DocumentStructurePanel";
import SectionEditorPanel from "./SectionEditorPanel";
import ResumePreviewPanel from "./ResumePreviewPanel";

export default function ResumeBuilderShell() {
  const [sections, setSections] = useState<ResumeSection[]>(getDefaultSections());
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? "personal");

  const activeSection = useMemo(
    () => sections.find((s) => s.id === activeSectionId) ?? sections[0],
    [sections, activeSectionId]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    setSections((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  function updateSection(id: string, patch: Partial<ResumeSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function addSection() {
    const newId = `custom-${crypto.randomUUID().slice(0, 8)}`;
    const newSection: ResumeSection = {
      id: newId,
      type: "custom",
      label: "Custom Section",
      mode: "free",
      contentHtml: "",
    };
    setSections((prev) => [...prev, newSection]);
    setActiveSectionId(newId);
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-blue-600 text-white grid place-items-center text-xs font-bold">
            CA
          </div>
          <div className="font-semibold">My Professional Resume</div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-md border px-3 py-1.5 text-sm">Print / PDF</button>
          <button className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white">
            Save
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
            />
          </SortableContext>
        </DndContext>

        <SectionEditorPanel
          section={activeSection}
          onChange={(patch) => updateSection(activeSection.id, patch)}
        />

        <ResumePreviewPanel sections={sections} />
      </div>
    </div>
  );
}
