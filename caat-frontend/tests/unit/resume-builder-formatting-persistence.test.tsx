// @vitest-environment jsdom
// The real builder (shell, structure panel, TipTap toolbar, preview and print
// portal) against an in-memory resume API: formatting and section edits must
// survive a save and a reload, and a failed save must not lose them.
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { change, deferred, unmountAll } from "./dom-helpers";
import {
  activeEditor,
  advanceAutosave,
  applySave,
  editorSurface,
  fakeResumeApi,
  installLayoutStubs,
  mountBuilder,
  openSection,
  pickToolbarMenuItem,
  pickToolbarOption,
  pressToolbar,
  printRoot,
  printedPages,
  resetStore,
  restoreLayoutStubs,
  savedSection,
  savedSections,
  sectionButton,
  seedResume,
  selectText,
  settle,
  structureOrder,
  typeText,
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
  structuredData: { fullName: "Synthetic Student" },
};

const guidedEntry = {
  id: "x1", company: "Guided SYN Co", title: "Intern", location: "", startDate: "", endDate: "", current: false,
  description: "<p>Guided SYN notes</p>",
};

function parse(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

/** The representative formatting applied in the toolbar test, wherever it renders. */
function expectToolbarFormatting(root: ParentNode) {
  const lead = root.querySelector<HTMLElement>('p[style*="text-align: center"] strong');
  expect(lead?.textContent).toBe("Lead SYN statement");

  const detail = [...root.querySelectorAll<HTMLElement>("p")].find((p) => p.textContent === "Detail SYN line");
  expect(detail?.style.lineHeight).toBe("1.5");
  expect(detail?.style.marginLeft).toBe("1.5em");
  expect(detail?.querySelector("em")?.textContent).toBe("Detail SYN line");
  expect(detail?.querySelector("u")?.textContent).toBe("Detail SYN line");
  expect(detail?.querySelector<HTMLElement>('span[style*="font-size"]')?.style.fontSize).toBe("18px");
}

function orderedItems(root: ParentNode) {
  return [...root.querySelectorAll<HTMLElement>('ol[style*="list-style-type: lower-roman"] > li')].map((li) => li.textContent);
}

async function reload() {
  unmountAll();
  await mountBuilder();
}

async function clickRowButton(sectionLabel: string, action: "Delete section" | "Rename section") {
  const row = sectionButton(sectionLabel).closest("div.flex.items-center.gap-2.rounded-md")!;
  const control = row.querySelector<HTMLButtonElement>(`button[aria-label="${action}"]`)!;
  await act(async () => control.click());
  await settle();
}

async function renameSection(from: string, to: string) {
  await clickRowButton(from, "Rename section");
  const field = document.querySelector<HTMLInputElement>('input[value="' + from + '"]')!;
  await change(field, to);
  await act(async () => {
    field.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await settle();
}

async function moveSection(label: string, key: "ArrowUp" | "ArrowDown") {
  const handle = document.querySelector<HTMLButtonElement>(`button[aria-label^="Reorder ${label} section"]`)!;
  for (const keyName of [" ", key, " "]) {
    await act(async () => {
      handle.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, code: keyName === " " ? "Space" : keyName, bubbles: true }));
      await vi.advanceTimersByTimeAsync(50);
    });
  }
  await settle();
}

// Each test mounts the full builder with TipTap; under CI coverage one test can
// take several seconds, and a timed-out test keeps running into the next one.
describe("resume formatting and section edits survive save and reload", { timeout: 30_000 }, () => {
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

  it("restores toolbar formatting in the editor and the printout after a reload", async () => {
    seedResume([
      personal,
      {
        id: "summary",
        type: "custom",
        label: "Summary",
        mode: "free",
        contentHtml: "<p>Lead SYN statement</p><p>Detail SYN line</p><p>First SYN point</p><p>Second SYN point</p>",
      },
    ]);
    await mountBuilder();
    await openSection("Summary");

    await selectText("Lead SYN statement");
    await pressToolbar("Bold");
    await pressToolbar("Align center");
    await selectText("Detail SYN line");
    await pressToolbar("Italic");
    await pressToolbar("Underline");
    await pickToolbarOption("Font size", "18");
    await pickToolbarOption("Line spacing", "1.5");
    await pressToolbar("Increase indent");
    await selectText("First SYN point", "Second SYN point");
    await pressToolbar("Numbered list");
    await pickToolbarMenuItem("List style", /Roman/);
    await advanceAutosave();

    const saved = parse(savedSection("Summary")!.contentHtml);
    expectToolbarFormatting(saved);
    expect(orderedItems(saved)).toEqual(["First SYN point", "Second SYN point"]);

    await reload();
    await openSection("Summary");
    expectToolbarFormatting(editorSurface());
    expect(orderedItems(editorSurface())).toEqual(["First SYN point", "Second SYN point"]);

    // The printout splits a list into one list per item; numbering continues.
    expectToolbarFormatting(printRoot());
    const printedItems = [...printRoot().querySelectorAll<HTMLOListElement>('ol[style*="list-style-type: lower-roman"]')];
    expect(printedItems.map((ol) => [ol.getAttribute("start"), ol.textContent])).toEqual([
      [null, "First SYN point"],
      ["2", "Second SYN point"],
    ]);
    // A reload of unchanged content must not write anything back.
    const writes = fakeResumeApi.saveResumeState.mock.calls.length;
    await advanceAutosave();
    expect(fakeResumeApi.saveResumeState).toHaveBeenCalledTimes(writes);
  });

  it("restores renamed, reordered, added and mode-switched sections after a reload", async () => {
    seedResume([
      personal,
      { id: "education", type: "education", label: "Education", mode: "free", contentHtml: "<p>Education SYN draft</p>" },
      {
        id: "experience",
        type: "experience",
        label: "Experience",
        mode: "guided",
        contentHtml: "<p><em>Experience SYN free draft</em></p>",
        structuredData: { entries: [guidedEntry] },
      },
      { id: "projects", type: "custom", label: "Projects", mode: "free", contentHtml: "<p>Projects SYN body</p>" },
    ]);
    await mountBuilder();

    await renameSection("Projects", "Selected Projects");
    await moveSection("Selected Projects", "ArrowUp");
    await act(async () => [...document.querySelectorAll("button")].find((b) => b.textContent === "+ Add Section")!.click());
    await act(async () => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().endsWith("Custom Section"))!.click());
    await settle();
    const newLabel = document.querySelector<HTMLInputElement>('input[value="Custom Section"]')!;
    await change(newLabel, "Volunteering");
    await act(async () => newLabel.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await settle();
    // The editor now shows the new, empty section.
    expect(activeEditor().getText()).toBe("");
    await typeText("<p><strong>Volunteer SYN</strong> tutoring</p>");
    await openSection("Experience");
    await act(async () => [...document.querySelectorAll("button")].find((b) => b.textContent === "Free Text")!.click());
    await advanceAutosave();

    const expectedOrder = ["Personal Information", "Education", "Selected Projects", "Experience", "Volunteering"];
    expect(savedSections().map((s) => s.label)).toEqual(expectedOrder);
    expect(savedSections().map((s) => s.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    const experience = savedSection("Experience")!;
    expect(experience.mode).toBe("free");
    // Switching drafts keeps the guided one too.
    expect(experience.structuredData).toEqual({ entries: [guidedEntry] });

    await reload();
    expect(structureOrder()).toEqual(expectedOrder);
    await openSection("Volunteering");
    expect(editorSurface().querySelector("strong")?.textContent).toBe("Volunteer SYN");
    const printed = printedPages().join(" ");
    const positions = ["EDUCATION", "SELECTED PROJECTS", "EXPERIENCE", "VOLUNTEERING"].map((label) => printed.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(printed).toContain("Experience SYN free draft");
    expect(printed).not.toContain("Guided SYN Co");
  });

  it("keeps a deleted section deleted after a reload, even when a save was already in flight", async () => {
    seedResume([
      personal,
      { id: "summary", type: "custom", label: "Summary", mode: "free", contentHtml: "<p>Summary SYN</p>" },
      { id: "projects", type: "custom", label: "Projects", mode: "free", contentHtml: "<p>Projects SYN</p>" },
    ]);
    const inFlight = deferred<void>();
    fakeResumeApi.saveResumeState.mockImplementationOnce(async (payload) => {
      // The upsert lands only after the user has deleted the section.
      await inFlight.promise;
      applySave(payload);
    });
    await mountBuilder();
    await openSection("Projects");
    await selectText("Projects SYN");
    await pressToolbar("Bold");
    await advanceAutosave();
    expect(fakeResumeApi.saveResumeState).toHaveBeenCalledTimes(1);

    await clickRowButton("Projects", "Delete section");
    expect(window.confirm).toHaveBeenCalledWith('Delete the "Projects" section? This cannot be undone.');
    expect(structureOrder()).toEqual(["Personal Information", "Summary"]);
    expect(fakeResumeApi.deleteSection).not.toHaveBeenCalled();
    await act(async () => inFlight.resolve());
    await settle();
    await advanceAutosave();

    expect(fakeResumeApi.deleteSection).toHaveBeenCalledWith("projects");
    expect(toastError).not.toHaveBeenCalled();
    expect(savedSections().map((s) => s.label)).toEqual(["Personal Information", "Summary"]);
    await reload();
    expect(structureOrder()).toEqual(["Personal Information", "Summary"]);
    expect(printedPages().join(" ")).not.toContain("PROJECTS");
  });

  it("puts a section back in place, with its edits, when the server delete fails", async () => {
    seedResume([
      personal,
      { id: "summary", type: "custom", label: "Summary", mode: "free", contentHtml: "<p>Summary SYN</p>" },
      { id: "projects", type: "custom", label: "Projects", mode: "free", contentHtml: "<p>Projects SYN</p>" },
      { id: "awards", type: "custom", label: "Awards", mode: "free", contentHtml: "<p>Awards SYN</p>" },
    ]);
    const order = ["Personal Information", "Summary", "Projects", "Awards"];
    fakeResumeApi.deleteSection.mockRejectedValueOnce(new Error("network down"));
    await mountBuilder();
    await openSection("Projects");
    await selectText("Projects SYN");
    await pressToolbar("Bold");

    await clickRowButton("Projects", "Delete section");
    await settle();

    // Hiding it would be a lie: the row still exists and would return on reload.
    expect(structureOrder()).toEqual(order);
    expect(toastError).toHaveBeenCalledWith("Could not delete the section. It has been restored.");
    await openSection("Projects");
    expect(editorSurface().querySelector("strong")?.textContent).toBe("Projects SYN");
    await advanceAutosave();
    await reload();
    expect(structureOrder()).toEqual(order);
    expect(savedSection("Projects")?.contentHtml).toContain("<strong>Projects SYN</strong>");
  });

  it("keeps formatting and section edits through a failed save and persists them on retry", async () => {
    seedResume([
      personal,
      { id: "summary", type: "custom", label: "Summary", mode: "free", contentHtml: "<p>Retry SYN text</p><p>Second SYN text</p>" },
    ]);
    fakeResumeApi.saveResumeState.mockRejectedValueOnce(new Error("network down"));
    await mountBuilder();
    await openSection("Summary");
    await selectText("Retry SYN text");
    await pressToolbar("Bold");
    await renameSection("Summary", "Profile");
    await advanceAutosave();

    expect(toastError).toHaveBeenCalledWith("Failed to save resume. Please try again.");
    expect(savedSection("Summary")?.contentHtml).toBe("<p>Retry SYN text</p><p>Second SYN text</p>");
    expect(structureOrder()).toEqual(["Personal Information", "Profile"]);
    await openSection("Profile");
    expect(editorSurface().querySelector("strong")?.textContent).toBe("Retry SYN text");

    // Further formatting after the failure is saved together with it.
    await selectText("Second SYN text");
    await pressToolbar("Align right");
    const saveButton = [...document.querySelectorAll("button")].find((b) => b.textContent === "Save")!;
    await act(async () => saveButton.click());
    await settle();

    const saved = parse(savedSection("Profile")!.contentHtml);
    expect(saved.querySelector("strong")?.textContent).toBe("Retry SYN text");
    expect(saved.querySelector<HTMLElement>('p[style*="text-align: right"]')?.textContent).toBe("Second SYN text");
    await reload();
    await openSection("Profile");
    expect(editorSurface().querySelector("strong")?.textContent).toBe("Retry SYN text");
    expect(editorSurface().querySelector<HTMLElement>('p[style*="text-align: right"]')?.textContent).toBe("Second SYN text");
  });
});
