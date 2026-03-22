"use client";

import React, { useState } from "react";
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
  onSave: (data: InterestsData) => Promise<void>;
}

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

export function InterestsGoalsCard({ data, onSave }: InterestsGoalsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(data);

  function handleEdit() {
    setDraft(data);
    setIsEditing(true);
  }

  async function handleSave() {
    await onSave(draft);
    setIsEditing(false);
  }

  function handleCancel() {
    setDraft(data);
    setIsEditing(false);
  }

  return (
    <ProfileCard
      title="Interests & Goals"
      icon={<Target className="h-4 w-4" />}
      isEditing={isEditing}
      onEdit={handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
    >
      <div className="flex flex-col gap-4">
        {isEditing ? (
          <>
            <TagEditor
              label="Target Majors"
              items={draft.targetMajors}
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
