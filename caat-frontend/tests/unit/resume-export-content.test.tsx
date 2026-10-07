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

describe("resume Print / PDF content", () => {
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
