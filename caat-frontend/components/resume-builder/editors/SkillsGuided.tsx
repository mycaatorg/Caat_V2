"use client";

import React from "react";
import { Input } from "@/components/ui/input";

export type SkillCategory = {
  id: string;
  name: string;
  skills: string;
};

function emptyCategory(): SkillCategory {
  return {
    id: crypto.randomUUID(),
    name: "",
    skills: "",
  };
}

export function skillsToHtml(categories: SkillCategory[]): string {
  return categories
    .filter((c) => c.skills.trim())
    .map((c) => {
      if (c.name.trim()) {
        return `<p><strong>${c.name}:</strong> ${c.skills}</p>`;
      }
      return `<p>${c.skills}</p>`;
    })
    .join("");
}

export type SkillsValue = { categories?: SkillCategory[] };

export default function SkillsGuided({
  value,
  onChange,
}: {
  value: SkillsValue;
  onChange: (next: SkillsValue, html: string) => void;
}) {
  const categories: SkillCategory[] = Array.isArray(value.categories) ? value.categories : [emptyCategory()];

  function update(index: number, patch: Partial<SkillCategory>) {
    const next = categories.map((c, i) => (i === index ? { ...c, ...patch } : c));
    const nextValue: SkillsValue = { ...value, categories: next };
    onChange(nextValue, skillsToHtml(next));
  }

  function addCategory() {
    const next = [...categories, emptyCategory()];
    const nextValue: SkillsValue = { ...value, categories: next };
    onChange(nextValue, skillsToHtml(next));
  }

  function removeCategory(index: number) {
    const next = categories.filter((_, i) => i !== index);
    const nextValue: SkillsValue = { ...value, categories: next };
    onChange(nextValue, skillsToHtml(next));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card p-4 space-y-3">
        <div className="grid grid-cols-[160px_1fr_auto] gap-2 text-xs font-medium text-muted-foreground mb-1">
          <span>CATEGORY (optional)</span>
          <span>SKILLS</span>
          <span />
        </div>

        {categories.map((cat, i) => (
          <div key={cat.id} className="grid grid-cols-[160px_1fr_auto] gap-2 items-center">
            <Input
              value={cat.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder="e.g. Languages"
            />
            <Input
              value={cat.skills}
              onChange={(e) => update(i, { skills: e.target.value })}
              placeholder="Python, JavaScript, Go..."
            />
            {categories.length > 1 ? (
              <button
                type="button"
                onClick={() => removeCategory(i)}
                className="text-muted-foreground hover:text-destructive text-sm px-1"
                aria-label="Remove row"
              >
                ×
              </button>
            ) : (
              <span className="w-5" />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCategory}
        className="w-full rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
      >
        + Add row
      </button>
    </div>
  );
}
