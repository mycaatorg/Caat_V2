import { Extension } from "@tiptap/core";

const STEP_EM = 1.5;
export const MAX_INDENT = 8;

// One step is 1.5em at the 16px base, so margins in other units (pasted from
// Word or Google Docs as pt, in or px) map onto the same steps.
const STEP_PX = STEP_EM * 16;
const PX_PER_UNIT: Record<string, number> = {
  px: 1,
  pt: 4 / 3,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  em: 16,
  rem: 16,
};

export const clampIndent = (level: number) =>
  Number.isFinite(level) ? Math.max(0, Math.min(MAX_INDENT, Math.round(level))) : 0;

/** The indent step for a CSS margin-left, capped like the toolbar caps it. */
export function indentFromMargin(marginLeft: string): number {
  const match = /^(-?\d*\.?\d+)([a-z]*)$/i.exec(marginLeft.trim());
  if (!match) return 0;
  const perUnit = PX_PER_UNIT[(match[2] || "px").toLowerCase()];
  return perUnit ? clampIndent((Number(match[1]) * perUnit) / STEP_PX) : 0;
}

/**
 * Rewrites block indents in stored HTML to the capped steps. Content saved
 * before the cap (a pasted 36pt read as 24 steps) otherwise prints wider in
 * the previews and PDF than the editor shows it.
 */
export function capIndents(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("p, h1, h2, h3, h4, h5, h6").forEach((el) => {
    if (!el.style.marginLeft) return;
    const level = indentFromMargin(el.style.marginLeft);
    el.style.marginLeft = level > 0 ? `${level * STEP_EM}em` : "";
    if (!el.getAttribute("style")) el.removeAttribute("style");
  });
}

/**
 * Adds an `indent` level (0..MAX_INDENT) to block nodes, rendered as an inline
 * `margin-left` so it carries into the preview + printed PDF. The toolbar's
 * indent/outdent buttons read the current level and updateAttributes.
 */
export const IndentExtension = Extension.create({
  name: "indent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => indentFromMargin((element as HTMLElement).style.marginLeft),
            renderHTML: (attributes) => {
              const level = clampIndent(Number(attributes.indent) || 0);
              if (level <= 0) return {};
              return { style: `margin-left: ${level * STEP_EM}em` };
            },
          },
        },
      },
    ];
  },
});
