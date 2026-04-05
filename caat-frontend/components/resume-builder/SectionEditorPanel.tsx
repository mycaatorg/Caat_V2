"use client";

import React from "react";
import { ResumeSection, SectionMode } from "./types";
import PersonalInfoGuided from "./editors/PersonalInfoGuided";
import EducationGuided, { type EducationValue } from "./editors/EducationGuided";
import ExperienceGuided, { type ExperienceValue } from "./editors/ExperienceGuided";
import SkillsGuided, { type SkillsValue } from "./editors/SkillsGuided";
import RichTextEditor from "@/components/RichTextEditor";

const GUIDED_TYPES = new Set(["personal", "education", "experience", "skills"]);

export default function SectionEditorPanel({
  section,
  onChange,
}: {
  section: ResumeSection | undefined;
  onChange: (patch: Partial<ResumeSection>) => void;
}) {
  if (!section) return null;

  const supportsGuided = GUIDED_TYPES.has(section.type);

  function setMode(mode: SectionMode) {
    onChange({ mode });
  }

  function renderGuidedEditor() {
    const structuredData = section!.structuredData ?? {};

    if (section!.type === "personal") {
      return (
        <PersonalInfoGuided
          value={structuredData}
          onChange={(data) => onChange({ structuredData: data })}
        />
      );
    }

    if (section!.type === "education") {
      return (
        <EducationGuided
          value={structuredData as EducationValue}
          onChange={(data, html) => onChange({ structuredData: data, contentHtml: html })}
        />
      );
    }

    if (section!.type === "experience") {
      return (
        <ExperienceGuided
          value={structuredData as ExperienceValue}
          onChange={(data, html) => onChange({ structuredData: data, contentHtml: html })}
        />
      );
    }

    if (section!.type === "skills") {
      return (
        <SkillsGuided
          value={structuredData as SkillsValue}
          onChange={(data, html) => onChange({ structuredData: data, contentHtml: html })}
        />
      );
    }

    return null;
  }

  return (
    <div className="p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{section.label}</h2>

        {supportsGuided && (
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
        )}
      </div>

      <div className="mt-4">
        {section.mode === "guided" && supportsGuided ? (
          renderGuidedEditor()
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
