// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EssaysShell from "@/components/essays/EssaysShell";
import type { EssayDraft, EssayPrompt } from "@/components/essays/api";

const mocks = vi.hoisted(() => ({
  fetchDraftsForPrompt: vi.fn(),
  updateDraft: vi.fn(),
  createDraft: vi.fn(),
  createCustomPrompt: vi.fn(),
  fetchCustomPrompts: vi.fn(),
  deleteCustomPrompt: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
const mountedRoots: Root[] = [];

vi.mock("@/components/essays/api", () => ({
  fetchEssayPrompts: vi.fn(),
  fetchDraftsForPrompt: mocks.fetchDraftsForPrompt,
  updateDraft: mocks.updateDraft,
  createDraft: mocks.createDraft,
  deleteDraft: vi.fn(),
  setCurrentDraft: vi.fn().mockResolvedValue(undefined),
  fetchCustomPrompts: mocks.fetchCustomPrompts,
  createCustomPrompt: mocks.createCustomPrompt,
  deleteCustomPrompt: mocks.deleteCustomPrompt,
  renameCustomPrompt: vi.fn(),
}));

vi.mock("@/lib/my-schools", () => ({ fetchMySchools: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("lucide-react", () => {
  const Icon = () => null;
  return { Check: Icon, ChevronDown: Icon, ChevronRight: Icon, FileText: Icon, Lightbulb: Icon, Pencil: Icon, Plus: Icon, Save: Icon, Trash2: Icon, X: Icon };
});

vi.mock("@/components/ui/card", () => {
  const Wrapper = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>;
  return { Card: Wrapper, CardContent: Wrapper, CardDescription: Wrapper, CardHeader: Wrapper, CardTitle: Wrapper };
});
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => <button {...props}>{children}</button>,
}));
vi.mock("@/components/ui/textarea", () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/separator", () => ({ Separator: () => <hr /> }));
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CollapsibleContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

const prompt: EssayPrompt = {
  id: "prompt-1", slug: "prompt-1", title: "Prompt 1", description: null,
  tips: null, sort_order: 1, scope: "shared",
};

const draft = (id: string, label: string, content: string, isCurrent = false): EssayDraft => ({
  id,
  user_id: "user-1",
  prompt_id: prompt.id,
  prompt_slug: prompt.slug,
  label,
  content,
  is_current: isCurrent,
  school_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

async function settleEffects() {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
}

function buttonNamed(name: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(name));
  if (!button) throw new Error(`Button not found: ${name}`);
  return button;
}

function draftRowButton(label: string): HTMLButtonElement {
  const matches = [...document.querySelectorAll("button")].filter((item) => item.textContent?.includes(label));
  const button = matches.at(-1);
  if (!button) throw new Error(`Draft row button not found: ${label}`);
  return button;
}

function editorElement(): HTMLTextAreaElement {
  const editor = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Start writing your essay here."]');
  if (!editor) throw new Error("Essay editor not found");
  return editor;
}

function editEssay(editor: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  act(() => {
    setter?.call(editor, value);
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  });
}

function editInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  });
}

async function mountEditor(drafts: EssayDraft[], prompts: EssayPrompt[] = [prompt]): Promise<Root> {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.fetchDraftsForPrompt.mockImplementation(async (promptId: string) => drafts.filter((item) => item.prompt_id === promptId));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<EssaysShell initialPrompts={prompts} />); });
  mountedRoots.push(root);
  await settleEffects();
  expect(mocks.fetchDraftsForPrompt).toHaveBeenCalledWith(prompts[0].id);
  return root;
}

async function unmountEditor(root: Root) {
  await act(async () => { root.unmount(); });
  const index = mountedRoots.indexOf(root);
  if (index >= 0) mountedRoots.splice(index, 1);
}

type PendingWrite = { draftId: string; content: string; resolve: () => void; reject: (error: Error) => void };

function controlledPersistence(seed: EssayDraft[]) {
  const persisted = new Map(seed.map((item) => [item.id, item.content]));
  const writes: PendingWrite[] = [];
  let activeWrites = 0;
  let maxActiveWrites = 0;
  mocks.updateDraft.mockImplementation((draftId: string, patch: { content?: string }) => {
    if (patch.content === undefined) return Promise.resolve();
    activeWrites += 1;
    maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
    return new Promise<void>((resolve, reject) => {
      writes.push({
        draftId,
        content: patch.content!,
        resolve: () => { persisted.set(draftId, patch.content!); activeWrites -= 1; resolve(); },
        reject: (error) => { activeWrites -= 1; reject(error); },
      });
    });
  });
  return { persisted, writes, get maxActiveWrites() { return maxActiveWrites; } };
}

describe("essay draft autosave coordination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createDraft.mockResolvedValue(draft("draft-new", "Draft 2", ""));
    mocks.fetchCustomPrompts.mockResolvedValue([]);
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    act(() => { for (const root of mountedRoots.splice(0)) root.unmount(); });
    document.body.innerHTML = "";
  });

  it("waits for an older save before flushing the latest outgoing draft content", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const other = draft("draft-b", "Draft B", "Original B");
    const persistence = controlledPersistence([outgoing, other]);
    const root = await mountEditor([outgoing, other]);

    const editor = editorElement();
    editEssay(editor, "Earlier A edit");
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);

    editEssay(editorElement(), "Latest A edit");
    await act(async () => { buttonNamed("Draft B").click(); });
    editEssay(editorElement(), "Final A edit");

    // Resolve in the harmful order if the flush starts a concurrent write.
    await settleEffects();
    if (persistence.writes.length > 1) {
      await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
      await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    } else {
      await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
      await settleEffects();
      expect(persistence.writes).toHaveLength(2);
      await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
      await settleEffects();
      expect(persistence.writes).toHaveLength(3);
      await act(async () => { persistence.writes[2].resolve(); await Promise.resolve(); });
    }

    expect(persistence.persisted.get("draft-a")).toBe("Final A edit");
    expect(persistence.persisted.get("draft-b")).toBe("Original B");
    expect(persistence.maxActiveWrites).toBe(1);
    expect(editorElement().value).toBe("Original B");
    await unmountEditor(root);
  });

  it("saves the latest same-draft edit when autosave fires during an earlier write", async () => {
    vi.useFakeTimers();
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const persistence = controlledPersistence([outgoing]);
    const root = await mountEditor([outgoing]);

    editEssay(editorElement(), "First autosave edit");
    await act(async () => { vi.advanceTimersByTime(2000); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    expect(persistence.writes[0].content).toBe("First autosave edit");

    editEssay(editorElement(), "Latest autosave edit");
    await act(async () => { vi.advanceTimersByTime(2000); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);

    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    expect(persistence.writes[1].content).toBe("Latest autosave edit");
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });

    expect(persistence.persisted.get("draft-a")).toBe("Latest autosave edit");
    expect(persistence.maxActiveWrites).toBe(1);
    await unmountEditor(root);
  });

  it("flushes outgoing content before creating and selecting a new draft", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const persistence = controlledPersistence([outgoing]);
    const root = await mountEditor([outgoing]);

    editEssay(editorElement(), "Save before create");
    await act(async () => { buttonNamed("New draft").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    expect(mocks.createDraft).not.toHaveBeenCalled();

    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.persisted.get("draft-a")).toBe("Save before create");
    expect(mocks.createDraft).toHaveBeenCalledTimes(1);
    expect(editorElement().value).toBe("");
    await unmountEditor(root);
  });

  it("does not create a new draft when the required outgoing flush fails", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const persistence = controlledPersistence([outgoing]);
    const root = await mountEditor([outgoing]);

    editEssay(editorElement(), "Retry before create");
    await act(async () => { buttonNamed("New draft").click(); });
    await settleEffects();
    await act(async () => { persistence.writes[0].reject(new Error("offline")); await Promise.resolve(); });

    expect(mocks.createDraft).not.toHaveBeenCalled();
    expect(editorElement().value).toBe("Retry before create");
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
    expect(persistence.persisted.get("draft-a")).toBe("Retry before create");
    await unmountEditor(root);
  });

  it("prevents editing the outgoing draft while new-draft creation is pending", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const other = draft("draft-b", "Draft B", "Original B");
    const secondPrompt: EssayPrompt = { ...prompt, id: "prompt-2", slug: "prompt-2", title: "Prompt 2" };
    const created = draft("draft-new", "Draft 2", "");
    const persistence = controlledPersistence([outgoing, other]);
    let finishCreate!: (createdDraft: EssayDraft) => void;
    mocks.createDraft.mockImplementation(() => new Promise<EssayDraft>((resolve) => { finishCreate = resolve; }));
    const root = await mountEditor([outgoing, other], [prompt, secondPrompt]);

    editEssay(editorElement(), "Save before create");
    await act(async () => { buttonNamed("New draft").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    await settleEffects();
    expect(mocks.createDraft).toHaveBeenCalledTimes(1);
    expect(editorElement().disabled).toBe(true);
    expect(buttonNamed("Prompt 2").disabled).toBe(true);
    expect(buttonNamed("Draft B").disabled).toBe(true);

    await act(async () => { finishCreate(created); await Promise.resolve(); });
    await settleEffects();
    expect(editorElement().disabled).toBe(false);
    expect(editorElement().value).toBe("");
    expect(persistence.persisted.get("draft-a")).toBe("Save before create");
    await unmountEditor(root);
  });

  it("does not create a custom prompt if the outgoing essay cannot be flushed", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const persistence = controlledPersistence([outgoing]);
    const root = await mountEditor([outgoing]);

    editEssay(editorElement(), "Keep before custom prompt");
    await act(async () => { document.querySelector<HTMLButtonElement>('button[aria-label="Add custom essay"]')?.click(); });
    const titleInput = document.querySelector<HTMLInputElement>('input[placeholder="Essay title…"]');
    if (!titleInput) throw new Error("Custom essay title input not found");
    editInput(titleInput, "My essay");
    await act(async () => { document.querySelector<HTMLButtonElement>('button[aria-label="Confirm"]')?.click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    await act(async () => { persistence.writes[0].reject(new Error("offline")); await Promise.resolve(); });
    await settleEffects();

    expect(mocks.createCustomPrompt).not.toHaveBeenCalled();
    expect(editorElement().value).toBe("Keep before custom prompt");
    expect(titleInput.value).toBe("My essay");
    await unmountEditor(root);
  });

  it("retries the latest same-draft content when an earlier autosave fails", async () => {
    vi.useFakeTimers();
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const persistence = controlledPersistence([outgoing]);
    const root = await mountEditor([outgoing]);

    editEssay(editorElement(), "First failing edit");
    await act(async () => { vi.advanceTimersByTime(2000); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);

    editEssay(editorElement(), "Latest retry edit");
    await act(async () => { vi.advanceTimersByTime(2000); });
    await settleEffects();
    await act(async () => { persistence.writes[0].reject(new Error("temporary failure")); await Promise.resolve(); });
    await settleEffects();

    expect(persistence.writes).toHaveLength(2);
    expect(persistence.writes[1].content).toBe("Latest retry edit");
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
    expect(persistence.persisted.get("draft-a")).toBe("Latest retry edit");
    await unmountEditor(root);
  });

  it("recovers the queued switch flush after an earlier save fails", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const other = draft("draft-b", "Draft B", "Original B");
    const persistence = controlledPersistence([outgoing, other]);
    const root = await mountEditor([outgoing, other]);

    editEssay(editorElement(), "Earlier failed write");
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    editEssay(editorElement(), "Latest queued write");
    await act(async () => { buttonNamed("Draft B").click(); });
    await settleEffects();

    await act(async () => { persistence.writes[0].reject(new Error("temporary failure")); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    expect(persistence.writes[1].content).toBe("Latest queued write");
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
    await settleEffects();

    expect(persistence.persisted.get("draft-a")).toBe("Latest queued write");
    expect(persistence.persisted.get("draft-b")).toBe("Original B");
    expect(editorElement().value).toBe("Original B");
    await unmountEditor(root);
  });

  it("preserves an intentional A/B/A edit sequence across queued flushes", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const other = draft("draft-b", "Draft B", "Original B");
    const persistence = controlledPersistence([outgoing, other]);
    const root = await mountEditor([outgoing, other]);

    editEssay(editorElement(), "Version A");
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes.map((write) => write.content)).toEqual(["Version A"]);

    editEssay(editorElement(), "Version B");
    await act(async () => { buttonNamed("Draft B").click(); });
    editEssay(editorElement(), "Version A");
    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.writes.map((write) => write.content)).toEqual(["Version A", "Version B"]);
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.writes.map((write) => write.content)).toEqual(["Version A", "Version B", "Version A"]);
    await act(async () => { persistence.writes[2].resolve(); await Promise.resolve(); });
    await settleEffects();

    expect(persistence.persisted.get("draft-a")).toBe("Version A");
    expect(persistence.persisted.get("draft-b")).toBe("Original B");
    expect(editorElement().value).toBe("Original B");
    await unmountEditor(root);
  });

  it("keeps latest content when the active draft row is clicked during a save", async () => {
    vi.useFakeTimers();
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const other = draft("draft-b", "Draft B", "Original B");
    const persistence = controlledPersistence([outgoing, other]);
    const root = await mountEditor([outgoing, other]);

    editEssay(editorElement(), "Earlier same-draft revision");
    await act(async () => { vi.advanceTimersByTime(2000); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);

    editEssay(editorElement(), "Latest same-draft revision");
    await act(async () => { vi.advanceTimersByTime(2000); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    await act(async () => { draftRowButton("Draft A").click(); });
    await settleEffects();
    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    expect(persistence.writes[1].content).toBe("Latest same-draft revision");
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
    await settleEffects();

    expect(persistence.persisted.get("draft-a")).toBe("Latest same-draft revision");
    expect(editorElement().value).toBe("Latest same-draft revision");
    await unmountEditor(root);
  });

  it("waits for the latest outgoing content before switching prompts", async () => {
    const secondPrompt: EssayPrompt = { ...prompt, id: "prompt-2", slug: "prompt-2", title: "Prompt 2" };
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const incoming = { ...draft("draft-c", "Draft C", "Prompt 2 response", true), prompt_id: secondPrompt.id, prompt_slug: secondPrompt.slug };
    const persistence = controlledPersistence([outgoing, incoming]);
    const root = await mountEditor([outgoing, incoming], [prompt, secondPrompt]);

    editEssay(editorElement(), "First prompt 1 edit");
    await act(async () => { buttonNamed("Prompt 2").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    expect([...document.querySelectorAll("button")].some((item) => item.textContent?.includes("Saving…"))).toBe(true);
    editEssay(editorElement(), "Latest prompt 1 edit");
    expect(editorElement().value).toBe("Latest prompt 1 edit");

    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    expect(persistence.writes[1].content).toBe("Latest prompt 1 edit");
    expect(editorElement().value).toBe("Latest prompt 1 edit");
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
    await settleEffects();

    expect(persistence.persisted.get("draft-a")).toBe("Latest prompt 1 edit");
    expect(persistence.persisted.get("draft-c")).toBe("Prompt 2 response");
    expect(editorElement().value).toBe("Prompt 2 response");
    await unmountEditor(root);
  });

  it("keeps the outgoing prompt selected and editable when its flush fails", async () => {
    const secondPrompt: EssayPrompt = { ...prompt, id: "prompt-2", slug: "prompt-2", title: "Prompt 2" };
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const incoming = { ...draft("draft-c", "Draft C", "Prompt 2 response", true), prompt_id: secondPrompt.id, prompt_slug: secondPrompt.slug };
    const persistence = controlledPersistence([outgoing, incoming]);
    const root = await mountEditor([outgoing, incoming], [prompt, secondPrompt]);

    editEssay(editorElement(), "Unsaved prompt 1 response");
    await act(async () => { buttonNamed("Prompt 2").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    await act(async () => { persistence.writes[0].reject(new Error("offline")); await Promise.resolve(); });
    await settleEffects();

    expect(editorElement().value).toBe("Unsaved prompt 1 response");
    expect(persistence.persisted.get("draft-a")).toBe("Original A");
    expect(persistence.persisted.get("draft-c")).toBe("Prompt 2 response");
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    await act(async () => { persistence.writes[1].resolve(); await Promise.resolve(); });
    expect(persistence.persisted.get("draft-a")).toBe("Unsaved prompt 1 response");
    await unmountEditor(root);
  });

  it("does not write unchanged draft content when Save is clicked", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const persistence = controlledPersistence([outgoing]);
    const root = await mountEditor([outgoing]);

    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();

    expect(persistence.writes).toHaveLength(0);
    expect(mocks.updateDraft).not.toHaveBeenCalled();
    await unmountEditor(root);
  });

  it("flushes pending edits on client-side unmount", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const persistence = controlledPersistence([outgoing]);
    const root = await mountEditor([outgoing]);

    editEssay(editorElement(), "Unmounted pending edit");
    await unmountEditor(root);
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    expect(persistence.writes[0].content).toBe("Unmounted pending edit");
    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    expect(persistence.persisted.get("draft-a")).toBe("Unmounted pending edit");
  });

  it("keeps the outgoing draft selected and editable when a required flush fails", async () => {
    const outgoing = draft("draft-a", "Draft A", "Original A", true);
    const other = draft("draft-b", "Draft B", "Original B");
    const failure = new Error("offline");
    const persistence = controlledPersistence([outgoing, other]);
    const root = await mountEditor([outgoing, other]);

    editEssay(editorElement(), "Retry this edit");
    await act(async () => { buttonNamed("Draft B").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);
    expect(persistence.writes).toHaveLength(1);
    await act(async () => { persistence.writes[0].reject(failure); await Promise.resolve(); });
    await settleEffects();

    const dirtyBeforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyBeforeUnload);
    expect(dirtyBeforeUnload.defaultPrevented).toBe(true);
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    await act(async () => { persistence.writes[1].reject(failure); await Promise.resolve(); });
    await settleEffects();

    expect(editorElement().value).toBe("Retry this edit");
    expect([...document.querySelectorAll("button")].some((item) => ["Save", "Saving…"].includes(item.textContent?.trim() ?? ""))).toBe(true);
    expect(persistence.persisted.get("draft-a")).toBe("Original A");
    expect(persistence.persisted.get("draft-b")).toBe("Original B");
    expect(mocks.updateDraft).toHaveBeenCalledTimes(2);
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(3);
    await act(async () => { persistence.writes[2].resolve(); await Promise.resolve(); });
    expect(persistence.persisted.get("draft-a")).toBe("Retry this edit");
    const cleanBeforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanBeforeUnload);
    expect(cleanBeforeUnload.defaultPrevented).toBe(false);
    await unmountEditor(root);
  });

  it("waits for the active custom draft save before deleting its prompt", async () => {
    const customPrompt = {
      id: "custom-prompt-1",
      user_id: "user-1",
      title: "Custom essay",
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const customDraft = {
      ...draft("custom-draft-1", "Custom draft", "Original custom response", true),
      prompt_id: customPrompt.id,
      prompt_slug: customPrompt.id,
    };
    const persistence = controlledPersistence([customDraft]);
    mocks.fetchCustomPrompts.mockResolvedValue([customPrompt]);
    mocks.deleteCustomPrompt.mockResolvedValue(undefined);
    const root = await mountEditor([customDraft]);

    await act(async () => { buttonNamed("Custom essay").click(); });
    await settleEffects();
    editEssay(editorElement(), "Latest custom response");
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(1);

    const promptRow = [...document.querySelectorAll("div.group")].find((row) => row.textContent?.includes("Custom essay"));
    const deleteToggle = promptRow?.querySelector<HTMLButtonElement>('button[aria-label="Delete"]');
    if (!promptRow || !deleteToggle) throw new Error("Custom essay delete control missing");
    await act(async () => deleteToggle.click());
    const confirmDelete = [...promptRow.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Delete");
    if (!confirmDelete) throw new Error("Custom essay delete confirmation missing");
    await act(async () => confirmDelete.click());
    await settleEffects();

    expect(mocks.deleteCustomPrompt).not.toHaveBeenCalled();
    expect(editorElement().disabled).toBe(true);
    expect(persistence.writes).toHaveLength(1);
    await act(async () => { persistence.writes[0].resolve(); await Promise.resolve(); });
    await settleEffects();

    expect(persistence.persisted.get("custom-draft-1")).toBe("Latest custom response");
    expect(mocks.deleteCustomPrompt).toHaveBeenCalledWith("custom-prompt-1");
    await unmountEditor(root);
  });
});
