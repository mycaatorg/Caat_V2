"use client";

import React, { useEffect, useRef, useState } from "react";
import { ResumeSection, SectionType } from "./types";
import SortableSectionItem from "./SortableSectionItem";

// Preset sections users can re-add after deleting them
const PRESET_OPTIONS: { type: SectionType; label: string }[] = [
  { type: "education", label: "Education" },
  { type: "experience", label: "Experience" },
  { type: "skills", label: "Skills & Interests" },
];

export default function DocumentStructurePanel({
  sections,
  activeSectionId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  renamingSectionId,
  onFinishRenaming,
}: {
  sections: ResumeSection[];
  activeSectionId: string;
  onSelect: (id: string) => void;
  onAdd: (type: SectionType) => void;

  onRename: (id: string, label: string) => void;
  onDelete: (id: string) => void;

  // If set, that section should immediately be in rename mode
  renamingSectionId: string | null;
  onFinishRenaming: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [pickerOpen]);

  // If shell requests "rename this one now" (newly added section),
  // enter edit mode + preload current label.
  useEffect(() => {
    if (!renamingSectionId) return;

    const s = sections.find((x) => x.id === renamingSectionId);
    if (!s) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingId(s.id);
    setDraft(s.label);
    onFinishRenaming();
  }, [renamingSectionId, sections, onFinishRenaming]);

  function startEdit(id: string) {
    const s = sections.find((x) => x.id === id);
    if (!s) return;

    setEditingId(id);
    setDraft(s.label);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  function commitEdit(id: string) {
    const next = draft.trim();
    if (next.length > 0) {
      onRename(id, next);
    }
    setEditingId(null);
    setDraft("");
  }

  // Presets not yet present in the document
  const existingTypes = new Set(sections.map((s) => s.type));
  const availablePresets = PRESET_OPTIONS.filter((p) => !existingTypes.has(p.type));

  function handlePickOption(type: SectionType) {
    setPickerOpen(false);
    onAdd(type);
  }

  return (
    <div className="border-r bg-background p-4">
      <div className="mb-3 text-xs font-medium text-muted-foreground">
        DOCUMENT STRUCTURE
      </div>

      <div className="space-y-2">
        {sections.map((s) => (
          <SortableSectionItem
            key={s.id}
            id={s.id}
            label={s.label}
            active={s.id === activeSectionId}
            onClick={() => onSelect(s.id)}
            onDoubleClick={() => {
              startEdit(s.id);
            }}
            onStartEdit={() => startEdit(s.id)}
            onDelete={() => onDelete(s.id)}
            isEditing={editingId === s.id}
            draftLabel={draft}
            onDraftChange={setDraft}
            onCommit={() => commitEdit(s.id)}
            onCancel={cancelEdit}
          />
        ))}
      </div>

      {/* Add Section button + picker */}
      <div className="relative mt-4" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="w-full rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          + Add Section
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border bg-popover shadow-md z-10 py-1">
            {/* Preset sections (only if not already in doc) */}
            {availablePresets.map((p) => (
              <button
                key={p.type}
                type="button"
                onClick={() => handlePickOption(p.type)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
              >
                <span className="text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 font-medium">
                  Guided
                </span>
                {p.label}
              </button>
            ))}
            {/* Divider only if there are presets above */}
            {availablePresets.length > 0 && (
              <div className="my-1 border-t" />
            )}
            {/* Custom section — always available */}
            <button
              type="button"
              onClick={() => handlePickOption("custom")}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
            >
              <span className="text-xs rounded bg-muted text-muted-foreground px-1.5 py-0.5 font-medium border">
                Custom
              </span>
              Custom Section
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
