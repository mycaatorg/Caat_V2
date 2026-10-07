import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

const io = vi.hoisted(() => ({
  client: null as unknown as ReturnType<typeof createMockSupabase>,
}));

vi.mock("@/lib/supabase/client", () => ({
  get supabase() {
    return io.client;
  },
}));

import { deleteSection } from "@/components/resume-builder/api";

function use(resolver: (ctx: QueryContext) => QueryResult) {
  io.client = createMockSupabase({ resolver, user: { id: "student-1" } });
}

const deletes = () => io.client.queries.filter((q) => q.table === "resume_sections" && q.op === "delete");

describe("resume section delete", () => {
  beforeEach(() => use(() => ({ data: null, error: null })));

  it("treats a section that was never saved as already deleted", async () => {
    // A section added inside the autosave window, or whose save failed, has no row.
    use((ctx) => (ctx.table === "resume_sections" ? { data: null, error: null } : { data: { id: "resume-1" }, error: null }));

    await expect(deleteSection("unsaved-section")).resolves.toBeUndefined();
    expect(deletes()).toHaveLength(0);
  });

  it("still fails when the section lookup itself fails", async () => {
    use((ctx) => (ctx.table === "resume_sections" ? { data: null, error: { message: "lookup failed" } } : { data: null, error: null }));

    await expect(deleteSection("section-1")).rejects.toThrow();
    expect(deletes()).toHaveLength(0);
  });

  it("deletes a saved section only after confirming the owner's resume", async () => {
    use((ctx) => {
      if (ctx.table === "resume_sections" && ctx.op === "select") return { data: { resume_id: "resume-1" }, error: null };
      if (ctx.table === "resumes") return { data: { id: "resume-1" }, error: null };
      return { data: null, error: null };
    });

    await deleteSection("section-1");
    const resumeCheck = io.client.queries.find((q) => q.table === "resumes")!;
    expect(resumeCheck.calls).toContainEqual({ method: "eq", args: ["user_id", "student-1"] });
    expect(deletes()).toHaveLength(1);
    expect(deletes()[0].calls).toContainEqual({ method: "eq", args: ["id", "section-1"] });
  });
});
