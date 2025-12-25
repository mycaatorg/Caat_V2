"use client";

import React from "react";
import { ResumeSection } from "./types";
import SortableSectionItem from "./SortableSectionItem";

export default function DocumentStructurePanel({
  sections,
  activeSectionId,
  onSelect,
  onAdd,
}: {
  sections: ResumeSection[];
  activeSectionId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
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
