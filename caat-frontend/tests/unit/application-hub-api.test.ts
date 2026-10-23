import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  fetchSavedCoursesForSchool,
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

const scholarship = (id: string, title: string, deadline_at: string | null, school_name = "University of Melbourne") => ({
  id,
  title,
  provider_name: "UoM",
  amount_display: "$10k",
  deadline_at,
  country: "Australia",
  school_name,
  tags: [],
  citizenships: [],
  study_level: [],
});
// What the database returns for this school's active scholarships, already in
// deadline-then-title order (the order is asserted on the query, not re-sorted).
const linkedScholarships = [
  scholarship("s1", "Melbourne Award", "2026-11-01"),
  scholarship("s2", "Melbourne Bursary", null),
];

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
        return { data: linkedScholarships, error: null };
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

  it("refuses to build a checklist when the prompt catalogue fails to load", async () => {
    use(hubResolver({ essay_prompts: { data: null, error: { message: "prompts down" } } }));
    await expect(fetchApplicationHub("app-1")).rejects.toThrow("prompts down");
  });

  it("surfaces a sanitized read failure", async () => {
    use(hubResolver({ user_school_applications: { data: null, error: { message: "read failed" } } }));
    await expect(fetchApplicationHub("app-1")).rejects.toThrow("read failed");
  });

  it("builds the preparation checklist from the application, drafts and documents", async () => {
    const hub = await fetchApplicationHub("app-1");
    expect(hub.readiness).toEqual({
      deadlineSet: false,
      essayDrafted: true,
      keyDocsUploaded: true,
      score: 2,
    });
  });

  it.each(["submitted", "decision_pending", "accepted", "withdrawn", "researching"])(
    "never counts the %s status as a preparation step",
    async (status) => {
      use(hubResolver({ user_school_applications: { data: { ...application, status, deadline_at: "2026-12-01" }, error: null } }));
      const hub = await fetchApplicationHub("app-1");
      expect(hub.readiness).toEqual({ deadlineSet: true, essayDrafted: true, keyDocsUploaded: true, score: 3 });
      expect(hub.readiness).not.toHaveProperty("submitted");
    },
  );

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

  it("counts only essays and documents attached to this application or shared, with mixed items", async () => {
    use(
      hubResolver({
        essay_drafts: {
          data: [
            // per-school prompt drafted for ANOTHER school: not this application's essay
            { prompt_id: "p-why", school_id: 99, updated_at: "2026-09-01T00:00:00Z" },
            // per-school prompt left untagged: the hub's essay panel does not show it for this school
            { prompt_id: "p-why", school_id: null, updated_at: "2026-09-03T00:00:00Z" },
          ],
          error: null,
        },
        documents: {
          data: [
            // shared, but not one of the key documents the checklist lists
            { id: "d5", file_name: "photo.png", category: "other", status: null, school_id: null },
            // another school's key document
            { id: "d4", file_name: "elsewhere.pdf", category: "letters", status: "verified", school_id: 99 },
          ],
          error: null,
        },
      }),
    );
    const hub = await fetchApplicationHub("app-1");
    expect(hub.essaysForSchool[0].status).toBe("to-write");
    expect(hub.essaysShared[0].status).toBe("to-write");
    expect(hub.schoolDocuments).toEqual([]);
    expect(hub.sharedDocuments.every((d) => d.status === "missing")).toBe(true);
    expect(hub.readiness).toEqual({ deadlineSet: false, essayDrafted: false, keyDocsUploaded: false, score: 0 });
  });

  it("counts a draft tagged to this school and a document attached to this application", async () => {
    use(
      hubResolver({
        essay_drafts: { data: [{ prompt_id: "p-why", school_id: 7, updated_at: "2026-09-04T00:00:00Z" }], error: null },
        documents: { data: [{ id: "d3", file_name: "unimelb-form.pdf", category: "other", status: null, school_id: 7 }], error: null },
      }),
    );
    const hub = await fetchApplicationHub("app-1");
    expect(hub.readiness).toMatchObject({ essayDrafted: true, keyDocsUploaded: true, score: 2 });
  });

  it("counts a shared essay draft and a shared key document", async () => {
    use(
      hubResolver({
        essay_drafts: { data: [{ prompt_id: "p-personal", school_id: null, updated_at: null }], error: null },
        documents: { data: [{ id: "d2", file_name: "passport.pdf", category: "identity", status: "pending", school_id: null }], error: null },
      }),
    );
    const hub = await fetchApplicationHub("app-1");
    expect(hub.readiness).toMatchObject({ essayDrafted: true, keyDocsUploaded: true, score: 2 });
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

  it("passes tracked scholarships and intended majors through", async () => {
    io.tracked.mockResolvedValue([{ id: "t1", title: "Tracked", provider: "P", amount: null, status: "applied" }]);
    const hub = await fetchApplicationHub("app-1");
    expect(io.tracked).toHaveBeenCalledWith("The University of Melbourne");
    expect(hub.trackedScholarships).toHaveLength(1);
    expect(hub.intendedMajors).toEqual(["Law"]);
  });
});

describe("hub scholarships for this university", () => {
  const scholarshipQueries = () => io.client.queries.filter((q) => q.table === "scholarships");
  const callsOf = (q: QueryContext, method: string) => q.calls.filter((c) => c.method === method).map((c) => c.args);
  const STABLE_ORDER = [
    ["deadline_at", { ascending: true, nullsFirst: false }],
    ["title", { ascending: true }],
  ];

  it("queries active scholarships linked to this school, soonest deadline then name, with a limit", async () => {
    const hub = await fetchApplicationHub("app-1");
    expect(scholarshipQueries()).toHaveLength(1);
    const [q] = scholarshipQueries();
    expect(String(callsOf(q, "select")[0][0])).toContain("scholarship_schools!inner(school_id)");
    expect(callsOf(q, "eq")).toEqual([
      ["scholarship_schools.school_id", 7],
      ["is_active", true],
    ]);
    expect(callsOf(q, "order")).toEqual(STABLE_ORDER);
    expect(callsOf(q, "limit")).toEqual([[5]]);
    expect(hub.scholarships.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(hub.scholarships[0]).toEqual({ id: "s1", title: "Melbourne Award", provider: "UoM", amount: "$10k", deadline: "2026-11-01" });
    expect(hub.scholarships[0]).not.toHaveProperty("fit");
    expect(hub.scholarshipsUnavailable).toBe(false);
  });

  it("falls back to the school page's name match (school or provider, case-insensitive) when no catalogue link exists", async () => {
    use((ctx) => {
      if (ctx.table === "scholarships") {
        const linked = ctx.calls.some((c) => c.method === "eq" && c.args[0] === "scholarship_schools.school_id");
        return linked ? { data: [], error: null } : { data: [scholarship("s9", "Named Award", "2099-12-01")], error: null };
      }
      return hubResolver()(ctx);
    });
    const hub = await fetchApplicationHub("app-1");
    expect(scholarshipQueries()).toHaveLength(2);
    const fallback = scholarshipQueries()[1];
    expect(String(callsOf(fallback, "select")[0][0])).not.toContain("scholarship_schools");
    expect(callsOf(fallback, "in")).toEqual([]);
    expect(callsOf(fallback, "or")[1]).toEqual([
      'school_name.ilike."%University of Melbourne%",provider_name.ilike."%University of Melbourne%"',
    ]);
    expect(callsOf(fallback, "eq")).toEqual([["is_active", true]]);
    expect(callsOf(fallback, "order")).toEqual(STABLE_ORDER);
    expect(callsOf(fallback, "limit")).toEqual([[5]]);
    expect(hub.scholarships.map((s) => s.id)).toEqual(["s9"]);
  });

  it("quotes a school name with reserved characters in the fallback and strips embedded quotes", async () => {
    const odd = { ...application, schools: { id: 7, name: 'The University of California, "Berkeley" (UCB)', country: "United States" } };
    use((ctx) => {
      if (ctx.table === "user_school_applications") return { data: odd, error: null };
      if (ctx.table === "scholarships") return { data: [], error: null };
      return hubResolver()(ctx);
    });
    await fetchApplicationHub("app-1");
    const fallback = scholarshipQueries()[1];
    expect(callsOf(fallback, "or")[1]).toEqual([
      'school_name.ilike."%University of California, Berkeley (UCB)%",provider_name.ilike."%University of California, Berkeley (UCB)%"',
    ]);
  });

  describe("passed deadlines", () => {
    const NOW = new Date("2026-10-23T08:00:00.000Z");
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    // Applies the query's open-deadline filter to the rows, like PostgREST would.
    const open = (ctx: QueryContext, rows: ReturnType<typeof scholarship>[]) => {
      const filter = ctx.calls.find((c) => c.method === "or" && String(c.args[0]).startsWith("deadline_at."));
      if (!filter) return rows;
      const since = String(filter.args[0]).split("deadline_at.gte.")[1];
      return rows.filter((r) => r.deadline_at == null || r.deadline_at >= since);
    };

    it("excludes an expired scholarship from both the linked and the name queries", async () => {
      const rows = [scholarship("expired", "Closed Award", "2026-10-01"), scholarship("open", "Open Award", "2026-12-01"), scholarship("rolling", "Rolling Award", null)];
      use((ctx) => {
        if (ctx.table !== "scholarships") return hubResolver()(ctx);
        const linked = ctx.calls.some((c) => c.method === "eq" && c.args[0] === "scholarship_schools.school_id");
        return { data: linked ? open(ctx, [rows[0]]) : open(ctx, rows), error: null };
      });
      const hub = await fetchApplicationHub("app-1");
      for (const q of scholarshipQueries()) {
        expect(callsOf(q, "or")[0]).toEqual([`deadline_at.is.null,deadline_at.gte.${NOW.toISOString()}`]);
      }
      // The only linked row has expired, so the linked query is empty and the name fallback runs.
      expect(scholarshipQueries()).toHaveLength(2);
      expect(hub.scholarships.map((s) => s.id)).toEqual(["open", "rolling"]);
    });
  });

  it("returns an empty list when none are recorded for this university", async () => {
    use(hubResolver({ scholarships: { data: [], error: null } }));
    const hub = await fetchApplicationHub("app-1");
    expect(hub.scholarships).toEqual([]);
    expect(hub.scholarshipsUnavailable).toBe(false);
  });

  it("marks scholarships unavailable on a read error instead of claiming there are none", async () => {
    use(hubResolver({ scholarships: { data: null, error: { message: "boom" } } }));
    const hub = await fetchApplicationHub("app-1");
    expect(hub.scholarships).toEqual([]);
    expect(hub.scholarshipsUnavailable).toBe(true);
    expect(scholarshipQueries()).toHaveLength(1);
  });

  it("reads the public catalogue without a country sweep or a user filter", async () => {
    await fetchApplicationHub("app-1");
    for (const q of scholarshipQueries()) {
      const cols = callsOf(q, "eq").map(([col]) => col);
      expect(cols).not.toContain("country");
      expect(cols).not.toContain("user_id");
    }
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

describe("hub saved courses at this university (PROD-148)", () => {
  const saved = (id: string, patch: Record<string, unknown> = {}) => ({
    course_id: id,
    course_offerings: {
      id, name: `Course ${id}`, campus: "Parkville", application_route: "Apply through VTAC.",
      application_url: "https://vtac.edu.au", source_url: "https://unimelb.edu.au/c", verified_at: "2026-10-01T00:00:00Z",
      active: true, school_id: 7, ...patch,
    },
  });

  it("reads only the caller's saved courses whose offering is at this school, in the parallel batch", async () => {
    use(hubResolver({ user_course_bookmarks: { data: [saved("c1")], error: null } }));
    const hub = await fetchApplicationHub("app-1");
    const read = io.client.queries.find((q) => q.table === "user_course_bookmarks")!;
    expect(String(read.calls.find((c) => c.method === "select")!.args[0])).toContain("course_offerings!inner(");
    expect(read.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([
      ["user_id", "student-1"],
      ["course_offerings.school_id", 7],
    ]);
    expect(hub.savedCoursesUnavailable).toBe(false);
    expect(hub.savedCourses).toEqual([{
      id: "c1", name: "Course c1", campus: "Parkville", application_route: "Apply through VTAC.",
      application_url: "https://vtac.edu.au", source_url: "https://unimelb.edu.au/c", verified_at: "2026-10-01T00:00:00.000Z", active: true,
    }]);
  });

  it("keeps an inactive saved course and drops unsafe links and invalid dates", async () => {
    use(hubResolver({ user_course_bookmarks: { data: [saved("c2", { active: false, application_url: "javascript:alert(1)", verified_at: "not a date" })], error: null } }));
    const hub = await fetchApplicationHub("app-1");
    expect(hub.savedCourses[0]).toMatchObject({ id: "c2", active: false, application_url: null, verified_at: null });
  });

  it("marks the card unavailable on a read error instead of reporting no saved courses", async () => {
    use(hubResolver({ user_course_bookmarks: { data: null, error: { message: "offline" } } }));
    const hub = await fetchApplicationHub("app-1");
    expect(hub.savedCourses).toEqual([]);
    expect(hub.savedCoursesUnavailable).toBe(true);
    // The rest of the hub, including the preparation score, is unaffected.
    expect(hub.readiness).toEqual({ deadlineSet: false, essayDrafted: true, keyDocsUploaded: true, score: 2 });
  });

  it("retries the saved-courses read on its own, scoped to the caller and school", async () => {
    use(hubResolver({ user_course_bookmarks: { data: [saved("c1")], error: null } }));
    const courses = await fetchSavedCoursesForSchool(7);
    expect(courses.map((c) => c.id)).toEqual(["c1"]);
    expect(io.client.queries.map((q) => q.table)).toEqual(["user_course_bookmarks"]);
    use(hubResolver({ user_course_bookmarks: { data: null, error: { message: "offline" } } }));
    await expect(fetchSavedCoursesForSchool(7)).rejects.toThrow();
  });
});

describe("fetchMajorOptions", () => {
  it("returns major names in order", async () => {
    use(() => ({ data: [{ name: "Commerce" }, { name: "Law" }], error: null }));
    expect(await fetchMajorOptions()).toEqual(["Commerce", "Law"]);
  });
});
