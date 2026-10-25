import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

const io = vi.hoisted(() => ({ client: null as unknown as ReturnType<typeof createMockSupabase> }));
vi.mock("@/lib/supabase/client", () => ({ get supabase() { return io.client; } }));
vi.mock("@/lib/safe-error", () => ({ sanitizeError: (error: unknown) => (error as { message?: string })?.message ?? "error" }));

import { addTodo, toggleTodo } from "@/components/dashboard/api";

function use(resolver: (ctx: QueryContext) => QueryResult, user: { id: string } | null = { id: "student-1" }) {
  io.client = createMockSupabase({ resolver, user });
}

beforeEach(() => use(() => ({ data: { id: "todo-1" }, error: null })));

describe("toggleTodo", () => {
  it("treats a zero-row update as a missing task instead of reporting success", async () => {
    use(() => ({ data: null, error: null }));

    await expect(toggleTodo("todo-1", true)).rejects.toThrow("To-do not found");
    const query = io.client.queries[0];
    expect(query.calls).toContainEqual({ method: "select", args: ["id"] });
    expect(query.calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([
      ["id", "todo-1"],
      ["user_id", "student-1"],
    ]);
  });

  it("updates the caller's existing task", async () => {
    await expect(toggleTodo("todo-1", true)).resolves.toBeUndefined();
    expect(io.client.queries[0].calls).toContainEqual({ method: "update", args: [{ done: true }] });
  });
});

describe("addTodo", () => {
 it("does not report success when the saved task row is missing", async () => {
  use(()=>({data:null,error:null}));
  await expect(addTodo("Check prerequisites")).rejects.toThrow("Could not confirm the saved to-do");
 });
 it("creates only the authenticated owner's personal task", async () => {
  await addTodo("Check prerequisites", {due_date:"2026-11-01",priority:2});
  expect(io.client.queries[0].calls).toContainEqual({method:"insert",args:[{user_id:"student-1",text:"Check prerequisites",done:false,due_date:"2026-11-01",priority:2}]});
 });
 it("does not write while signed out", async () => {
  use(()=>({data:null,error:null}),null);
  await expect(addTodo("Check prerequisites")).rejects.toThrow("Not authenticated");
  expect(io.client.queries).toHaveLength(0);
 });
});
