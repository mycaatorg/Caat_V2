"use client";

import React from "react";
import { ResumeSection, SectionMode } from "./types";
import PersonalInfoGuided from "./editors/PersonalInfoGuided";
import RichTextEditor from "@/components/RichTextEditor";

export default function SectionEditorPanel({
  section,
  onChange,
}: {
  section: ResumeSection | undefined;
  onChange: (patch: Partial<ResumeSection>) => void;
}) {
  if (!section) return null;

  function setMode(mode: SectionMode) {
    onChange({ mode });
  }

  return (
    <div className="p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{section.label}</h2>

        {/* Mode toggle */}
        <div className="flex rounded-md border p-1 text-sm">
          <button
            onClick={() => setMode("guided")}
            className={`rounded px-3 py-1 ${
              section.mode === "guided" ? "bg-blue-600 text-white" : "hover:bg-muted"
            }`}
          >
            Guided
          </button>
          <button
            onClick={() => setMode("free")}
            className={`rounded px-3 py-1 ${
              section.mode === "free" ? "bg-blue-600 text-white" : "hover:bg-muted"
            }`}
          >
            Free Text
          </button>
        </div>
      </div>

      <div className="mt-4">
        {section.mode === "guided" && section.type === "personal" ? (
          <PersonalInfoGuided
            value={section.structuredData ?? {}}
            onChange={(data) => onChange({ structuredData: data })}
          />
        ) : (
          <RichTextEditor
            content={section.contentHtml}
            onChange={(html) => onChange({ contentHtml: html })}
          />
        )}
      </div>
    </div>
  );
}
