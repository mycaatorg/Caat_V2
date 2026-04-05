"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export type ExperienceEntry = {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
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
    bullets: [""],
  };
}

export function experienceToHtml(entries: ExperienceEntry[]): string {
  return entries
    .filter((e) => e.company || e.title)
    .map((e) => {
      const datePart = e.current
        ? `${e.startDate} – Present`
        : [e.startDate, e.endDate].filter(Boolean).join(" – ");
      const metaParts = [datePart, e.location].filter(Boolean).join(" · ");
      const lines: string[] = [];

      if (e.company || e.title) {
        lines.push(
          `<p><strong>${e.company}</strong>${e.title ? ` — ${e.title}` : ""}</p>`
        );
      }
      if (metaParts) lines.push(`<p>${metaParts}</p>`);

      const filledBullets = e.bullets.map((b) => b.trim()).filter(Boolean);
      if (filledBullets.length > 0) {
        lines.push(`<ul>${filledBullets.map((b) => `<li>${b}</li>`).join("")}</ul>`);
      }

      return lines.join("");
    })
    .join("<p>&nbsp;</p>");
}

export type ExperienceValue = { entries?: ExperienceEntry[] };

export default function ExperienceGuided({
  value,
  onChange,
}: {
  value: ExperienceValue;
  onChange: (next: ExperienceValue, html: string) => void;
}) {
  const entries: ExperienceEntry[] = Array.isArray(value.entries) ? value.entries : [emptyEntry()];

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

  function updateBullet(entryIndex: number, bulletIndex: number, text: string) {
    const newBullets = entries[entryIndex].bullets.map((b, bi) =>
      bi === bulletIndex ? text : b
    );
    update(entryIndex, { bullets: newBullets });
  }

  function addBullet(entryIndex: number) {
    update(entryIndex, { bullets: [...entries[entryIndex].bullets, ""] });
  }

  function removeBullet(entryIndex: number, bulletIndex: number) {
    const newBullets = entries[entryIndex].bullets.filter((_, bi) => bi !== bulletIndex);
    update(entryIndex, { bullets: newBullets.length > 0 ? newBullets : [""] });
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
            <div className="mb-1 text-xs font-medium text-muted-foreground">BULLET POINTS</div>
            <div className="space-y-1.5">
              {entry.bullets.map((bullet, bi) => (
                <div key={bi} className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm shrink-0">•</span>
                  <Input
                    value={bullet}
                    onChange={(e) => updateBullet(i, bi, e.target.value)}
                    placeholder="Describe an achievement or responsibility..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addBullet(i);
                      }
                      if (e.key === "Backspace" && bullet === "" && entry.bullets.length > 1) {
                        e.preventDefault();
                        removeBullet(i, bi);
                      }
                    }}
                  />
                  {entry.bullets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBullet(i, bi)}
                      className="text-muted-foreground hover:text-destructive text-sm"
                      aria-label="Remove bullet"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addBullet(i)}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              + Add bullet
            </button>
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
