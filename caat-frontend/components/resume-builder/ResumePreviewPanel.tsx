"use client";

import React, { useMemo } from "react";
import { ResumeSection } from "./types";

function safeText(x: any) {
  return typeof x === "string" ? x : "";
}

export default function ResumePreviewPanel({ sections }: { sections: ResumeSection[] }) {
  const personal = sections.find((s) => s.type === "personal")?.structuredData ?? {};

  const htmlSections = useMemo(() => {
    return sections
      .filter((s) => s.type !== "personal")
      .map((s) => ({
        id: s.id,
        label: s.label,
        html: s.contentHtml,
      }));
  }, [sections]);

  return (
    <div className="border-l bg-muted/30 p-4 overflow-auto">
      <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
        <div>A4</div>
        <div>Professional Resume Style</div>
        <div>100%</div>
      </div>

      <div className="mx-auto w-[420px] bg-white shadow-sm border p-10">
        <div className="text-center">
          <div className="text-2xl font-bold tracking-wide">
            {safeText(personal.fullName) || "JOHN DOE"}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {safeText(personal.email) || "john@example.com"}
            {"  •  "}
            {safeText(personal.phone) || "+1 234 567 890"}
            {"  •  "}
            {safeText(personal.location) || "Sydney, Australia"}
            {"  •  "}
            <span className="text-blue-600 underline">
              {safeText(personal.linkedin) || "linkedin.com/in/johndoe"}
            </span>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {htmlSections.map((s) => (
            <div key={s.id}>
              <div className="text-[11px] font-bold tracking-wider"> {s.label.toUpperCase()} </div>
              <div className="mt-1 h-px w-full bg-black/40" />

              <div
                className="mt-2 text-[11px] leading-4"
                // TEMP: simple renderLater sanitise if needed
                dangerouslySetInnerHTML={{ __html: s.html || "<p class='text-muted-foreground'>...</p>" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
