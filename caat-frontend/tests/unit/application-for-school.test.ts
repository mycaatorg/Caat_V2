import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

const io = vi.hoisted(() => ({ client: null as unknown as ReturnType<typeof createMockSupabase> }));
vi.mock("@/lib/supabase/client", () => ({ get supabase() { return io.client; } }));
vi.mock("@/lib/current-user", () => ({ getClientUserId: () => Promise.resolve("student-1") }));
vi.mock("@/lib/safe-error", () => ({ sanitizeError: () => "Something went wrong. Please try again." }));

import { startApplicationForSchool } from "@/lib/application-for-school";

const existing = { id: "app-9", user_id: "student-1", school_id: 7, status: "applying", schools: { id: 7, name: "Alpha", country: "Australia" } };
const created = { ...existing, id: "app-new", status: "researching" };
const duplicate = { message: "duplicate key", code: "23505" } as { message: string };

function use(resolver: (ctx: QueryContext) => QueryResult) {
  io.client = createMockSupabase({
    resolver: (ctx) => (ctx.table === "profiles" ? { data: { target_majors: [] }, error: null } : resolver(ctx)),
    user: { id: "student-1" },
  });
}
const appQueries = (op: QueryContext["op"]) =>
  io.client.queries.filter((q) => q.table === "user_school_applications" && q.op === op);

describe("startApplicationForSchool (PROD-148)", () => {
  beforeEach(() => use(() => ({ data: null, error: null })));

  it("creates the application when the student has none and reports created", async () => {
    use(() => ({ data: created, error: null }));
    await expect(startApplicationForSchool(7)).resolves.toEqual({ application: { id: "app-new", status: "researching" }, created: true });
    expect(appQueries("insert")).toHaveLength(1);
    const insert = appQueries("insert")[0].calls.find((c) => c.method === "insert")!.args[0] as Record<string, unknown>;
    expect(insert).toMatchObject({ user_id: "student-1", school_id: 7, status: "researching" });
  });

  it("returns the existing application, not an error, when the insert hits the unique constraint (23505)", async () => {
    use((ctx) => (ctx.op === "insert" ? { data: null, error: duplicate } : { data: existing, error: null }));
    await expect(startApplicationForSchool(7)).resolves.toEqual({ application: { id: "app-9", status: "applying" }, created: false });
    expect(appQueries("insert")).toHaveLength(1);
    const read = appQueries("select")[0];
    expect(read.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["user_id", "student-1"], ["school_id", 7]]);
  });

  it("throws when 23505 is followed by no readable row (never claims success)", async () => {
    use((ctx) => (ctx.op === "insert" ? { data: null, error: duplicate } : { data: null, error: null }));
    await expect(startApplicationForSchool(7)).rejects.toThrow();
    expect(appQueries("insert")).toHaveLength(1);
  });

  it("throws when 23505 is followed by a failed read", async () => {
    use((ctx) => (ctx.op === "insert" ? { data: null, error: duplicate } : { data: null, error: { message: "offline" } }));
    await expect(startApplicationForSchool(7)).rejects.toThrow();
  });

  it("throws a sanitised message on any other error, with no second insert and no read", async () => {
    use(() => ({ data: null, error: { message: "permission denied for table user_school_applications", code: "42501" } as { message: string } }));
    await expect(startApplicationForSchool(7)).rejects.toThrow(/^Something went wrong\. Please try again\.$/);
    expect(appQueries("insert")).toHaveLength(1);
    expect(appQueries("select")).toHaveLength(0);
  });
});
