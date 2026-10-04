import { beforeEach, describe, expect, it, vi } from "vitest";

type Query = { table: string; filters: Array<{ method: string; args: unknown[] }> };
type QueryResult = { data: unknown; error: { message: string } | null };

const state = vi.hoisted(() => ({
  user: { id: "user-1", email: "ada@example.test" } as { id: string; email?: string } | null,
  queries: [] as Query[],
  resolve: null as unknown as (query: Query) => QueryResult,
  getUser: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: class extends Response {
    static json(value: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(value), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      });
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: state.getUser },
    from: (table: string) => {
      const query: Query = { table, filters: [] };
      state.queries.push(query);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in"]) {
        builder[method] = (...args: unknown[]) => {
          if (method !== "select") query.filters.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(state.resolve(query)).then(resolve, reject);
      return builder;
    },
  }),
}));

import { GET } from "@/app/(main)/settings/export/route";

beforeEach(() => {
  state.user = { id: "user-1", email: "ada@example.test" };
  state.queries = [];
  state.resolve = () => ({ data: [], error: null });
  state.getUser.mockReset().mockImplementation(async () => ({ data: { user: state.user }, error: null }));
});

describe("settings data export route", () => {
  it("denies unauthenticated export without querying account data", async () => {
    state.user = null;

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
    expect(state.queries).toHaveLength(0);
  });

  it("scopes owned rows and related child rows to the signed-in account", async () => {
    state.resolve = (query) => {
      if (query.table === "standardised_test_scores") return { data: [{ id: "score-1" }], error: null };
      if (query.table === "resumes") return { data: [{ id: "resume-1" }], error: null };
      return { data: [], error: null };
    };

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.account).toEqual({ id: "user-1", email: "ada@example.test" });
    expect(state.queries.find((query) => query.table === "profiles")?.filters).toEqual([
      { method: "eq", args: ["id", "user-1"] },
    ]);
    for (const query of state.queries.filter((item) => !["profiles", "standardised_test_scores", "standardised_test_subjects", "resumes", "resume_sections", "community_groups"].includes(item.table))) {
      expect(query.filters).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    }
    expect(state.queries.find((query) => query.table === "standardised_test_scores")?.filters).toContainEqual({
      method: "eq", args: ["profile_id", "user-1"],
    });
    expect(state.queries.find((query) => query.table === "standardised_test_subjects")?.filters).toContainEqual({
      method: "in", args: ["test_score_id", ["score-1"]],
    });
    expect(state.queries.find((query) => query.table === "resume_sections")?.filters).toContainEqual({
      method: "in", args: ["resume_id", ["resume-1"]],
    });
    expect(state.queries.find((query) => query.table === "community_groups")?.filters).toContainEqual({
      method: "eq", args: ["creator_id", "user-1"],
    });
  });

  it.each([
    "profiles",
    "standardised_test_scores",
    "standardised_test_subjects",
    "resumes",
    "resume_sections",
    "community_groups",
    "calendar_events",
    "user_todos",
    "user_recommenders",
    "user_scholarships",
    "user_school_applications",
    "user_school_notes",
    "user_bookmarked_schools",
    "user_bookmarked_scholarships",
    "user_bookmarked_majors",
    "custom_essay_prompts",
    "essay_drafts",
    "documents",
    "dashboard_layouts",
    "user_dashboard_widgets",
    "community_posts",
    "community_comments",
    "community_group_members",
    "notifications",
  ])("returns a generic error instead of a partial export when %s query fails", async (failedTable) => {
    state.resolve = (query) => {
      if (query.table === failedTable) return { data: null, error: { message: "sensitive database details" } };
      if (query.table === "standardised_test_scores") return { data: [{ id: "score-1" }], error: null };
      if (query.table === "resumes") return { data: [{ id: "resume-1" }], error: null };
      return { data: [], error: null };
    };

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Could not export your data. Please try again." });
    expect(JSON.stringify(body)).not.toContain("sensitive database details");
  });
});
