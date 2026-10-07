// Harness for mounting the real resume builder (shell, structure panel, TipTap
// editor, paginated preview and print portal) in jsdom. Only the Supabase-backed
// resume API is replaced, by an in-memory store, so "reload" means remounting
// the builder and reading back exactly what the last successful save wrote.
import React, { act } from "react";
import { vi } from "vitest";
import type { Editor } from "@tiptap/core";
import type { ResumeSectionState, ResumeState, SaveResumePayload } from "@/components/resume-builder/types";
import type { ResumeSettings } from "@/components/resume-builder/settings";
import { mountComponent } from "./dom-helpers";

type StoredResume = { id: string; title: string; settings: ResumeSettings; createdAt: number };
type StoredSection = ResumeSectionState & { resumeId: string };

export const store = {
  resumes: new Map<string, StoredResume>(),
  sections: new Map<string, StoredSection>(),
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function stateOf(resume: StoredResume): ResumeState {
  const sections = [...store.sections.values()]
    .filter((section) => section.resumeId === resume.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => {
      const copy: Partial<StoredSection> = clone(section);
      delete copy.resumeId;
      return copy as ResumeSectionState;
    });
  return { resumeId: resume.id, title: resume.title, template: null, settings: clone(resume.settings), sections };
}

/** Writes a save payload the way the real upsert does (insert or replace by id). */
export function applySave(payload: SaveResumePayload) {
  const resume = store.resumes.get(payload.resumeId);
  if (!resume) throw new Error("Resume not found");
  resume.title = payload.title;
  if (payload.settings) resume.settings = clone(payload.settings);
  for (const section of payload.sections) {
    store.sections.set(section.id, { ...clone(section), resumeId: payload.resumeId });
  }
}

export const fakeResumeApi = {
  loadOrCreateResumeState: vi.fn(async () => {
    const first = [...store.resumes.values()].sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!first) throw new Error("No seeded resume");
    return stateOf(first);
  }),
  saveResumeState: vi.fn(async (payload: SaveResumePayload) => applySave(payload)),
  listResumes: vi.fn(async () => [...store.resumes.values()].map((r) => ({ id: r.id, title: r.title, created_at: "" }))),
  loadResumeById: vi.fn(async (id: string) => {
    const resume = store.resumes.get(id);
    return resume ? stateOf(resume) : null;
  }),
  createResume: vi.fn(async () => {
    throw new Error("createResume is not used by these tests");
  }),
  deleteResume: vi.fn(async () => {
    throw new Error("deleteResume is not used by these tests");
  }),
  deleteSection: vi.fn(async (id: string) => {
    if (!store.sections.delete(id)) throw new Error("Section not found");
  }),
};

export function resetStore() {
  store.resumes.clear();
  store.sections.clear();
  fakeResumeApi.loadOrCreateResumeState.mockClear();
  fakeResumeApi.saveResumeState.mockReset().mockImplementation(async (payload) => applySave(payload));
  fakeResumeApi.listResumes.mockClear();
  fakeResumeApi.loadResumeById.mockClear();
  fakeResumeApi.deleteSection.mockReset().mockImplementation(async (id: string) => {
    if (!store.sections.delete(id)) throw new Error("Section not found");
  });
}

export function seedResume(
  sections: Array<Omit<ResumeSectionState, "sortOrder">>,
  settings: ResumeSettings = { marginPreset: "normal" },
) {
  const resume: StoredResume = { id: "resume-1", title: "Synthetic Resume", settings, createdAt: 1 };
  store.resumes.set(resume.id, resume);
  sections.forEach((section, sortOrder) => {
    store.sections.set(section.id, { ...clone(section), sortOrder, resumeId: resume.id });
  });
}

/** Persisted sections of the seeded resume, in saved order. */
export function savedSections() {
  return stateOf(store.resumes.get("resume-1")!).sections;
}

export function savedSection(label: string) {
  return savedSections().find((section) => section.label === label);
}

// ---------------------------------------------------------------------------
// jsdom layout stand-ins. Pagination measures offsetHeight; with no layout
// engine every block is 20px per word, so page breaks are deterministic.
// ---------------------------------------------------------------------------
export const WORD_PX = 20;
const restorers: Array<() => void> = [];

function override<T extends object>(target: T, key: PropertyKey, descriptor: PropertyDescriptor) {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, ...descriptor });
  restorers.push(() => {
    if (original) Object.defineProperty(target, key, original);
    else delete (target as Record<PropertyKey, unknown>)[key];
  });
}

function rect(top: number, height: number): DOMRect {
  return { top, left: 0, width: 300, height, bottom: top + height, right: 300, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

export function installLayoutStubs() {
  override(HTMLElement.prototype, "offsetHeight", {
    get(this: HTMLElement) {
      if (this.hasAttribute("data-measure-page-body")) return 900;
      if (this.hasAttribute("data-measure-personal-header")) return 100;
      if (this.hasAttribute("data-measure-section-header")) return 40;
      return (this.textContent ?? "").trim().split(/\s+/).filter(Boolean).length * WORD_PX;
    },
  });
  // Sortable rows need distinct positions for keyboard reordering.
  override(Element.prototype, "getBoundingClientRect", {
    value(this: Element) {
      const index = this.parentElement ? [...this.parentElement.children].indexOf(this) : 0;
      return rect(index * 60, 50);
    },
  });
  override(Range.prototype, "getBoundingClientRect", { value: () => rect(0, 0) });
  override(Range.prototype, "getClientRects", { value: () => [] });
  override(Element.prototype, "scrollIntoView", { value: () => {} });
  override(Element.prototype, "hasPointerCapture", { value: () => false });
  override(Element.prototype, "releasePointerCapture", { value: () => {} });
  override(globalThis, "ResizeObserver", {
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  override(window, "scrollBy", { value: () => {} });
  override(window, "confirm", { value: vi.fn(() => true) });
  override(window, "print", { value: vi.fn() });
}

export function restoreLayoutStubs() {
  for (const restore of restorers.splice(0).reverse()) restore();
}

// ---------------------------------------------------------------------------
// Builder interaction helpers
// ---------------------------------------------------------------------------
export async function settle() {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(20);
  });
}

export async function advanceAutosave() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  await settle();
}

export async function mountBuilder() {
  const { default: ResumeBuilderShell } = await import("@/components/resume-builder/ResumeBuilderShell");
  const container = await mountComponent(<ResumeBuilderShell />);
  await settle();
  return container;
}

/** The structure-panel row button that opens a section in the editor. */
export function sectionButton(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === label && !button.getAttribute("aria-label"),
  );
  if (!match) throw new Error(`Section ${label} is not listed`);
  return match;
}

export async function openSection(label: string) {
  await act(async () => sectionButton(label).click());
  await settle();
}

/** Section labels in the order the structure panel lists them. */
export function structureOrder() {
  return [...document.querySelectorAll('button[aria-label^="Reorder "]')].map((handle) =>
    handle.getAttribute("aria-label")!.replace(/^Reorder (.*) section\..*$/, "$1"),
  );
}

/** The live TipTap editor behind the first (desktop) editor surface. */
export function activeEditor(): Editor {
  const surface = document.querySelector<HTMLElement & { editor?: Editor }>(".ProseMirror");
  if (!surface?.editor) throw new Error("Rich-text editor is not mounted");
  return surface.editor;
}

export function editorSurface(): HTMLElement {
  return activeEditor().view.dom as HTMLElement;
}

/** Selects `text` (or from `text` to the end of `through`), like a drag-select. */
export async function selectText(text: string, through = text) {
  const editor = activeEditor();
  let from = -1;
  let to = -1;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    if (from < 0 && node.text.includes(text)) from = pos + node.text.indexOf(text);
    if (from >= 0 && to < 0 && node.text.includes(through)) to = pos + node.text.indexOf(through) + through.length;
  });
  if (from < 0 || to < 0) throw new Error(`"${text}" is not in the editor`);
  await act(async () => {
    editor.commands.setTextSelection({ from, to });
  });
}

/** Types at the current selection through the editor's own input path. */
export async function typeText(text: string) {
  await act(async () => {
    activeEditor().commands.insertContent(text);
  });
}

export async function pressToolbar(label: string) {
  const control = document.querySelector<HTMLButtonElement>(`[role="toolbar"] button[aria-label="${label}"]`);
  if (!control) throw new Error(`Toolbar control ${label} is missing`);
  await act(async () => control.click());
  await settle();
}

/** Picks an option from a toolbar select (font size, line spacing) by keyboard. */
export async function pickToolbarOption(label: string, option: string) {
  const trigger = document.querySelector<HTMLButtonElement>(`[role="toolbar"] button[aria-label="${label}"]`);
  if (!trigger) throw new Error(`Toolbar select ${label} is missing`);
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await settle();
  const choice = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((el) => el.textContent === option);
  if (!choice) throw new Error(`Option ${option} is missing from ${label}`);
  await act(async () => {
    choice.focus();
    choice.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await settle();
}

/** Picks an entry from a toolbar dropdown menu (list style) by keyboard + click. */
export async function pickToolbarMenuItem(label: string, item: RegExp) {
  const trigger = document.querySelector<HTMLButtonElement>(`[role="toolbar"] button[aria-label="${label}"]`);
  if (!trigger) throw new Error(`Toolbar menu ${label} is missing`);
  if (trigger.disabled) throw new Error(`Toolbar menu ${label} is disabled`);
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await settle();
  const entry = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => item.test(el.textContent ?? ""));
  if (!entry) throw new Error(`Menu item ${item} is missing from ${label}`);
  await act(async () => entry.click());
  await settle();
}

export function printRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>("[data-print-resume]");
  if (!root) throw new Error("Print container is not mounted");
  return root;
}

/** Text of each printed page, whitespace-normalised. */
export function printedPages() {
  return [...printRoot().querySelectorAll(".resume-print-page")].map((page) =>
    (page.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

export function words(prefix: string, count: number) {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`).join(" ");
}
