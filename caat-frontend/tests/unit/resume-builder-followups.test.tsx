// @vitest-environment jsdom
// Resume builder follow-ups (PROD-98): the toolbar follows the cursor, pasted
// indents stay inside the toolbar's cap, and previews keep list numbering.
import React, { act } from "react";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import RichTextEditor from "@/components/RichTextEditor";
import { ResumePreviewMini } from "@/components/resume-builder/ResumePreviewMini";
import type { ResumeSection } from "@/components/resume-builder/types";
import { mountComponent, unmountAll } from "./dom-helpers";
import { installLayoutStubs, restoreLayoutStubs } from "./resume-builder-harness";

async function mountEditor(html: string) {
  const container = await mountComponent(<RichTextEditor content={html} onChange={() => {}} />);
  const surface = container.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror");
  if (!surface?.editor) throw new Error("editor did not mount");
  return { container, editor: surface.editor };
}

/** Moves the cursor into `text` without changing the document. */
async function placeCursor(editor: Editor, text: string) {
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText && node.text?.includes(text)) at = pos + node.text.indexOf(text) + 1;
  });
  if (at < 0) throw new Error(`"${text}" is not in the editor`);
  await act(async () => {
    editor.commands.setTextSelection(at);
  });
}

const toolbarButton = (container: HTMLElement, label: string) =>
  container.querySelector<HTMLButtonElement>(`[role="toolbar"] button[aria-label="${label}"]`)!;

const margins = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return [...root.querySelectorAll<HTMLElement>("p, h2")]
    .filter((el) => el.textContent)
    .map((el) => `${el.textContent}:${el.style.marginLeft || "none"}`);
};

/** The number each printed list item shows, in reading order. */
function itemNumbers(root: ParentNode) {
  return [...root.querySelectorAll<HTMLOListElement>("ol")].flatMap((ol) => {
    const start = Number.parseInt(ol.getAttribute("start") ?? "1", 10);
    return [...ol.children].filter((li) => li.tagName === "LI").map((li, i) => `${start + i}:${li.textContent}`);
  });
}

describe("resume builder follow-ups", () => {
  // Toolbar clicks focus the editor, which schedules a scroll that needs layout.
  beforeEach(() => installLayoutStubs());
  afterEach(() => {
    unmountAll();
    restoreLayoutStubs();
  });

  describe("toolbar state follows the cursor", () => {
    it("enables List style as soon as the cursor moves into a saved list", async () => {
      const { container, editor } = await mountEditor(
        "<p>Intro SYN</p><ol><li><p>Item SYN</p></li></ol><p><strong>Bold SYN</strong></p>",
      );
      await placeCursor(editor, "Intro SYN");
      expect(toolbarButton(container, "List style").disabled).toBe(true);

      await placeCursor(editor, "Item SYN");
      expect(toolbarButton(container, "List style").disabled).toBe(false);
      expect(toolbarButton(container, "Numbered list").getAttribute("aria-pressed")).toBe("true");

      await placeCursor(editor, "Bold SYN");
      expect(toolbarButton(container, "List style").disabled).toBe(true);
      expect(toolbarButton(container, "Bold").getAttribute("aria-pressed")).toBe("true");
    });
  });

  describe("indent stays within the toolbar's eight steps", () => {
    it("caps indents from loaded or pasted HTML and reads other units", async () => {
      const { editor } = await mountEditor(
        '<p style="margin-left: 30em">Deep SYN</p><p style="margin-left: 36pt">Word SYN</p><p style="margin-left: 48px">Pixel SYN</p><p style="margin-left: -3em">Negative SYN</p><h2 style="margin-left: 99em">Heading SYN</h2>',
      );
      expect(margins(editor.getHTML())).toEqual([
        "Deep SYN:12em",
        "Word SYN:3em",
        "Pixel SYN:3em",
        "Negative SYN:none",
        "Heading SYN:12em",
      ]);
    });

    it("caps an indent pasted from another document", async () => {
      const { editor } = await mountEditor("<p>Start SYN</p>");
      await act(async () => {
        editor.commands.setTextSelection(editor.state.doc.content.size - 1);
        editor.view.pasteHTML(
          // The first pasted line joins the cursor's paragraph, as in any editor.
          '<p>Lead SYN</p><p style="margin-left: 1in">Inch SYN</p><p style="margin-left: 40em">Pasted SYN</p>',
          new Event("paste") as ClipboardEvent,
        );
      });
      expect(margins(editor.getHTML()).filter((m) => !m.startsWith("Start"))).toEqual([
        "Inch SYN:6em",
        "Pasted SYN:12em",
      ]);
    });

    it("steps on from a pasted Word indent instead of jumping to the cap", async () => {
      const { container, editor } = await mountEditor('<p style="margin-left: 36pt">Word SYN</p>');
      await placeCursor(editor, "Word SYN");
      await act(async () => toolbarButton(container, "Increase indent").click());
      expect(margins(editor.getHTML())).toEqual(["Word SYN:4.5em"]);
    });
  });

  describe("mini preview keeps list numbering and capped indents", () => {
    const section = (contentHtml: string): ResumeSection => ({
      id: "projects",
      type: "custom",
      label: "Projects",
      mode: "free",
      contentHtml,
    } as ResumeSection);

    async function renderMini(html: string) {
      const container = await mountComponent(<ResumePreviewMini sections={[section(html)]} />);
      // The first child is the hidden measurer; the scaled page follows it.
      return container.children[1] as HTMLElement;
    }

    it("numbers items 1, 2, 3 instead of 1, 1, 1", async () => {
      const page = await renderMini(
        '<ol style="list-style-type: decimal"><li><p>Alpha</p></li><li><p>Beta</p></li><li><p>Gamma</p></li></ol>',
      );
      expect(itemNumbers(page)).toEqual(["1:Alpha", "2:Beta", "3:Gamma"]);
      expect([...page.querySelectorAll<HTMLElement>("ol")].map((ol) => ol.style.listStyleType)).toEqual([
        "decimal",
        "decimal",
        "decimal",
      ]);
    });

    it("caps indents saved before the cap, as the editor shows them", async () => {
      const page = await renderMini('<p style="margin-left: 36em">Legacy SYN</p><p style="margin-left: 3em; text-align: center">Kept SYN</p>');
      expect([...page.querySelectorAll<HTMLElement>("p")].map((p) => `${p.textContent}:${p.style.marginLeft}`)).toEqual([
        "Legacy SYN:12em",
        "Kept SYN:3em",
      ]);
    });

    it("continues from a list's own starting number", async () => {
      const page = await renderMini("<ol start=\"4\"><li><p>Four</p></li><li><p>Five</p></li></ol>");
      expect(itemNumbers(page)).toEqual(["4:Four", "5:Five"]);
    });
  });
});
