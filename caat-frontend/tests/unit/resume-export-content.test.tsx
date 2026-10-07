// @vitest-environment jsdom
// Print / PDF export: the browser prints only the [data-print-resume] portal,
// so its paginated HTML is the exported artifact. These tests assert on that
// HTML (formatting, order, published drafts, page breaks) rather than on the
// print call alone.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { unmountAll } from "./dom-helpers";
import {
  fakeResumeApi,
  installLayoutStubs,
  mountBuilder,
  openSection,
  pressToolbar,
  printRoot,
  printedPages,
  resetStore,
  restoreLayoutStubs,
  savedSection,
  seedResume,
  selectText,
  settle,
  words,
} from "./resume-builder-harness";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/components/resume-builder/api", async () => (await import("./resume-builder-harness")).fakeResumeApi);
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

const personal = {
  id: "personal",
  type: "personal" as const,
  label: "Personal Information",
  mode: "guided" as const,
  contentHtml: "",
  structuredData: { fullName: "Synthetic Student", email: "student@example.test" },
};

const pages = () => [...printRoot().querySelectorAll<HTMLElement>(".resume-print-page")];

function printButton() {
  return [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Print / PDF")!;
}

// Each test mounts the full builder with TipTap; under CI coverage one test can
// take several seconds, and a timed-out test keeps running into the next one.
describe("resume Print / PDF content", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStore();
    installLayoutStubs();
    toastError.mockReset();
  });

  afterEach(() => {
    unmountAll();
    restoreLayoutStubs();
    vi.useRealTimers();
  });

  it("prints every section in saved order with its published draft and formatting", async () => {
    seedResume(
      [
        personal,
        {
          id: "profile",
          type: "custom",
          label: "Profile",
          mode: "free",
          contentHtml:
            '<h2 style="text-align: right;">Heading SYN</h2>' +
            '<p style="text-align: center; line-height: 2; margin-left: 3em;"><strong>Bold SYN</strong> <em>Italic SYN</em> <u>Under SYN</u> <s>Struck SYN</s> ' +
            '<span style="font-family: Georgia; font-size: 24px; color: rgb(154, 26, 39); background-color: rgb(254, 240, 138);">Styled SYN</span> ' +
            '<a href="https://example.test/syn">Link SYN</a></p>',
        },
        {
          id: "experience",
          type: "experience",
          label: "Experience",
          mode: "free",
          contentHtml:
            '<ul style="list-style-type: square;"><li><p>Square SYN</p></li></ul>' +
            '<ol style="list-style-type: upper-alpha;"><li><p>Alpha SYN</p></li><li><p><strong>Beta SYN</strong></p></li><li><p>Gamma SYN</p></li></ol>',
          structuredData: { entries: [{ id: "e1", company: "Unpublished Guided Co", title: "", location: "", startDate: "", endDate: "", current: false }] },
        },
        {
          id: "education",
          type: "education",
          label: "Education",
          mode: "guided",
          contentHtml: "<p>Unpublished free draft</p>",
          structuredData: {
            entries: [{
              id: "ed1", institution: "Synthetic University", degree: "BSc", field: "Testing", startDate: "2022", endDate: "2025",
              current: false, gpa: "", description: '<ul style="list-style-type: circle;"><li><p><em>Dean SYN list</em></p></li></ul>',
            }],
          },
        },
        { id: "skills", type: "skills", label: "Skills & Interests", mode: "free", contentHtml: "" },
      ],
      { marginPreset: "wide" },
    );
    await mountBuilder();

    // Wide margins shrink the printable area, so this resume runs to two pages.
    expect(pages()).toHaveLength(2);
    expect(pages().map((p) => p.querySelector<HTMLElement>(".resume-page")?.style.padding)).toEqual(["92px", "92px"]);
    const page = printRoot();
    expect(page.querySelector(".resume-page-footer")).toBeNull();

    const text = printedPages().join(" ");
    expect(printedPages()[0].indexOf("Synthetic Student")).toBe(0);
    expect(printedPages()[1]).not.toContain("Synthetic Student");
    const order = ["PROFILE", "EXPERIENCE", "EDUCATION", "SKILLS & INTERESTS"].map((label) => text.indexOf(label));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text).not.toContain("PERSONAL INFORMATION");
    expect(text).not.toContain("Unpublished");
    expect(text).toContain("Synthetic University — BSc in Testing");

    const heading = page.querySelector<HTMLElement>("h2");
    expect([heading?.textContent, heading?.style.textAlign]).toEqual(["Heading SYN", "right"]);
    const paragraph = page.querySelector<HTMLElement>('p[style*="text-align: center"]')!;
    expect([paragraph.style.lineHeight, paragraph.style.marginLeft]).toEqual(["2", "3em"]);
    expect(["strong", "em", "u", "s"].map((tag) => paragraph.querySelector(tag)?.textContent)).toEqual([
      "Bold SYN", "Italic SYN", "Under SYN", "Struck SYN",
    ]);
    const styled = paragraph.querySelector<HTMLElement>("span")!;
    expect([styled.style.fontFamily, styled.style.fontSize, styled.style.color, styled.style.backgroundColor]).toEqual([
      "Georgia", "24px", "rgb(154, 26, 39)", "rgb(254, 240, 138)",
    ]);
    expect(paragraph.querySelector("a")?.getAttribute("href")).toBe("https://example.test/syn");

    expect(page.querySelector('ul[style*="list-style-type: square"]')?.textContent).toBe("Square SYN");
    expect(page.querySelector('ul[style*="list-style-type: circle"] em')?.textContent).toBe("Dean SYN list");
    // Each item prints as its own list so it can break across pages; the
    // numbering and marker style must carry over to every item.
    const lettered = [...page.querySelectorAll<HTMLOListElement>('ol[style*="list-style-type: upper-alpha"]')];
    expect(lettered.map((ol) => [ol.getAttribute("start"), ol.textContent])).toEqual([
      [null, "Alpha SYN"],
      ["2", "Beta SYN"],
      ["3", "Gamma SYN"],
    ]);
    expect(lettered[1].querySelector("strong")?.textContent).toBe("Beta SYN");
  });

  it("keeps a paragraph's formatting on both pages when it breaks across a page", async () => {
    const lead = words("Lead", 30);
    const tail = words("Tail", 30);
    seedResume([
      personal,
      {
        id: "profile",
        type: "custom",
        label: "Profile",
        mode: "free",
        contentHtml: `<p style="text-align: center; line-height: 1.5;"><strong>${lead}</strong> <em>${tail}</em></p>`,
      },
    ]);
    await mountBuilder();

    // 704px remain on page one after the header: 35 words of 20px fit.
    expect(pages()).toHaveLength(2);
    const [first, second] = pages().map((page) => page.querySelector<HTMLElement>(".resume-preview-content p")!);
    for (const part of [first, second]) {
      expect([part.style.textAlign, part.style.lineHeight, part.style.textAlignLast]).toEqual(["center", "1.5", ""]);
    }
    expect(first.querySelector("strong")?.textContent).toBe(lead);
    expect(first.querySelector("em")?.textContent).toBe(words("Tail", 5));
    expect(second.querySelector("strong")).toBeNull();
    expect(second.querySelector("em")?.textContent?.trim()).toBe(tail.split(" ").slice(5).join(" "));
    expect(`${first.textContent} ${second.textContent}`.replace(/\s+/g, " ").trim()).toBe(`${lead} ${tail}`);
  });

  it("keeps a numbered item's list type, number and formatting when it breaks across a page", async () => {
    const long = words("Long", 60);
    seedResume([
      personal,
      {
        id: "projects",
        type: "custom",
        label: "Projects",
        mode: "free",
        contentHtml: `<ol style="list-style-type: upper-roman;"><li><p>Short SYN item</p></li><li><p><strong>${long}</strong></p></li></ol>`,
      },
    ]);
    await mountBuilder();

    // Page one: 704px - 60px for the first item leaves room for 32 words.
    expect(pages()).toHaveLength(2);
    const [head, rest] = pages().map((page) => [...page.querySelectorAll<HTMLElement>(".resume-preview-content > *")].at(-1)!);
    for (const part of [head, rest]) {
      expect(part.tagName).toBe("OL");
      expect(part.style.listStyleType).toBe("upper-roman");
      expect(part.getAttribute("start")).toBe("2");
    }
    expect(head.querySelector("li strong")?.textContent).toBe(words("Long", 32));
    expect(rest.querySelector("li strong")?.textContent?.trim()).toBe(long.split(" ").slice(32).join(" "));
    // The continuation is the same item, so it must not print a second marker.
    expect(head.querySelector<HTMLElement>("li")!.style.listStyleType).toBe("");
    expect(rest.querySelector<HTMLElement>("li")!.style.listStyleType).toBe("none");
  });

  it("continues a nested list item across a page without a repeated or restarted number", async () => {
    const long = words("Long", 60);
    seedResume([
      personal,
      {
        id: "projects",
        type: "custom",
        label: "Projects",
        mode: "free",
        contentHtml:
          "<ol><li><p>Parent SYN</p><ol><li><p>a</p></li><li><p>b</p></li>" +
          `<li><p><strong>${long}</strong></p></li><li><p>Next SYN</p></li></ol></li></ol>`,
      },
    ]);
    await mountBuilder();

    // 35 words fit on page one. Text from adjacent blocks has no space between
    // it ("SYN" "a" "b" "Long1" count as one word), so that is Long1-Long34.
    expect(pages()).toHaveLength(2);
    const [head, rest] = pages().map((page) => [...page.querySelectorAll<HTMLElement>(".resume-preview-content > *")].at(-1)!);
    const nested = (part: HTMLElement) => part.querySelector<HTMLOListElement>(":scope > li > ol")!;
    const items = (part: HTMLElement) => [...nested(part).querySelectorAll<HTMLElement>(":scope > li")];

    expect(nested(head).getAttribute("start")).toBeNull();
    expect(items(head).map((li) => [li.textContent, li.style.listStyleType])).toEqual([
      ["a", ""], ["b", ""], [words("Long", 34), ""],
    ]);
    // Page two: the parent and the third sub-item are continuations (no
    // markers); the next sub-item is still number 4.
    expect(rest.querySelector<HTMLElement>(":scope > li")!.style.listStyleType).toBe("none");
    expect(nested(rest).getAttribute("start")).toBe("3");
    expect(items(rest).map((li) => [li.textContent?.trim(), li.style.listStyleType])).toEqual([
      [long.split(" ").slice(34).join(" "), "none"],
      ["Next SYN", ""],
    ]);
  });

  it("numbers a list from its own starting number, keeping its marker style", async () => {
    seedResume([
      personal,
      {
        id: "projects",
        type: "custom",
        label: "Projects",
        mode: "free",
        contentHtml: '<ol start="3" style="list-style-type: lower-alpha"><li><p>Third SYN</p></li><li><p>Fourth SYN</p></li></ol>',
      },
    ]);
    await mountBuilder();

    const lists = [...printRoot().querySelectorAll<HTMLOListElement>(".resume-preview-content ol")];
    expect(lists.map((ol) => [ol.getAttribute("start"), ol.style.listStyleType, ol.textContent])).toEqual([
      ["3", "lower-alpha", "Third SYN"],
      ["4", "lower-alpha", "Fourth SYN"],
    ]);
  });

  it("justifies the last line of a justified paragraph's first half", async () => {
    const text = words("Just", 60);
    seedResume([
      personal,
      { id: "profile", type: "custom", label: "Profile", mode: "free", contentHtml: `<p style="text-align: justify;">${text}</p>` },
    ]);
    await mountBuilder();

    expect(pages()).toHaveLength(2);
    const [first, second] = pages().map((page) => page.querySelector<HTMLElement>(".resume-preview-content p")!);
    expect([first.style.textAlign, first.style.textAlignLast]).toEqual(["justify", "justify"]);
    // The paragraph really ends on page two, so its last line stays ragged.
    expect([second.style.textAlign, second.style.textAlignLast]).toEqual(["justify", ""]);
  });

  it("does not stretch hard line breaks in a justified paragraph's first half", async () => {
    const text = `Responsibilities:<br>${words("Just", 60)}`;
    seedResume([
      personal,
      { id: "profile", type: "custom", label: "Profile", mode: "free", contentHtml: `<p style="text-align: justify;">${text}</p>` },
    ]);
    await mountBuilder();

    expect(pages()).toHaveLength(2);
    const first = pages()[0].querySelector<HTMLElement>(".resume-preview-content p")!;
    expect(first.querySelector("br")).not.toBeNull();
    // text-align-last would also stretch "Responsibilities:" across the line.
    expect([first.style.textAlign, first.style.textAlignLast]).toEqual(["justify", ""]);
  });

  it("saves pending edits before printing, so the printout matches what was saved", async () => {
    seedResume([personal, { id: "profile", type: "custom", label: "Profile", mode: "free", contentHtml: "<p>Print SYN text</p>" }]);
    const printed: Array<{ html: string; saved: string | undefined }> = [];
    vi.mocked(window.print).mockImplementation(() => {
      printed.push({ html: printRoot().innerHTML, saved: savedSection("Profile")?.contentHtml });
    });
    await mountBuilder();
    await openSection("Profile");
    await selectText("Print SYN text");
    await pressToolbar("Bold");

    await act(async () => printButton().click());
    await settle();

    expect(fakeResumeApi.saveResumeState).toHaveBeenCalledTimes(1);
    expect(printed).toHaveLength(1);
    expect(printed[0].saved).toContain("<strong>Print SYN text</strong>");
    expect(printed[0].html).toContain("<strong>Print SYN text</strong>");
    expect(document.title).toBe("Synthetic Resume");
  });

  it("reports a failed save before printing and still prints what is on screen", async () => {
    seedResume([personal, { id: "profile", type: "custom", label: "Profile", mode: "free", contentHtml: "<p>Offline SYN text</p>" }]);
    fakeResumeApi.saveResumeState.mockRejectedValueOnce(new Error("network down"));
    const printed: string[] = [];
    vi.mocked(window.print).mockImplementation(() => {
      printed.push(printRoot().innerHTML);
    });
    await mountBuilder();
    await openSection("Profile");
    await selectText("Offline SYN text");
    await pressToolbar("Italic");

    await act(async () => printButton().click());
    await settle();

    expect(toastError).toHaveBeenCalledWith("Failed to save resume. Please try again.");
    expect(savedSection("Profile")?.contentHtml).toBe("<p>Offline SYN text</p>");
    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain("<em>Offline SYN text</em>");
  });
});
