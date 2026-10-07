import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

const io = vi.hoisted(() => ({ client: null as unknown as ReturnType<typeof createMockSupabase>, userId: "student-1" as string | null }));
vi.mock("@/lib/supabase/client", () => ({ get supabase() { return io.client; } }));
vi.mock("@/lib/current-user", () => ({ getClientUserId: () => Promise.resolve(io.userId) }));
vi.mock("@/lib/safe-error", () => ({ sanitizeError: (e: { message?: string }) => e?.message ?? "error" }));

import {
  completeOnboarding,
  dismissOnboarding,
  fetchOnboardingProfile,
  graduationYearFor,
  mergeUnique,
  saveOnboardingAnswers,
} from "@/lib/onboarding";
import { activeNavUrl } from "@/components/app-sidebar";

function use(resolver: (ctx: QueryContext) => QueryResult) {
  io.client = createMockSupabase({ resolver });
}
const written = (ctx: QueryContext): QueryResult => (ctx.op === "update" ? { data: [{ id: "student-1" }], error: null } : { data: null, error: null });

beforeEach(() => {
  io.userId = "student-1";
  use(written);
});

describe("onboarding answers", () => {
  it("saves each answer scoped to the student's own profile and confirms the write", async () => {
    await saveOnboardingAnswers({ year_level: "year_12", graduation_year: 2026 });
    const update = io.client.queries.find((q) => q.op === "update")!;
    expect(update.table).toBe("profiles");
    expect(update.calls.find((c) => c.method === "update")!.args[0]).toMatchObject({ year_level: "year_12", graduation_year: 2026 });
    expect(update.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["id", "student-1"]]);
    expect(update.calls.at(-1)).toEqual({ method: "select", args: ["id"] });
  });

  it("fails rather than reporting success when no profile row was written", async () => {
    use((ctx) => (ctx.op === "update" ? { data: [], error: null } : { data: null, error: null }));
    await expect(saveOnboardingAnswers({ journey_stage: "applying" })).rejects.toThrow("Profile not found");
  });

  it("surfaces write errors and refuses signed-out callers", async () => {
    use(() => ({ data: null, error: { message: "offline" } }));
    await expect(completeOnboarding()).rejects.toThrow("offline");
    io.userId = null;
    await expect(dismissOnboarding()).rejects.toThrow("Not authenticated");
  });

  it("stamps completion and dismissal times", async () => {
    await completeOnboarding();
    await dismissOnboarding();
    const patches = io.client.queries.filter((q) => q.op === "update").map((q) => q.calls.find((c) => c.method === "update")!.args[0] as Record<string, unknown>);
    expect(typeof patches[0].onboarding_completed_at).toBe("string");
    expect(typeof patches[1].onboarding_dismissed_at).toBe("string");
  });

  it("reads the saved answers with empty lists instead of nulls", async () => {
    use(() => ({ data: { year_level: "year_11", student_status: null, journey_stage: null, preferred_countries: null, target_majors: ["Law", ""], graduation_year: null, onboarding_completed_at: null }, error: null }));
    expect(await fetchOnboardingProfile()).toMatchObject({ year_level: "year_11", preferred_countries: [], target_majors: ["Law"] });
  });
});

describe("onboarding helpers", () => {
  it("derives the final school year from the year level", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    expect(graduationYearFor("year_12", now)).toBe(2026);
    expect(graduationYearFor("year_11", now)).toBe(2027);
    expect(graduationYearFor("year_10", now)).toBe(2028);
    expect(graduationYearFor("finished", now)).toBeNull();
    expect(graduationYearFor("not_sure", now)).toBeNull();
  });

  it("merges choices without duplicates and never drops existing ones", () => {
    expect(mergeUnique(["Australia", "Law"], ["australia", "New Zealand", "New Zealand"])).toEqual(["Australia", "Law", "New Zealand"]);
  });
});

describe("navigation", () => {
  it.each([
    ["/today", "/today"],
    ["/shortlist", "/shortlist"],
    ["/applications/abc", "/applications"],
    ["/schools/42", "/schools"],
    ["/communities/saved", "/communities/saved"],
    ["/communities/abc", "/communities"],
    ["/profile", null],
    ["/dashboard", null],
    ["/scholarshipsx", null],
  ])("highlights only the best match for %s", (path, expected) => {
    expect(activeNavUrl(path)).toBe(expected);
  });
});
