import { describe, it, expect } from "vitest";
import { calcCompletion, completionHint, formatDOB } from "@/lib/profile-utils";
import type { ProfileRow, StandardisedTestScore } from "@/types/profile";

// ── Helpers ────────────────────────────────────────────────────────────────────

function emptyProfile(): ProfileRow {
  return {
    id: "test-id",
    first_name: null,
    last_name: null,
    email: null,
    birth_date: null,
    phone: null,
    linkedin: null,
    github: null,
    avatar_url: null,
    nationality: null,
    current_location: null,
    school_name: null,
    curriculum: null,
    graduation_year: null,
    target_majors: null,
    preferred_countries: null,
  };
}

function fullProfile(): ProfileRow {
  return {
    id: "test-id",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    birth_date: "2000-01-15",
    phone: "+1234567890",
    linkedin: "https://linkedin.com/in/jane",
    github: "https://github.com/jane",
    avatar_url: "https://example.com/avatar.jpg",
    nationality: "Australian",
    current_location: "Sydney, AU",
    school_name: "Sydney High",
    curriculum: "IB",
    graduation_year: 2024,
    target_majors: ["Computer Science"],
    preferred_countries: ["Australia"],
  };
}

// ── calcCompletion ─────────────────────────────────────────────────────────────

describe("calcCompletion()", () => {
  it("returns 0 when profile is completely empty with no scores", () => {
    expect(calcCompletion(emptyProfile(), [])).toBe(0);
  });

  it("returns 100 when all 14 fields are filled and scores present", () => {
    const score = { id: "s1", profile_id: "test-id", curriculum: "IB", cumulative_score: "38", score_scale: "45", created_at: "", updated_at: "", subjects: [] };
    expect(calcCompletion(fullProfile(), [score])).toBe(100);
  });

  it("partial fill returns correct percentage (7/14 = 50%)", () => {
    const profile: ProfileRow = {
      ...emptyProfile(),
      first_name: "Jane",
      last_name: "Doe",
      birth_date: "2000-01-15",
      nationality: "Australian",
      current_location: "Sydney",
      phone: "+1234567890",
      linkedin: "https://linkedin.com/in/jane",
    };
    expect(calcCompletion(profile, [])).toBe(50);
  });

  it("counts target_majors array length > 0 as filled", () => {
    const profile = { ...emptyProfile(), target_majors: ["CS"] };
    const base = calcCompletion(emptyProfile(), []);
    expect(calcCompletion(profile, [])).toBeGreaterThan(base);
  });

  it("counts preferred_countries array length > 0 as filled", () => {
    const profile = { ...emptyProfile(), preferred_countries: ["AU"] };
    const base = calcCompletion(emptyProfile(), []);
    expect(calcCompletion(profile, [])).toBeGreaterThan(base);
  });

  it("counts scores array length > 0 as filled", () => {
    const score = { id: "s1", profile_id: "test-id", curriculum: "IB", cumulative_score: "38", score_scale: "45", created_at: "", updated_at: "", subjects: [] };
    const base = calcCompletion(emptyProfile(), []);
    expect(calcCompletion(emptyProfile(), [score])).toBeGreaterThan(base);
  });

  it("treats null, undefined, empty string fields as unfilled", () => {
    const profile: ProfileRow = { ...emptyProfile(), first_name: null, last_name: "" };
    expect(calcCompletion(profile, [])).toBe(0);
  });

  it("treats 0 graduation_year as unfilled (falsy)", () => {
    const profile: ProfileRow = { ...emptyProfile(), graduation_year: 0 };
    expect(calcCompletion(profile, [])).toBe(0);
  });

  it("treats non-zero graduation_year as filled", () => {
    const profile: ProfileRow = { ...emptyProfile(), graduation_year: 2024 };
    expect(calcCompletion(profile, [])).toBeGreaterThan(0);
  });
});

// ── completionHint ─────────────────────────────────────────────────────────────

describe("completionHint()", () => {
  it("returns encouraging message for 0%", () => {
    expect(completionHint(0)).toMatch(/personal and academic/i);
  });

  it("returns encouraging message for < 50%", () => {
    expect(completionHint(49)).toMatch(/personal and academic/i);
  });

  it("returns different message for exactly 50%", () => {
    expect(completionHint(50)).toMatch(/test scores/i);
  });

  it("returns different message for 50-79%", () => {
    expect(completionHint(79)).toMatch(/test scores/i);
  });

  it("returns near-complete message for 80%", () => {
    expect(completionHint(80)).toMatch(/almost there/i);
  });

  it("returns near-complete message for 80-99%", () => {
    expect(completionHint(99)).toMatch(/almost there/i);
  });

  it("returns completed message for 100%", () => {
    expect(completionHint(100)).toMatch(/complete/i);
  });
});

// ── formatDOB ──────────────────────────────────────────────────────────────────

describe("formatDOB()", () => {
  it("converts YYYY-MM-DD to DD/MM/YYYY", () => {
    expect(formatDOB("2000-01-15")).toBe("15/01/2000");
  });

  it("handles single-digit day/month correctly", () => {
    expect(formatDOB("1999-03-07")).toBe("07/03/1999");
  });

  it("returns empty string for empty input", () => {
    expect(formatDOB("")).toBe("");
  });

  it("returns empty string for null-like empty string", () => {
    expect(formatDOB("")).toBe("");
  });
});
