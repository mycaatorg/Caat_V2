import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

const io = vi.hoisted(() => ({
  client: null as unknown as ReturnType<typeof createMockSupabase>,
  tracked: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  get supabase() {
    return io.client;
  },
}));
vi.mock("@/lib/safe-error", () => ({
  sanitizeError: (e: unknown) =>
    typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : "error",
}));
vi.mock("@/lib/scholarship-tracking", () => ({ fetchTrackedForSchool: io.tracked }));

import {
  fetchApplicationHub,
  fetchMajorOptions,
  updateApplicationDeadline,
  updateApplicationStatus,
} from "@/app/(main)/applications/[id]/api";

const SCHOOL = { id: 7, name: "The University of Melbourne", country: "Australia" };
const application = {
  id: "app-1",
  user_id: "student-1",
  school_id: 7,
  status: "applying",
  deadline_at: null as string | null,
  notes: null,
  intended_majors: ["Law"],
  schools: SCHOOL,
};

function use(resolver: (ctx: QueryContext) => QueryResult, user: { id: string } | null = { id: "student-1" }) {
  io.client = createMockSupabase({ resolver, user });
}

function hubResolver(overrides: Partial<Record<string, QueryResult>> = {}) {
  return (ctx: QueryContext): QueryResult => {
    if (overrides[ctx.table]) return overrides[ctx.table]!;
    switch (ctx.table) {
      case "user_school_applications":
        return { data: application, error: null };
      case "profiles":
        return { data: { target_majors: ["Law"], nationality: "AU", graduation_year: 2027, preferred_countries: ["Australia"] }, error: null };
      case "essay_prompts":
        return {
          data: [
            { id: "p-why", slug: "why-us", title: "Why this school", scope: "per_school", sort_order: 1 },
            { id: "p-personal", slug: "personal", title: "Personal statement", scope: "shared", sort_order: 2 },
          ],
          error: null,
        };
      case "essay_drafts":
        return {
          data: [
            { prompt_id: "p-why", school_id: 99, updated_at: "2026-09-01T00:00:00Z" },
            { prompt_id: "p-personal", school_id: null, updated_at: "2026-09-02T00:00:00Z" },
          ],
          error: null,
        };
      case "documents":
        return {
          data: [
            { id: "d1", file_name: "transcript.pdf", category: "transcripts", status: "Verified", school_id: null },
            { id: "d2", file_name: "passport.pdf", category: "identity", status: "pending", school_id: null },
            { id: "d3", file_name: "unimelb-form.pdf", category: "other", status: null, school_id: 7 },
            { id: "d4", file_name: "elsewhere.pdf", category: "letters", status: "verified", school_id: 99 },
          ],
          error: null,
        };
      case "scholarships":
        return {
          data: [
            { id: "s1", title: "Melbourne Award", provider_name: "UoM", amount_display: "$10k", country: "Australia", school_name: "University of Melbourne", tags: [], citizenships: [], study_level: [] },
            { id: "s2", title: "Other School Award", provider_name: "Other", amount_display: null, country: "Australia", school_name: "Monash University", tags: [], citizenships: [], study_level: [] },
          ],
          error: null,
        };
      default:
        return { data: [], error: null };
    }
  };
}

beforeEach(() => {
  io.tracked.mockReset();
  io.tracked.mockResolvedValue([]);
  use(hubResolver());
});

describe("fetchApplicationHub", () => {
  it("refuses a signed-out caller before reading any application", async () => {
    use(hubResolver(), null);
    await expect(fetchApplicationHub("app-1")).rejects.toThrow("Not authenticated");
    expect(io.client.queries).toHaveLength(0);
  });

  it("scopes the application read to both the id and the caller", async () => {
    await fetchApplicationHub("app-1");
    const appQuery = io.client.queries.find((q) => q.table === "user_school_applications")!;
    expect(appQuery.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["id", "app-1"],
      ["user_id", "student-1"],
    ]);
  });

  it("reports a missing or foreign application as not found", async () => {
    use(hubResolver({ user_school_applications: { data: null, error: null } }));
    await expect(fetchApplicationHub("someone-elses")).rejects.toThrow("Application not found");
    expect(io.client.queries.map((q) => q.table)).toEqual(["user_school_applications"]);
  });

  it("surfaces a sanitized read failure", async () => {
    use(hubResolver({ user_school_applications: { data: null, error: { message: "read failed" } } }));
    await expect(fetchApplicationHub("app-1")).rejects.toThrow("read failed");
  });

  it("builds the readiness checklist from the application, drafts and documents", async () => {
    const hub = await fetchApplicationHub("app-1");
    expect(hub.readiness).toEqual({
      deadlineSet: false,
      essayDrafted: true,
      keyDocsUploaded: true,
      submitted: false,
      score: 2,
    });
  });

  it.each(["submitted", "decision_pending", "accepted", "rejected", "waitlisted"])(
    "counts %s as submitted",
    async (status) => {
      use(hubResolver({ user_school_applications: { data: { ...application, status, deadline_at: "2026-12-01" }, error: null } }));
      const hub = await fetchApplicationHub("app-1");
      expect(hub.readiness.submitted).toBe(true);
      expect(hub.readiness.deadlineSet).toBe(true);
    },
  );

  it("does not count withdrawn or researching applications as submitted", async () => {
    for (const status of ["withdrawn", "researching"]) {
      use(hubResolver({ user_school_applications: { data: { ...application, status }, error: null } }));
      expect((await fetchApplicationHub("app-1")).readiness.submitted).toBe(false);
    }
  });

  it("ignores drafts and documents tagged to other schools for readiness", async () => {
    use(
      hubResolver({
        essay_drafts: { data: [{ prompt_id: "p-why", school_id: 99, updated_at: null }], error: null },
        documents: { data: [{ id: "d4", file_name: "x.pdf", category: "letters", status: "verified", school_id: 99 }], error: null },
      }),
    );
    const hub = await fetchApplicationHub("app-1");
    expect(hub.readiness).toMatchObject({ essayDrafted: false, keyDocsUploaded: false, score: 0 });
  });

  it("groups essays by scope and documents by school tag", async () => {
    const hub = await fetchApplicationHub("app-1");
    // The per-school draft belongs to school 99, so this school's essay is still to write.
    expect(hub.essaysForSchool).toEqual([
      { promptId: "p-why", promptSlug: "why-us", title: "Why this school", status: "to-write", lastEdited: null },
    ]);
    expect(hub.essaysShared[0]).toMatchObject({ promptId: "p-personal", status: "drafted", lastEdited: "2026-09-02T00:00:00Z" });
    expect(hub.schoolDocuments).toEqual([{ id: "d3", fileName: "unimelb-form.pdf", status: "pending" }]);
    expect(Object.fromEntries(hub.sharedDocuments.map((d) => [d.category, d.status]))).toEqual({
      transcripts: "verified",
      identity: "pending",
      language: "missing",
      letters: "missing",
    });
  });

  it("lists only scholarships for this school and passes tracked ones through", async () => {
    io.tracked.mockResolvedValue([{ id: "t1", title: "Tracked", provider: "P", amount: null, status: "applied" }]);
    const hub = await fetchApplicationHub("app-1");
    expect(hub.scholarships.map((s) => s.id)).toEqual(["s1"]);
    expect(io.tracked).toHaveBeenCalledWith("The University of Melbourne");
    expect(hub.trackedScholarships).toHaveLength(1);
    expect(hub.intendedMajors).toEqual(["Law"]);
  });
});

describe("hub status and deadline writes", () => {
  const written = (ctx: QueryContext): QueryResult =>
    ctx.op === "update" ? { data: [{ id: "app-1" }], error: null } : { data: null, error: null };

  it("updates status scoped to the caller", async () => {
    use(written);
    await expect(updateApplicationStatus("app-1", "submitted")).resolves.toBeUndefined();
    const update = io.client.queries.find((q) => q.op === "update")!;
    expect(update.calls.find((c) => c.method === "update")!.args[0]).toMatchObject({ status: "submitted" });
    expect(update.calls.at(-1)).toEqual({ method: "select", args: ["id"] });
    expect(update.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["id", "app-1"],
      ["user_id", "student-1"],
    ]);
  });

  it("sets and clears the deadline scoped to the caller", async () => {
    use(written);
    await updateApplicationDeadline("app-1", "2026-12-01");
    await updateApplicationDeadline("app-1", null);
    const patches = io.client.queries.filter((q) => q.op === "update").map((q) => q.calls.find((c) => c.method === "update")!.args[0]);
    expect(patches).toMatchObject([{ deadline_at: "2026-12-01" }, { deadline_at: null }]);
    for (const q of io.client.queries) expect(q.calls.at(-1)).toEqual({ method: "select", args: ["id"] });
  });

  it.each([
    ["status", () => updateApplicationStatus("missing", "submitted")],
    ["deadline", () => updateApplicationDeadline("missing", "2026-12-01")],
  ])("rejects a %s write that matched no owned application", async (_label, write) => {
    use((ctx) => (ctx.op === "update" ? { data: [], error: null } : { data: null, error: null }));
    await expect(write()).rejects.toThrow("Application not found");
  });

  it("surfaces a sanitized write failure", async () => {
    use(() => ({ data: null, error: { message: "write failed" } }));
    await expect(updateApplicationStatus("app-1", "submitted")).rejects.toThrow("write failed");
    await expect(updateApplicationDeadline("app-1", null)).rejects.toThrow("write failed");
  });

  it("never writes for a signed-out caller", async () => {
    use(written, null);
    await expect(updateApplicationStatus("app-1", "submitted")).rejects.toThrow("Not authenticated");
    await expect(updateApplicationDeadline("app-1", null)).rejects.toThrow("Not authenticated");
    expect(io.client.queries).toHaveLength(0);
  });
});

describe("fetchMajorOptions", () => {
  it("returns major names in order", async () => {
    use(() => ({ data: [{ name: "Commerce" }, { name: "Law" }], error: null }));
    expect(await fetchMajorOptions()).toEqual(["Commerce", "Law"]);
  });
});
