// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadOrCreateResumeState: vi.fn(),
  saveResumeState: vi.fn(),
  listResumes: vi.fn(),
  loadResumeById: vi.fn(),
  createResume: vi.fn(),
  deleteResume: vi.fn(),
  deleteSection: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/components/resume-builder/api", () => ({
  loadOrCreateResumeState: mocks.loadOrCreateResumeState,
  saveResumeState: mocks.saveResumeState,
  listResumes: mocks.listResumes,
  loadResumeById: mocks.loadResumeById,
  createResume: mocks.createResume,
  deleteResume: mocks.deleteResume,
  deleteSection: mocks.deleteSection,
}));
vi.mock("@/components/resume-builder/defaultSections", () => ({ getDefaultSections: () => [] }));
vi.mock("@/components/resume-builder/DocumentStructurePanel", () => ({
  default: ({ sections, activeSectionId, onSelect }: {
    sections: Array<{ id: string; label: string }>;
    activeSectionId: string;
    onSelect: (id: string) => void;
  }) => <nav>{sections.map((section) => <button key={section.id} aria-pressed={section.id === activeSectionId} onClick={() => onSelect(section.id)}>{section.label}</button>)}</nav>,
}));
vi.mock("@/components/resume-builder/SectionEditorPanel", () => ({
  default: ({ section, onChange }: {
    section?: { contentHtml: string };
    onChange: (patch: { contentHtml: string }) => void;
  }) => section ? <textarea aria-label="Resume content" value={section.contentHtml} onChange={(event) => onChange({ contentHtml: event.target.value })} /> : null,
}));
vi.mock("@/components/resume-builder/ResumePreviewPanel", () => ({
  default: () => null,
  ResumePage: () => null,
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: React.PropsWithChildren<{ value?: string; onValueChange?: (value: string) => void }>) => <select aria-label="Resume selector" value={value ?? ""} onChange={(event) => onValueChange?.(event.target.value)}>{children}</select>,
  SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectItem: ({ value, children }: React.PropsWithChildren<{ value: string }>) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: React.PropsWithChildren) => <>{children}</>,
  PointerSensor: {}, KeyboardSensor: {}, closestCenter: vi.fn(),
  useSensor: vi.fn(), useSensors: vi.fn(() => []),
}));
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: React.PropsWithChildren) => <>{children}</>,
  verticalListSortingStrategy: {}, sortableKeyboardCoordinates: vi.fn(), arrayMove: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import ResumeBuilderShell from "@/components/resume-builder/ResumeBuilderShell";

const sectionA = { id: "section-a", type: "custom" as const, label: "Summary A", mode: "free" as const, contentHtml: "starting A", sortOrder: 0 };
const sectionB = { id: "section-b", type: "custom" as const, label: "Summary B", mode: "free" as const, contentHtml: "starting B", sortOrder: 0 };
const resumeA = { resumeId: "resume-a", title: "Resume A", template: null, settings: { marginPreset: "normal" as const }, sections: [sectionA] };
const resumeB = { resumeId: "resume-b", title: "Resume B", template: null, settings: { marginPreset: "normal" as const }, sections: [sectionB] };
const roots: Root[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function mountShell() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<ResumeBuilderShell />));
  await settleEffects();
  return root;
}

async function settleEffects() {
  await act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });
}

function editor(): HTMLTextAreaElement {
  const field = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Resume content"]');
  if (!field) throw new Error("Resume editor was not rendered");
  return field;
}

function typeResumeContent(value: string) {
  const field = editor();
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  });
}

async function advanceAutosave() {
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
}

function switchResume(id: string) {
  const selector = document.querySelector<HTMLSelectElement>('select[aria-label="Resume selector"]');
  if (!selector) throw new Error("Resume selector not rendered");
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  act(() => {
    setter?.call(selector, id);
    selector.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("ResumeBuilderShell autosave durability", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.loadOrCreateResumeState.mockReset().mockResolvedValue(resumeA);
    mocks.saveResumeState.mockReset().mockResolvedValue(undefined);
    mocks.listResumes.mockReset().mockResolvedValue([
      { id: "resume-a", title: "Resume A" },
      { id: "resume-b", title: "Resume B" },
    ]);
    mocks.loadResumeById.mockReset().mockResolvedValue(resumeB);
    mocks.createResume.mockReset();
    mocks.deleteResume.mockReset();
    mocks.deleteSection.mockReset();
    mocks.toastError.mockReset();
  });

  afterEach(() => {
    act(() => { for (const root of roots.splice(0)) root.unmount(); });
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("autosaves the latest section payload after the debounce", async () => {
    await mountShell();
    typeResumeContent("latest text");
    await advanceAutosave();

    const saved = mocks.saveResumeState.mock.calls.at(-1)?.[0];
    expect(saved.resumeId).toBe("resume-a");
    expect(saved.sections[0].contentHtml).toBe("latest text");
  });

  it("does not let an older pending autosave overwrite edits typed while it is pending", async () => {
    const writes: Array<{ content: string; finish: () => void }> = [];
    let persisted = "starting A";
    mocks.saveResumeState.mockImplementation((payload: { sections: Array<{ contentHtml: string }> }) => {
      const pending = deferred<void>();
      writes.push({ content: payload.sections[0].contentHtml, finish: () => pending.resolve() });
      return pending.promise.then(() => { persisted = payload.sections[0].contentHtml; });
    });
    await mountShell();

    typeResumeContent("first payload");
    await advanceAutosave();
    expect(writes).toHaveLength(1);

    typeResumeContent("latest payload");
    await advanceAutosave();
    expect(writes).toHaveLength(1);

    await act(async () => writes[0].finish());
    await settleEffects();
    expect(writes).toHaveLength(2);
    expect(writes[1].content).toBe("latest payload");
    await act(async () => writes[1].finish());

    expect(persisted).toBe("latest payload");
  });

  it("retains edited content after a save failure and can retry manually", async () => {
    mocks.saveResumeState.mockRejectedValueOnce(new Error("write failed")).mockResolvedValueOnce(undefined);
    await mountShell();
    typeResumeContent("retryable content");
    await advanceAutosave();
    await settleEffects();

    expect(editor().value).toBe("retryable content");
    expect(mocks.toastError).toHaveBeenCalledWith("Failed to save resume. Please try again.");
    const saveButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Save");
    if (!saveButton) throw new Error("Save button missing");
    await act(async () => saveButton.click());
    expect(mocks.saveResumeState).toHaveBeenCalledTimes(2);
    expect(mocks.saveResumeState.mock.calls[1][0].sections[0].contentHtml).toBe("retryable content");
  });

  it("flushes unsaved outgoing content before switching resumes", async () => {
    const flush = deferred<void>();
    mocks.saveResumeState.mockReturnValue(flush.promise);
    await mountShell();
    typeResumeContent("outgoing edit");
    switchResume("resume-b");
    await settleEffects();

    expect(mocks.saveResumeState).toHaveBeenCalledTimes(1);
    expect(mocks.saveResumeState.mock.calls[0][0].resumeId).toBe("resume-a");
    expect(mocks.saveResumeState.mock.calls[0][0].sections[0].contentHtml).toBe("outgoing edit");
    expect(editor().value).toBe("outgoing edit");

    await act(async () => flush.resolve());
    await settleEffects();
    expect(editor().value).toBe("starting B");
    expect(mocks.loadResumeById).toHaveBeenCalledWith("resume-b");
  });

  it("does not persist an unchanged resume on manual save or unmount", async () => {
    const root = await mountShell();
    const saveButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Save");
    if (!saveButton) throw new Error("Save button missing");
    await act(async () => saveButton.click());
    expect(mocks.saveResumeState).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    await settleEffects();
    expect(mocks.saveResumeState).not.toHaveBeenCalled();
  });

  it("waits for an older queued write and then saves a return-to-baseline edit before switching", async () => {
    const writes: Array<{ content: string; finish: () => void }> = [];
    mocks.saveResumeState.mockImplementation((payload: { sections: Array<{ contentHtml: string }> }) => {
      const pending = deferred<void>();
      writes.push({ content: payload.sections[0].contentHtml, finish: () => pending.resolve() });
      return pending.promise;
    });
    await mountShell();
    typeResumeContent("intermediate content");
    await advanceAutosave();
    expect(writes).toHaveLength(1);

    typeResumeContent("starting A");
    switchResume("resume-b");
    await settleEffects();
    await act(async () => writes[0].finish());
    await settleEffects();

    expect(writes).toHaveLength(2);
    expect(writes[1].content).toBe("starting A");
    expect(mocks.loadResumeById).not.toHaveBeenCalled();
    await act(async () => writes[1].finish());
    await settleEffects();
    expect(mocks.loadResumeById).toHaveBeenCalledWith("resume-b");
  });

  it("drains typing made while the outgoing resume flush is pending before switching", async () => {
    const writes: Array<{ content: string; finish: () => void }> = [];
    mocks.saveResumeState.mockImplementation((payload: { sections: Array<{ contentHtml: string }> }) => {
      const pending = deferred<void>();
      writes.push({ content: payload.sections[0].contentHtml, finish: () => pending.resolve() });
      return pending.promise;
    });
    await mountShell();
    typeResumeContent("first outgoing edit");
    switchResume("resume-b");
    await settleEffects();
    expect(writes).toHaveLength(1);

    typeResumeContent("latest outgoing edit");
    await act(async () => writes[0].finish());
    await settleEffects();

    expect(writes).toHaveLength(2);
    expect(writes[1].content).toBe("latest outgoing edit");
    expect(mocks.loadResumeById).not.toHaveBeenCalled();
    await act(async () => writes[1].finish());
    await settleEffects();
    expect(editor().value).toBe("starting B");
    expect(mocks.loadResumeById).toHaveBeenCalledWith("resume-b");
  });

  it("keeps the outgoing resume selected after a failed required flush and allows retry", async () => {
    mocks.saveResumeState.mockRejectedValueOnce(new Error("write failed")).mockResolvedValueOnce(undefined);
    await mountShell();
    typeResumeContent("unsaved but recoverable");
    switchResume("resume-b");
    await settleEffects();

    expect(mocks.loadResumeById).not.toHaveBeenCalled();
    expect(editor().value).toBe("unsaved but recoverable");
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Resume selector"]')?.value).toBe("resume-a");

    const saveButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Save");
    if (!saveButton) throw new Error("Save button missing");
    await act(async () => saveButton.click());
    expect(mocks.saveResumeState).toHaveBeenCalledTimes(2);
    expect(mocks.saveResumeState.mock.calls[1][0].sections[0].contentHtml).toBe("unsaved but recoverable");
  });

  it("warns before unload after a failed flush leaves dirty content", async () => {
    mocks.saveResumeState.mockRejectedValue(new Error("write failed"));
    await mountShell();
    typeResumeContent("dirty after failed save");
    switchResume("resume-b");
    await settleEffects();

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("locks duplicate resume switches and makes the editor inert while the new resume loads", async () => {
    const loading = deferred<typeof resumeB>();
    mocks.loadResumeById.mockReturnValue(loading.promise);
    await mountShell();

    const selector = document.querySelector<HTMLSelectElement>('select[aria-label="Resume selector"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    act(() => {
      setter?.call(selector, "resume-b");
      selector.dispatchEvent(new Event("change", { bubbles: true }));
      setter?.call(selector, "resume-b");
      selector.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await settleEffects();

    expect(mocks.loadResumeById).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[aria-busy="true"][inert]')).not.toBeNull();
    typeResumeContent("typed during replacement");
    await act(async () => loading.resolve(resumeB));
    await settleEffects();
    expect(editor().value).toBe("starting B");
  });

  it("locks duplicate new-resume requests and makes the editor inert while creation is pending", async () => {
    const creating = deferred<typeof resumeB>();
    mocks.createResume.mockReturnValue(creating.promise);
    await mountShell();

    const newButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("New resume"));
    if (!newButton) throw new Error("New resume button missing");
    await act(async () => {
      newButton.click();
      newButton.click();
    });
    await settleEffects();

    expect(mocks.createResume).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[aria-busy="true"][inert]')).not.toBeNull();
    await act(async () => creating.resolve({ ...resumeB, sections: [] }));
    await settleEffects();
  });

  it("waits for an in-flight save before deleting the current resume and then loads the replacement without saving the deleted id", async () => {
    const pending = deferred<void>();
    const operations: string[] = [];
    mocks.saveResumeState.mockImplementation((payload: { resumeId: string }) => {
      operations.push(`save:${payload.resumeId}:start`);
      return pending.promise.then(() => { operations.push(`save:${payload.resumeId}:finish`); });
    });
    mocks.deleteResume.mockImplementation(async (id: string) => { operations.push(`delete:${id}`); });
    await mountShell();

    typeResumeContent("latest content before delete");
    await advanceAutosave();
    expect(operations).toEqual(["save:resume-a:start"]);
    const deleteButton = document.querySelector<HTMLButtonElement>('button[aria-label="Delete resume"]');
    if (!deleteButton) throw new Error("Delete resume button missing");
    await act(async () => deleteButton.click());
    const confirmation = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Delete");
    if (!confirmation) throw new Error("Delete confirmation missing");
    await act(async () => confirmation.click());
    await settleEffects();

    expect(operations).toEqual(["save:resume-a:start"]);
    await act(async () => pending.resolve());
    await settleEffects();

    expect(operations).toEqual(["save:resume-a:start", "save:resume-a:finish", "delete:resume-a"]);
    expect(mocks.loadResumeById).toHaveBeenCalledWith("resume-b");
    expect(editor().value).toBe("starting B");
    expect(mocks.saveResumeState.mock.calls.every(([payload]) => payload.resumeId !== "resume-a" || payload.sections[0].contentHtml === "latest content before delete")).toBe(true);
  });

  it("creates a replacement before deleting the last resume and never saves against the deleted id", async () => {
    const operations: string[] = [];
    mocks.listResumes.mockResolvedValue([{ id: "resume-a", title: "Resume A" }]);
    mocks.createResume.mockImplementation(async () => {
      operations.push("create:replacement");
      return { ...resumeB, sections: [] };
    });
    mocks.deleteResume.mockImplementation(async (id: string) => { operations.push(`delete:${id}`); });
    mocks.saveResumeState.mockImplementation(async (payload: { resumeId: string }) => { operations.push(`save:${payload.resumeId}`); });
    await mountShell();

    typeResumeContent("last resume edits");
    const deleteButton = document.querySelector<HTMLButtonElement>('button[aria-label="Delete resume"]');
    if (!deleteButton) throw new Error("Delete resume button missing");
    await act(async () => deleteButton.click());
    const confirmation = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Delete");
    if (!confirmation) throw new Error("Delete confirmation missing");
    await act(async () => confirmation.click());
    await settleEffects();

    expect(operations[0]).toBe("save:resume-a");
    expect(operations).toContain("create:replacement");
    expect(operations.indexOf("create:replacement")).toBeLessThan(operations.indexOf("delete:resume-a"));
    expect(operations.slice(operations.indexOf("delete:resume-a") + 1)).not.toContain("save:resume-a");
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Resume selector"]')?.value).toBe("resume-b");
  });

  it("keeps the edited current resume selected when deletion fails", async () => {
    mocks.deleteResume.mockRejectedValueOnce(new Error("delete failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await mountShell();
    typeResumeContent("recoverable delete failure content");
    const deleteButton = document.querySelector<HTMLButtonElement>('button[aria-label="Delete resume"]');
    if (!deleteButton) throw new Error("Delete resume button missing");
    await act(async () => deleteButton.click());
    const confirmation = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Delete");
    if (!confirmation) throw new Error("Delete confirmation missing");
    await act(async () => confirmation.click());
    await settleEffects();

    expect(editor().value).toBe("recoverable delete failure content");
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Resume selector"]')?.value).toBe("resume-a");
    expect(mocks.toastError).toHaveBeenCalledWith("Could not delete resume. Please try again.");
    expect(mocks.loadResumeById).toHaveBeenCalledWith("resume-b");

    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(false);
    const saveButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Save");
    if (!saveButton) throw new Error("Save button missing");
    await act(async () => saveButton.click());
    expect(mocks.saveResumeState).toHaveBeenCalledTimes(1);

    const retry = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Delete");
    if (!retry) throw new Error("Delete retry missing");
    await act(async () => retry.click());
    await settleEffects();
    expect(document.querySelector<HTMLSelectElement>('select[aria-label="Resume selector"]')?.value).toBe("resume-b");
    expect(editor().value).toBe("starting B");
    consoleError.mockRestore();
  });
});
