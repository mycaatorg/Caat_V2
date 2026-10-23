// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, deferred, flush, mountComponent, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({
  fetchTodos: vi.fn(),
  addTodo: vi.fn(),
  toggleTodo: vi.fn(),
  deleteTodo: vi.fn(),
  updateTodo: vi.fn(),
  refresh: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: io.refresh }) }));
vi.mock("@/components/dashboard/api", () => ({
  fetchTodos: io.fetchTodos,
  addTodo: io.addTodo,
  toggleTodo: io.toggleTodo,
  deleteTodo: io.deleteTodo,
  updateTodo: io.updateTodo,
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ onCheckedChange, ...rest }: { onCheckedChange: (v: boolean) => void } & Record<string, unknown>) => (
    <input type="checkbox" {...(rest as object)} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));
vi.mock("@/components/ui/input", () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/skeleton", () => ({ Skeleton: () => <div /> }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button>,
  SelectValue: () => <span />,
}));

import { TodoWidget } from "@/components/dashboard/widgets/TodoWidget";

const todos = [
  { id: "t1", text: "Book a campus open day", done: false, due_date: null, priority: 2, created_at: "2026-10-01T00:00:00Z" },
  { id: "t3", text: "Email the careers adviser", done: false, due_date: null, priority: 3, created_at: "2026-10-02T00:00:00Z" },
  { id: "t2", text: "Ask Ms Lee for a reference letter", done: true, due_date: null, priority: 1, created_at: "2026-09-30T00:00:00Z" },
];

beforeEach(() => {
  vi.clearAllMocks();
  io.fetchTodos.mockResolvedValue(todos);
  io.toggleTodo.mockResolvedValue(undefined);
  io.deleteTodo.mockResolvedValue(undefined);
});
afterEach(() => unmountAll());

describe("TodoWidget", () => {
  it.each([false, true])("guards stale Undo while deleting and after successful deletion (failure=%s)", async (fails) => {
    const deletion = deferred();
    io.deleteTodo.mockReturnValueOnce(deletion.promise);
    await mountComponent(<TodoWidget />);
    await click(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')!);
    const undo = io.toast.success.mock.calls[0][1].action;
    io.fetchTodos.mockResolvedValue(todos.map((todo) => todo.id === "t1" ? { ...todo, done: true } : todo));
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Delete to-do: Book a campus open day"]')!);
    const { act } = await import("react");
    await act(async () => undo.onClick());
    expect(io.toggleTodo).toHaveBeenCalledTimes(1);
    await actResolve(deletion, fails ? new Error("offline") : undefined);
    await act(async () => undo.onClick());
    await flush();
    expect(io.toggleTodo).toHaveBeenCalledTimes(fails ? 2 : 1);
    if (fails) {
      expect(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')?.checked).toBe(false);
    } else {
      expect(document.querySelector('input[id="todo-t1"]')).toBeNull();
      expect(io.toast.error).not.toHaveBeenCalled();
    }
  });

  it("keeps completed tasks in a collapsed section and lets Undo restore an item", async () => {
    await mountComponent(<TodoWidget />);
    await flush();

    expect(document.body.textContent).toContain("Book a campus open day");
    const activeBox = document.querySelector<HTMLInputElement>('input[id="todo-t1"]')!;
    await click(activeBox);
    await flush();

    expect(document.body.textContent).toContain("Completed (1)");
    expect(document.querySelector('button[aria-expanded="false"]')?.textContent).toContain("Completed (1)");
    expect(document.body.textContent).toContain("Book a campus open day");
    expect(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')?.checked).toBe(true);
    expect(document.querySelector('label[for="todo-t1"]')?.className).toContain("line-through");
    expect(document.querySelector('input[id="todo-t1"]')?.closest("li")?.className).toContain("opacity");
    expect(io.toast.success).toHaveBeenCalled();
    expect(io.refresh).toHaveBeenCalledTimes(1);

    const undo = io.toast.success.mock.calls[0][1].action;
    await undo.onClick();
    await flush();
    expect(document.body.textContent).toContain("Book a campus open day");
    expect(io.toggleTodo).toHaveBeenNthCalledWith(1, "t1", true);
    expect(io.toggleTodo).toHaveBeenNthCalledWith(2, "t1", false);
    expect(io.refresh).toHaveBeenCalledTimes(2);

    await click(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')!);
    await flush();
    await undo.onClick();
    await flush();
    expect(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')?.checked).toBe(true);
    expect(io.toggleTodo).toHaveBeenCalledTimes(3);

    await click(document.querySelector('button[aria-expanded="false"]') as HTMLButtonElement);
    const previousCompletion = document.querySelector<HTMLInputElement>('input[id="todo-t2"]')!;
    expect(previousCompletion.checked).toBe(true);
    await click(previousCompletion);
    await flush();
    expect(document.querySelector<HTMLInputElement>('input[id="todo-t2"]')?.checked).toBe(false);
    expect(io.toggleTodo).toHaveBeenNthCalledWith(4, "t2", false);
  });

  it("rolls back a failed completion and locks only the task being saved", async () => {
    const first = deferred();
    const second = deferred();
    io.toggleTodo.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await mountComponent(<TodoWidget />);
    await flush();

    const t1 = document.querySelector<HTMLInputElement>('input[id="todo-t1"]')!;
    const t2 = document.querySelector<HTMLInputElement>('input[id="todo-t3"]')!;
    await click(t1);
    expect(t1.disabled).toBe(true);
    expect(t2.disabled).toBe(false);
    await click(t2);
    expect(t2.disabled).toBe(true);
    expect(io.toggleTodo).toHaveBeenCalledTimes(2);

    await actResolve(first, new Error("offline"));
    expect(io.toast.error).toHaveBeenCalled();
    expect(io.refresh).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Book a campus open day");
    expect(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')?.checked).toBe(false);
    await actResolve(second);
  });

  it("keeps a failed restore in Completed and hides it from the active list after remount", async () => {
    io.toggleTodo.mockRejectedValueOnce(new Error("offline"));
    await mountComponent(<TodoWidget />);
    await flush();

    await click(document.querySelector('button[aria-expanded="false"]') as HTMLButtonElement);
    const completedBox = document.querySelector<HTMLInputElement>('input[id="todo-t2"]')!;
    await click(completedBox);
    await flush();

    expect(document.querySelector('section[aria-label="Completed tasks"]')?.textContent ?? "").toContain("Completed (1)");
    expect(document.querySelector<HTMLInputElement>('input[id="todo-t2"]')?.checked).toBe(true);
    expect(io.toast.error).toHaveBeenCalled();

    unmountAll();
    io.fetchTodos.mockResolvedValue(todos.map((todo) => todo.id === "t1" ? { ...todo, done: true } : todo));
    await mountComponent(<TodoWidget />);
    await flush();
    expect(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')).toBeNull();
    expect(document.querySelector('button[aria-expanded="false"]')?.textContent).toContain("Completed (2)");
  });

  it("keeps a recently completed task visible and checked when toast Undo fails", async () => {
    await mountComponent(<TodoWidget />);
    await click(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')!);
    const undo = io.toast.success.mock.calls[0][1].action;
    io.toggleTodo.mockRejectedValueOnce(new Error("offline"));
    const { act } = await import("react");
    await act(async () => undo.onClick());
    await flush();
    expect(io.toast.error).toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[id="todo-t1"]')?.checked).toBe(true);
    expect(document.querySelector('button[aria-expanded="false"]')?.textContent).toContain("Completed (1)");
  });
});

async function actResolve(deferredValue: ReturnType<typeof deferred<void>>, error?: Error) {
  const { act } = await import("react");
  await act(async () => error ? deferredValue.reject(error) : deferredValue.resolve(undefined));
  await flush();
}
