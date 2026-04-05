"use client";

import React, { useEffect, useRef, useState } from "react";
import { Target, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProfileCard } from "./ProfileCard";

interface InterestsData {
  targetMajors: string[];
  preferredCountries: string[];
}

interface InterestsGoalsCardProps {
  data: InterestsData;
  majorOptions: string[];
  onSave: (data: InterestsData) => Promise<void>;
}

// ── Shared tag display ─────────────────────────────────────────────────────────

function TagList({
  items,
  onRemove,
}: {
  items: string[];
  onRemove?: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 text-xs font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full"
        >
          {onRemove && (
            <button
              onClick={() => onRemove(i)}
              className="hover:text-destructive transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Majors combobox ────────────────────────────────────────────────────────────

function MajorCombobox({
  selected,
  options,
  onChange,
}: {
  selected: string[];
  options: string[];
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = input.length > 0
    ? options.filter(
        (o) =>
          o.toLowerCase().includes(input.toLowerCase()) &&
          !selected.includes(o)
      ).slice(0, 8)
    : [];

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || selected.includes(trimmed)) return;
    onChange([...selected, trimmed]);
    setInput("");
    setOpen(false);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Target Majors
      </p>
      <TagList
        items={selected}
        onRemove={(i) => onChange(selected.filter((_, idx) => idx !== i))}
      />
      <div ref={containerRef} className="relative">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
            }}
            onFocus={() => input.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered.length > 0) add(filtered[0]);
                else add(input);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Search or type a major…"
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => add(input)}
            className="h-8 shrink-0"
          >
            Add
          </Button>
        </div>

        {open && filtered.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-md text-sm max-h-52 overflow-y-auto">
            {filtered.map((option) => (
              <li
                key={option}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur before click fires
                  add(option);
                }}
                className="cursor-pointer px-3 py-2 hover:bg-accent transition-colors"
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Free-text tag editor (for countries) ──────────────────────────────────────

function TagEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
    setInput("");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <TagList items={items} onRemove={(i) => onChange(items.filter((_, idx) => idx !== i))} />
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Type and press Enter"
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={add} className="h-8 shrink-0">
          Add
        </Button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InterestsGoalsCard({ data, majorOptions, onSave }: InterestsGoalsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(data);

  function handleEdit() {
    setDraft(data);
    setIsEditing(true);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(draft);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setDraft(data);
    setIsEditing(false);
  }

  return (
    <ProfileCard
      title="Interests & Preferences"
      icon={<Target className="h-4 w-4" />}
      isEditing={isEditing}
      isSaving={isSaving}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <div className="flex flex-col gap-4">
        {isEditing ? (
          <>
            <MajorCombobox
              selected={draft.targetMajors}
              options={majorOptions}
              onChange={(v) => setDraft((d) => ({ ...d, targetMajors: v }))}
            />
            <TagEditor
              label="Preferred Countries"
              items={draft.preferredCountries}
              onChange={(v) => setDraft((d) => ({ ...d, preferredCountries: v }))}
            />
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Target Majors
              </p>
              {data.targetMajors.length > 0 ? (
                <TagList items={data.targetMajors} />
              ) : (
                <p className="text-sm text-muted-foreground">None added yet.</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Preferred Countries
              </p>
              {data.preferredCountries.length > 0 ? (
                <TagList items={data.preferredCountries} />
              ) : (
                <p className="text-sm text-muted-foreground">None added yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </ProfileCard>
  );
}
