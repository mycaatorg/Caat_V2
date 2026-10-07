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
  mayDeriveGraduationYear,
  mergeUnique,
  rankOnboardingMatches,
  saveOnboardingAnswers,
  type OnboardingProfile,
} from "@/lib/onboarding";
import type { ScholarshipRow } from "@/types/scholarships";
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

describe("graduation year derivation", () => {
  const now = new Date("2026-10-07T00:00:00Z");
  it("derives when none is stored, or when the stored year came from the stored year level", () => {
    expect(mayDeriveGraduationYear({ graduation_year: null, year_level: null }, now)).toBe(true);
    expect(mayDeriveGraduationYear({ graduation_year: 2026, year_level: "year_12" }, now)).toBe(true);
  });
  it("keeps a year the student entered themselves", () => {
    expect(mayDeriveGraduationYear({ graduation_year: 2030, year_level: "year_12" }, now)).toBe(false);
    expect(mayDeriveGraduationYear({ graduation_year: 2026, year_level: null }, now)).toBe(false);
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

describe("onboarding scholarship ranking", () => {
  const answers = (patch: Partial<OnboardingProfile>): OnboardingProfile => ({
    year_level: "year_12", student_status: "domestic", journey_stage: "applying", preferred_countries: ["Australia"],
    target_majors: [], graduation_year: 2026, onboarding_completed_at: null, ...patch,
  });
  const row = (id: string, citizenships: string[] | null, tags: string[] = []) =>
    ({ id, title: `Award ${id}`, provider_name: `Provider ${id}`, description: null, tags, country: "Australia", citizenships, study_level: ["undergraduate"], deadline_at: null }) as unknown as ScholarshipRow;
  const rows = [row("open", null), row("domestic", ["AU", "AU-PR"]), row("intl", ["INTERNATIONAL"])];

  it("ranks domestic-only awards above open ones for domestic students and leaves out international-only awards", () => {
    // Put the domestic award last so a tie could not explain the order.
    const ranked = rankOnboardingMatches(answers({ student_status: "domestic" }), [row("open", null), row("intl", ["INTERNATIONAL"]), row("domestic", ["AU", "AU-PR"])]);
    expect(ranked.map((r) => r.scholarship.id)).toEqual(["domestic", "open"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].reason).toMatch(/citizenship|nationality/);
  });

  it("leaves domestic-only awards out for international students", () => {
    const ids = rankOnboardingMatches(answers({ student_status: "international" }), rows).map((r) => r.scholarship.id);
    expect(ids).not.toContain("domestic");
    expect(ids).toEqual(expect.arrayContaining(["open", "intl"]));
  });

  it("shows at most two awards from one provider", () => {
    const many = ["a", "b", "c", "d"].map((id) => ({ ...row(id, null), provider_name: "Harbourside University" }) as unknown as ScholarshipRow);
    const other = { ...row("e", null), provider_name: "Banksia College" } as unknown as ScholarshipRow;
    const ids = rankOnboardingMatches(answers({}), [...many, other]).map((r) => r.scholarship.id);
    expect(ids).toEqual(["a", "b", "e"]);
  });

  it("keeps everything when the student is not sure, and prefers their interests", () => {
    const ranked = rankOnboardingMatches(answers({ student_status: "not_sure", target_majors: ["Engineering"] }), [...rows, row("eng", null, ["Engineering"])]);
    expect(ranked.map((r) => r.scholarship.id)).toHaveLength(4);
    expect(ranked[0].scholarship.id).toBe("eng");
  });
});
