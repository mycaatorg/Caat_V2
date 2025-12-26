"use client";

import React, { useEffect, useState } from "react";
import { ResumeSection } from "./types";
import SortableSectionItem from "./SortableSectionItem";

export default function DocumentStructurePanel({
  sections,
  activeSectionId,
  onSelect,
  onAdd,
  onRename,
  renamingSectionId,
  onFinishRenaming,
}: {
  sections: ResumeSection[];
  activeSectionId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;

  onRename: (id: string, label: string) => void;

  // If set, that section should immediately be in rename mode
  renamingSectionId: string | null;
  onFinishRenaming: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");

  // If shell requests "rename this one now" (newly added section),
  // enter edit mode + preload current label.
  useEffect(() => {
    if (!renamingSectionId) return;

    const s = sections.find((x) => x.id === renamingSectionId);
    if (!s) return;

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
              // Only allow rename for custom sections
              if (s.type !== "custom") return;
              startEdit(s.id);
            }}
            isEditing={editingId === s.id}
            draftLabel={draft}
            onDraftChange={setDraft}
            onCommit={() => commitEdit(s.id)}
            onCancel={cancelEdit}
          />
        ))}
      </div>

      <button
        onClick={onAdd}
        className="mt-4 w-full rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
      >
        + Add Section
      </button>
    </div>
  );
}
