// @vitest-environment jsdom
// Every formatting option the resume toolbar offers is stored as HTML. Loading
// that HTML back into the real TipTap editor and serialising it again (what the
// next save writes) must keep the formatting and must not drift between loads.
import React from "react";
import type { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import RichTextEditor from "@/components/RichTextEditor";
import { mountComponent, unmountAll } from "./dom-helpers";

type Check = (root: HTMLElement) => void;

const styleOf = (root: HTMLElement, selector: string) => root.querySelector<HTMLElement>(selector)?.style;
// TipTap keeps an empty trailing paragraph after the content; ignore it.
const all = (root: HTMLElement, selector: string) =>
  [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => el.textContent !== "");

const cases: Array<[string, string, Check]> = [
  [
    "bold, italic, underline and strikethrough",
    "<p><strong>Bold SYN</strong> <em>Italic SYN</em> <u>Under SYN</u> <s>Struck SYN</s></p>",
    (root) => expect(["strong", "em", "u", "s"].map((tag) => root.querySelector(tag)?.textContent)).toEqual([
      "Bold SYN", "Italic SYN", "Under SYN", "Struck SYN",
    ]),
  ],
  [
    "heading levels",
    "<h1>One SYN</h1><h2>Two SYN</h2><h3>Three SYN</h3>",
    (root) => expect(all(root, "h1, h2, h3").map((h) => `${h.tagName}:${h.textContent}`)).toEqual([
      "H1:One SYN", "H2:Two SYN", "H3:Three SYN",
    ]),
  ],
  [
    "alignment on paragraphs and headings",
    '<p style="text-align: left">L</p><p style="text-align: center">C</p><p style="text-align: right">R</p><p style="text-align: justify">J</p><h2 style="text-align: center">H</h2>',
    (root) => expect(all(root, "p, h2").map((el) => `${el.textContent}:${el.style.textAlign}`)).toEqual([
      "L:left", "C:center", "R:right", "J:justify", "H:center",
    ]),
  ],
  [
    "font family, size, colour and highlight",
    '<p><span style="font-family: Georgia; font-size: 24px; color: #9a1a27; background-color: #fef08a">Styled SYN</span> plain</p>',
    (root) => {
      const span = styleOf(root, "span")!;
      expect([span.fontFamily, span.fontSize, span.color, span.backgroundColor]).toEqual([
        "Georgia", "24px", "rgb(154, 26, 39)", "rgb(254, 240, 138)",
      ]);
    },
  ],
  [
    "line spacing on paragraphs and headings",
    '<p style="line-height: 1">A</p><p style="line-height: 1.15">B</p><p style="line-height: 2">C</p><h3 style="line-height: 1.5">D</h3>',
    (root) => expect(all(root, "p, h3").map((el) => el.style.lineHeight)).toEqual(["1", "1.15", "2", "1.5"]),
  ],
  [
    "indent levels from one step to the maximum",
    '<p style="margin-left: 1.5em">One</p><p style="margin-left: 4.5em">Three</p><p style="margin-left: 12em">Eight</p><h2 style="margin-left: 3em">Two</h2>',
    (root) => expect(all(root, "p, h2").map((el) => el.style.marginLeft)).toEqual(["1.5em", "4.5em", "12em", "3em"]),
  ],
  [
    "bullet marker styles",
    '<ul style="list-style-type: disc"><li><p>D</p></li></ul><ul style="list-style-type: circle"><li><p>C</p></li></ul><ul style="list-style-type: square"><li><p><strong>S</strong></p></li></ul>',
    (root) => {
      expect(all(root, "ul").map((ul) => ul.style.listStyleType)).toEqual(["disc", "circle", "square"]);
      expect(root.querySelector("ul:last-of-type li strong")?.textContent).toBe("S");
    },
  ],
  [
    "numbering styles",
    '<ol style="list-style-type: decimal"><li><p>1</p></li></ol><ol style="list-style-type: lower-alpha"><li><p>a</p></li></ol><ol style="list-style-type: upper-alpha"><li><p>A</p></li></ol><ol style="list-style-type: lower-roman"><li><p>i</p></li><li><p>ii</p></li></ol>',
    (root) => {
      expect(all(root, "ol").map((ol) => ol.style.listStyleType)).toEqual(["decimal", "lower-alpha", "upper-alpha", "lower-roman"]);
      expect(all(root, "ol:last-of-type > li").map((li) => li.textContent)).toEqual(["i", "ii"]);
    },
  ],
  [
    "links",
    '<p><a href="https://example.test/syn">Link SYN</a></p>',
    (root) => expect(root.querySelector("a")?.getAttribute("href")).toBe("https://example.test/syn"),
  ],
  [
    "block and inline formatting combined on one paragraph",
    '<p style="text-align: center; line-height: 1.5; margin-left: 3em"><strong><em><span style="font-size: 18px">Mixed SYN</span></em></strong></p>',
    (root) => {
      const p = styleOf(root, "p")!;
      expect([p.textAlign, p.lineHeight, p.marginLeft]).toEqual(["center", "1.5", "3em"]);
      expect(["strong", "em"].map((tag) => root.querySelector(tag)?.textContent)).toEqual(["Mixed SYN", "Mixed SYN"]);
      expect(styleOf(root, 'span[style*="font-size"]')?.fontSize).toBe("18px");
      expect(root.querySelector('span[style*="font-size"]')?.textContent).toBe("Mixed SYN");
    },
  ],
];

async function load(html: string) {
  const onChange = vi.fn();
  const container = await mountComponent(<RichTextEditor content={html} onChange={onChange} />);
  const surface = container.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror");
  if (!surface?.editor) throw new Error("editor did not mount");
  // getHTML() is exactly what the editor hands to onChange, i.e. what is saved.
  const saved = surface.editor.getHTML();
  unmountAll();
  return { saved, onChange };
}

function parse(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("resume rich text formatting round trip", () => {
  afterEach(() => unmountAll());

  it.each(cases)("keeps %s across a save and reload", async (_name, stored, check) => {
    const first = await load(stored);
    check(parse(first.saved));
    // Loading saved content is not an edit and must not trigger a write.
    expect(first.onChange).not.toHaveBeenCalled();

    const second = await load(first.saved);
    expect(second.saved).toBe(first.saved);
  });
});
