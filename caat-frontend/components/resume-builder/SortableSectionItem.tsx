"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export default function SortableSectionItem({
  id,
  label,
  active,
  onClick,

  onDoubleClick,

  isEditing,
  draftLabel,
  onDraftChange,
  onCommit,
  onCancel,
}: {
  id: string;
  label: string;
  active: boolean;
  onClick: () => void;

  onDoubleClick: () => void;

  isEditing: boolean;
  draftLabel: string;
  onDraftChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border bg-white px-2 py-2 ${
        active ? "border-blue-500 ring-2 ring-blue-100" : "border-transparent hover:border-muted"
      }`}
    >
      {/* Drag handle stuck to left */}
      <button
        type="button"
        className="cursor-grab rounded p-1 hover:bg-muted"
        {...(!isEditing ? attributes : {})}
        {...(!isEditing ? listeners : {})}
        aria-label="Drag section"
        disabled={isEditing}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Click selects section */}
      {isEditing ? (
        <input
          value={draftLabel}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommit();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={() => onCommit()}
          autoFocus
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          className="flex-1 text-left text-sm font-medium"
        >
          {label}
        </button>
      )}
    </div>
  );
}
