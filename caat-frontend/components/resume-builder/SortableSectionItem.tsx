"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

export default function SortableSectionItem({
  id,
  label,
  active,
  onClick,

  onDoubleClick,

  onStartEdit,
  onDelete,

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

  onStartEdit: () => void;
  onDelete: () => void;

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
      className={`flex items-center gap-2 rounded-md border bg-card px-2 py-2 ${
        active ? "border-blue-500 ring-2 ring-blue-100/20" : "border-transparent hover:border-muted"
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

      {/* Label + inline actions */}
      <div className="flex flex-1 items-center gap-2">
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
            className="flex-1 rounded border bg-background text-foreground px-2 py-1 text-sm"
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

        {!isEditing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onStartEdit}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Rename section"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              aria-label="Delete section"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
