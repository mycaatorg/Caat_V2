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
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
const mountedRoots: Root[] = [];

vi.mock("@/components/essays/api", () => ({
  fetchEssayPrompts: vi.fn(),
  fetchDraftsForPrompt: mocks.fetchDraftsForPrompt,
  updateDraft: mocks.updateDraft,
  createDraft: vi.fn(),
  deleteDraft: vi.fn(),
  setCurrentDraft: vi.fn().mockResolvedValue(undefined),
  fetchCustomPrompts: vi.fn().mockResolvedValue([]),
  createCustomPrompt: vi.fn(),
  deleteCustomPrompt: vi.fn(),
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

async function mountEditor(drafts: EssayDraft[]): Promise<Root> {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mocks.fetchDraftsForPrompt.mockResolvedValue(drafts);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<EssaysShell initialPrompts={[prompt]} />); });
  mountedRoots.push(root);
  await settleEffects();
  expect(mocks.fetchDraftsForPrompt).toHaveBeenCalledWith(prompt.id);
  return root;
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
    await act(async () => { root.unmount(); });
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
    await act(async () => { root.unmount(); });
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
    await act(async () => { persistence.writes[0].reject(failure); await Promise.resolve(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(2);
    await act(async () => { persistence.writes[1].reject(failure); await Promise.resolve(); });

    expect(editorElement().value).toBe("Retry this edit");
    expect([...document.querySelectorAll("button")].some((item) => item.textContent?.includes("Save"))).toBe(true);
    expect(persistence.persisted.get("draft-a")).toBe("Original A");
    expect(persistence.persisted.get("draft-b")).toBe("Original B");
    expect(mocks.updateDraft).toHaveBeenCalledTimes(2);
    await act(async () => { buttonNamed("Save").click(); });
    await settleEffects();
    expect(persistence.writes).toHaveLength(3);
    await act(async () => { persistence.writes[2].resolve(); await Promise.resolve(); });
    expect(persistence.persisted.get("draft-a")).toBe("Retry this edit");
    await act(async () => { root.unmount(); });
  });
});
