"use client";

import React from "react";
import { experienceToHtml, entryDescriptionHtml } from "@/lib/resume-guided-html";
export { experienceToHtml, entryDescriptionHtml } from "@/lib/resume-guided-html";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import RichTextEditor from "@/components/RichTextEditor";

export type ExperienceEntry = {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description?: string;       // rich-text HTML (replaces the old bullets array)
  bullets?: string[];         // legacy: read once to seed `description`
};

function emptyEntry(): ExperienceEntry {
  return {
    id: crypto.randomUUID(),
    company: "",
    title: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
  };
}


export type ExperienceValue = { entries?: ExperienceEntry[] };

export default function ExperienceGuided({
  value,
  onChange,
}: {
  value: ExperienceValue;
  onChange: (next: ExperienceValue, html: string) => void;
}) {
  // Stable placeholder id (see EducationGuided): create once so the fallback
  // row's key doesn't churn every render and remount its inputs.
  const [placeholderEntry] = React.useState(emptyEntry);
  const entries: ExperienceEntry[] = Array.isArray(value.entries) ? value.entries : [placeholderEntry];

  function update(index: number, patch: Partial<ExperienceEntry>) {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    const nextValue: ExperienceValue = { ...value, entries: next };
    onChange(nextValue, experienceToHtml(next));
  }

  function addEntry() {
    const next = [...entries, emptyEntry()];
    const nextValue: ExperienceValue = { ...value, entries: next };
    onChange(nextValue, experienceToHtml(next));
  }

  function removeEntry(index: number) {
    const next = entries.filter((_, i) => i !== index);
    const nextValue: ExperienceValue = { ...value, entries: next };
    onChange(nextValue, experienceToHtml(next));
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={entry.id} className="rounded-md border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Experience {i + 1}
            </span>
            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => removeEntry(i)}
                className="text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">COMPANY</div>
              <Input
                value={entry.company}
                onChange={(e) => update(i, { company: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">JOB TITLE</div>
              <Input
                value={entry.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Software Engineer"
              />
            </div>

            <div className="col-span-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">LOCATION</div>
              <Input
                value={entry.location}
                onChange={(e) => update(i, { location: e.target.value })}
                placeholder="Sydney, NSW"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">START DATE</div>
              <Input
                value={entry.startDate}
                onChange={(e) => update(i, { startDate: e.target.value })}
                placeholder="Jan 2023"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">END DATE</div>
              <Input
                value={entry.endDate}
                disabled={entry.current}
                onChange={(e) => update(i, { endDate: e.target.value })}
                placeholder="Dec 2024"
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <Checkbox
                  id={`current-exp-${entry.id}`}
                  checked={entry.current}
                  onCheckedChange={(v) => update(i, { current: !!v })}
                />
                <label
                  htmlFor={`current-exp-${entry.id}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Currently working here
                </label>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">DESCRIPTION</div>
            <RichTextEditor
              variant="minimal"
              content={entryDescriptionHtml(entry)}
              onChange={(html) => update(i, { description: html })}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addEntry}
        className="w-full rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
      >
        + Add experience
      </button>
    </div>
  );
}
