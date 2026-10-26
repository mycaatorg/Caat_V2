import type { SkillCategory } from "@/components/resume-builder/editors/SkillsGuided";

import type { ExperienceEntry } from "@/components/resume-builder/editors/ExperienceGuided";

import type { EducationEntry } from "@/components/resume-builder/editors/EducationGuided";

// Pure published-content renderers shared by the builder and server-side sharing.

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function educationToHtml(entries: EducationEntry[]): string {
  return entries
    .filter((e) => e.institution || e.degree)
    .map((e) => {
      const titleLine = [e.degree, e.field].filter(Boolean).map(escapeHtml).join(" in ");
      const datePart = e.current
        ? `${escapeHtml(e.startDate)} – Present`
        : [e.startDate, e.endDate].filter(Boolean).map(escapeHtml).join(" – ");
      const metaParts = [datePart, e.gpa ? `GPA: ${escapeHtml(e.gpa)}` : ""].filter(Boolean).join(" · ");
      const lines: string[] = [];
      if (e.institution)
        lines.push(`<p><strong>${escapeHtml(e.institution)}</strong>${titleLine ? ` — ${titleLine}` : ""}</p>`);
      if (metaParts) lines.push(`<p>${metaParts}</p>`);
      // description is rich-text HTML from the Notes editor — embed as-is.
      if (e.description && !isEmptyHtml(e.description)) {
        lines.push(e.description);
      }
      return lines.join("");
    })
    .join("<p>&nbsp;</p>");
}

// The entry's description as HTML: prefer the rich `description`, else derive
// from the legacy `bullets` array so existing resumes keep their content.
export function entryDescriptionHtml(e: ExperienceEntry): string {
  if (typeof e.description === "string") return e.description;
  const bullets = (e.bullets ?? []).map((b) => b.trim()).filter(Boolean);
  return bullets.length > 0
    ? `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
    : "";
}

export function experienceToHtml(entries: ExperienceEntry[]): string {
  return entries
    .filter((e) => e.company || e.title)
    .map((e) => {
      const datePart = e.current
        ? `${escapeHtml(e.startDate)} – Present`
        : [e.startDate, e.endDate].filter(Boolean).map(escapeHtml).join(" – ");
      const metaParts = [datePart, escapeHtml(e.location)].filter(Boolean).join(" · ");
      const lines: string[] = [];

      if (e.company || e.title) {
        lines.push(
          `<p><strong>${escapeHtml(e.company)}</strong>${e.title ? ` — ${escapeHtml(e.title)}` : ""}</p>`
        );
      }
      if (metaParts) lines.push(`<p>${metaParts}</p>`);

      const desc = entryDescriptionHtml(e);
      if (desc && !isEmptyHtml(desc)) lines.push(desc);

      return lines.join("");
    })
    .join("<p>&nbsp;</p>");
}

export function skillsToHtml(categories: SkillCategory[]): string {
  return categories
    .filter((c) => c.skills.trim())
    .map((c) => {
      if (c.name.trim()) {
        return `<p><strong>${escapeHtml(c.name)}:</strong> ${escapeHtml(c.skills)}</p>`;
      }
      return `<p>${escapeHtml(c.skills)}</p>`;
    })
    .join("");
}

// True when an HTML draft has no visible content (used for empty-state hints).
export function isEmptyHtml(html: string | undefined): boolean {
  if (!html) return true;
  return !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
