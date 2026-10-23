import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

const io = vi.hoisted(() => ({ client: null as unknown as ReturnType<typeof createMockSupabase> }));
vi.mock("@/lib/supabase/client", () => ({ get supabase() { return io.client; } }));
vi.mock("@/lib/safe-error", () => ({ sanitizeError: (error: unknown) => (error as { message?: string })?.message ?? "error" }));

import { toggleTodo } from "@/components/dashboard/api";

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
