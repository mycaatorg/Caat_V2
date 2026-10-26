import { educationToHtml, experienceToHtml, skillsToHtml } from "@/lib/resume-guided-html";
import type { EducationValue } from "./editors/EducationGuided";
import type { ExperienceValue } from "./editors/ExperienceGuided";
import type { SkillsValue } from "./editors/SkillsGuided";

type SectionLike = {
  type: string;
  mode: string;
  contentHtml: string;
  structuredData?: Record<string, unknown>;
};

// Section types that have a guided editor and can therefore generate HTML from
// their structured data. (personal is rendered as the contact header, not here.)
const GUIDED_CONTENT_TYPES = new Set(["education", "experience", "skills"]);

// HTML generated fresh from a section's guided (structured) data.
export function guidedToHtml(section: SectionLike): string {
  const sd = section.structuredData ?? {};
  switch (section.type) {
    case "education":
      return educationToHtml((sd as EducationValue).entries ?? []);
    case "experience":
      return experienceToHtml((sd as ExperienceValue).entries ?? []);
    case "skills":
      return skillsToHtml((sd as SkillsValue).categories ?? []);
    default:
      return "";
  }
}

/**
 * The HTML that should actually render for a section, based on which draft is
 * published (its `mode`). Guided sections render from their structured data;
 * free-text sections (and custom) render their own contentHtml. The two drafts
 * are independent — neither overwrites the other.
 */
export function publishedHtml(section: SectionLike): string {
  if (section.mode === "guided" && GUIDED_CONTENT_TYPES.has(section.type)) {
    return guidedToHtml(section);
  }
  return section.contentHtml || "";
}

export { isEmptyHtml } from "@/lib/resume-guided-html";
