"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

export type EducationEntry = {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  current: boolean;
  gpa: string;
  description: string;
};

function emptyEntry(): EducationEntry {
  return {
    id: crypto.randomUUID(),
    institution: "",
    degree: "",
    field: "",
    startDate: "",
    endDate: "",
    current: false,
    gpa: "",
    description: "",
  };
}

export function educationToHtml(entries: EducationEntry[]): string {
  return entries
    .filter((e) => e.institution || e.degree)
    .map((e) => {
      const titleLine = [e.degree, e.field].filter(Boolean).join(" in ");
      const datePart = e.current
        ? `${e.startDate} – Present`
        : [e.startDate, e.endDate].filter(Boolean).join(" – ");
      const metaParts = [datePart, e.gpa ? `GPA: ${e.gpa}` : ""].filter(Boolean).join(" · ");
      const lines: string[] = [];
      if (e.institution)
        lines.push(`<p><strong>${e.institution}</strong>${titleLine ? ` — ${titleLine}` : ""}</p>`);
      if (metaParts) lines.push(`<p>${metaParts}</p>`);
      if (e.description) {
        const bullets = e.description
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (bullets.length > 0) {
          lines.push(`<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
        }
      }
      return lines.join("");
    })
    .join("<p>&nbsp;</p>");
}

export type EducationValue = { entries?: EducationEntry[] };

export default function EducationGuided({
  value,
  onChange,
}: {
  value: EducationValue;
  onChange: (next: EducationValue, html: string) => void;
}) {
  const entries: EducationEntry[] = Array.isArray(value.entries) ? value.entries : [emptyEntry()];

  function update(index: number, patch: Partial<EducationEntry>) {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
    const nextValue: EducationValue = { ...value, entries: next };
    onChange(nextValue, educationToHtml(next));
  }

  function addEntry() {
    const next = [...entries, emptyEntry()];
    const nextValue: EducationValue = { ...value, entries: next };
    onChange(nextValue, educationToHtml(next));
  }

  function removeEntry(index: number) {
    const next = entries.filter((_, i) => i !== index);
    const nextValue: EducationValue = { ...value, entries: next };
    onChange(nextValue, educationToHtml(next));
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={entry.id} className="rounded-md border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Education {i + 1}
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
            <div className="col-span-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">INSTITUTION</div>
              <Input
                value={entry.institution}
                onChange={(e) => update(i, { institution: e.target.value })}
                placeholder="University of Sydney"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">DEGREE</div>
              <Input
                value={entry.degree}
                onChange={(e) => update(i, { degree: e.target.value })}
                placeholder="Bachelor of Science"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">FIELD OF STUDY</div>
              <Input
                value={entry.field}
                onChange={(e) => update(i, { field: e.target.value })}
                placeholder="Computer Science"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">START DATE</div>
              <Input
                value={entry.startDate}
                onChange={(e) => update(i, { startDate: e.target.value })}
                placeholder="Mar 2021"
              />
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">END DATE</div>
              <Input
                value={entry.endDate}
                disabled={entry.current}
                onChange={(e) => update(i, { endDate: e.target.value })}
                placeholder="Nov 2024"
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <Checkbox
                  id={`current-edu-${entry.id}`}
                  checked={entry.current}
                  onCheckedChange={(v) => update(i, { current: !!v })}
                />
                <label
                  htmlFor={`current-edu-${entry.id}`}
                  className="text-xs text-muted-foreground cursor-pointer"
                >
                  Currently attending
                </label>
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">GPA (optional)</div>
              <Input
                value={entry.gpa}
                onChange={(e) => update(i, { gpa: e.target.value })}
                placeholder="3.8"
              />
            </div>

            <div className="col-span-2">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                NOTES / ACHIEVEMENTS (one per line)
              </div>
              <Textarea
                value={entry.description}
                onChange={(e) => update(i, { description: e.target.value })}
                placeholder="Dean's List&#10;Thesis: Machine Learning in Healthcare"
                rows={3}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addEntry}
        className="w-full rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
      >
        + Add education
      </button>
    </div>
  );
}
