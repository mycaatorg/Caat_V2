import { describe, it, expect } from "vitest";
import {
  reasonFor,
  matchScholarship,
  matchSchool,
  matchMajor,
  type MatchDimensions,
  type SchoolForMatch,
} from "@/lib/profile-match";
import type { ProfileRow } from "@/types/profile";
import type { ScholarshipRow } from "@/types/scholarships";
import type { Major } from "@/types/majors";

function dims(p: Partial<MatchDimensions> = {}): MatchDimensions {
  return {
    matchedMajor: null,
    matchedCountry: null,
    citizenshipEligible: false,
    levelMatches: false,
    ...p,
  };
}

function makeProfile(p: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "u1",
    first_name: null, last_name: null, email: null, birth_date: null,
    phone: null, linkedin: null, github: null, avatar_url: null,
    nationality: null, current_location: null, school_name: null,
    curriculum: null, graduation_year: null,
    target_majors: null, preferred_countries: null, activities: null,
    default_resume_id: null,
    ...p,
  };
}

function makeScholarship(s: Partial<ScholarshipRow> = {}): ScholarshipRow {
  return {
    id: "s1", slug: null, external_id: null, external_url: null,
    title: "Some Scholarship", provider_name: "Some Uni", description: null,
    amount_value: null, amount_currency: null, amount_display: null,
    awards_count: null, frequency: null,
    study_level: [], funding_type: [],
    eligible_countries: [], excluded_countries: [],
    citizenships: [], eligible_genders: [],
    minimum_gpa: null, requires_essay: null,
    need_based: false, merit_based: false,
    school_name: null, country: null, state_region: null,
    application_open_at: null, deadline_at: null, start_term: null,
    is_recurring: false, is_active: true, is_featured: false,
    last_verified_at: null, source_last_synced_at: null,
    tags: [], field_of_study: [], year_level: [], eligibility_summary: null,
    application_requirements: null, contact_info: null, raw_payload: null,
    created_at: "", updated_at: "",
    ...s,
  };
}

describe("reasonFor()", () => {
  it("returns null when no dimension matches", () => {
    expect(reasonFor(dims())).toBeNull();
  });

  it("returns null when only level matches (level alone is too thin)", () => {
    expect(reasonFor(dims({ levelMatches: true }))).toBeNull();
  });

  it("returns major-only template", () => {
    expect(reasonFor(dims({ matchedMajor: "Engineering" }))).toBe(
      "Matches your Engineering"
    );
  });

  it("returns country-only template with country name", () => {
    expect(reasonFor(dims({ matchedCountry: "Australia" }))).toBe(
      "In your preferred country (Australia)"
    );
  });

  it("returns citizenship-only template", () => {
    expect(reasonFor(dims({ citizenshipEligible: true }))).toBe(
      "Open to your nationality"
    );
  });

  it("returns major+country template", () => {
    expect(
      reasonFor(dims({ matchedMajor: "Computer Science", matchedCountry: "United States" }))
    ).toBe("Matches your Computer Science in your preferred country");
  });

  it("returns major+citizenship template", () => {
    expect(
      reasonFor(dims({ matchedMajor: "Engineering", citizenshipEligible: true }))
    ).toBe("Matches Engineering, open to internationals");
  });

  it("returns country+citizenship template", () => {
    expect(
      reasonFor(dims({ matchedCountry: "Australia", citizenshipEligible: true }))
    ).toBe("In your preferred country, open to your nationality");
  });

  it("returns 'Strong match' template when 3+ dimensions match", () => {
    expect(
      reasonFor(
        dims({
          matchedMajor: "Engineering",
          matchedCountry: "United States",
          levelMatches: true,
        })
      )
    ).toBe("Strong match: your major, country and level");
  });

  it("returns 'Strong match' template when all 4 dimensions match", () => {
    expect(
      reasonFor(
        dims({
          matchedMajor: "Engineering",
          matchedCountry: "United States",
          citizenshipEligible: true,
          levelMatches: true,
        })
      )
    ).toBe("Strong match: your major, country, citizenship and level");
  });

  it("strong-match label names only the dimensions that matched (no false country)", () => {
    // Regression: a profile whose preferred country does NOT match the school
    // but matches on major + citizenship + level used to render
    // 'your major, country and level', falsely claiming country. The label
    // must now omit country.
    expect(
      reasonFor(
        dims({
          matchedMajor: "Computer Science",
          matchedCountry: null,
          citizenshipEligible: true,
          levelMatches: true,
        })
      )
    ).toBe("Strong match: your major, citizenship and level");
  });

  it("strong-match label uses country+citizenship+level when major is absent", () => {
    expect(
      reasonFor(
        dims({
          matchedMajor: null,
          matchedCountry: "Australia",
          citizenshipEligible: true,
          levelMatches: true,
        })
      )
    ).toBe("Strong match: your country, citizenship and level");
  });
});

describe("matchScholarship()", () => {
  it("returns score 0, reason null for null profile", () => {
    expect(matchScholarship(null, makeScholarship())).toEqual({ score: 0, reason: null });
  });

  it("returns no match when profile is empty", () => {
    const result = matchScholarship(makeProfile(), makeScholarship());
    expect(result.score).toBe(0);
    expect(result.reason).toBeNull();
  });

  it("matches by major found in scholarship title", () => {
    const profile = makeProfile({ target_majors: ["Computer Science"] });
    const sch = makeScholarship({ title: "MIT Computer Science Award" });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(1);
    expect(result.reason).toBe("Matches your Computer Science");
  });

  it("matches by major found in description case-insensitively", () => {
    const profile = makeProfile({ target_majors: ["Engineering"] });
    const sch = makeScholarship({ title: "Generic Award", description: "Open to engineering students." });
    const result = matchScholarship(profile, sch);
    expect(result.reason).toBe("Matches your Engineering");
  });

  it("matches by country in preferred_countries", () => {
    const profile = makeProfile({ preferred_countries: ["United States", "Australia"] });
    const sch = makeScholarship({ country: "Australia" });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(1);
    expect(result.reason).toBe("In your preferred country (Australia)");
  });

  it("matches country case-insensitively (regression: 'australia' vs 'Australia')", () => {
    const profile = makeProfile({ preferred_countries: ["USA", "australia"] });
    const sch = makeScholarship({ country: "Australia" });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(1);
    expect(result.reason).toBe("In your preferred country (Australia)");
  });

  it("matches country via alias (USA -> United States)", () => {
    const profile = makeProfile({ preferred_countries: ["USA"] });
    const sch = makeScholarship({ country: "United States" });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(1);
    expect(result.reason).toBe("In your preferred country (United States)");
  });

  it("matches major + country", () => {
    const profile = makeProfile({
      target_majors: ["Engineering"],
      preferred_countries: ["United States"],
    });
    const sch = makeScholarship({
      title: "MIT Engineering Award",
      country: "United States",
    });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(2);
    expect(result.reason).toBe("Matches your Engineering in your preferred country");
  });

  it("identifies citizenship eligibility for international scholarship", () => {
    const profile = makeProfile({ nationality: "India" });
    const sch = makeScholarship({ citizenships: ["INTERNATIONAL"] });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(1);
    expect(result.reason).toBe("Open to your nationality");
  });

  it("treats empty citizenships array as 'no restriction' (not a match signal)", () => {
    const profile = makeProfile({ nationality: "India" });
    const sch = makeScholarship({ citizenships: [] });
    const result = matchScholarship(profile, sch);
    expect(result.reason).toBeNull();
  });

  it("matches Australian domestic code (AU)", () => {
    const profile = makeProfile({ nationality: "Australian" });
    const sch = makeScholarship({ country: "Australia", citizenships: ["AU"] });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.reason).not.toBeNull();
  });

  it("Strong match template when major + country + undergrad level all hit", () => {
    const profile = makeProfile({
      target_majors: ["Engineering"],
      preferred_countries: ["United States"],
      graduation_year: new Date().getFullYear() + 1,
    });
    const sch = makeScholarship({
      title: "Engineering Award",
      country: "United States",
      study_level: ["undergraduate"],
    });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(3);
    expect(result.reason).toBe("Strong match: your major, country and level");
  });

  it("level alone never triggers a match", () => {
    const profile = makeProfile({ graduation_year: new Date().getFullYear() + 1 });
    const sch = makeScholarship({ study_level: ["undergraduate"] });
    const result = matchScholarship(profile, sch);
    expect(result.score).toBe(0);
    expect(result.reason).toBeNull();
  });
});

describe("matchSchool()", () => {
  const school = (s: Partial<SchoolForMatch> = {}): SchoolForMatch => ({
    id: 1, name: "Some Uni", country: null, ...s,
  });

  it("returns no match for null profile", () => {
    expect(matchSchool(null, school())).toEqual({ score: 0, reason: null });
  });

  it("returns no match when school country not in preferred_countries", () => {
    const profile = makeProfile({ preferred_countries: ["United States"] });
    const result = matchSchool(profile, school({ country: "Canada" }));
    expect(result.score).toBe(0);
    expect(result.reason).toBeNull();
  });

  it("matches when school country IS in preferred_countries", () => {
    const profile = makeProfile({ preferred_countries: ["United States"] });
    const result = matchSchool(profile, school({ country: "United States" }));
    expect(result.score).toBe(1);
    expect(result.reason).toBe("In your preferred country (United States)");
  });

  it("matches major + country when offeredMajors include a target_major (case-insensitive)", () => {
    const profile = makeProfile({
      target_majors: ["Computer Science"],
      preferred_countries: ["United States"],
    });
    const result = matchSchool(
      profile,
      school({ country: "United States" }),
      ["computer science", "biology"]
    );
    expect(result.score).toBe(2);
    expect(result.reason).toBe("Matches your Computer Science in your preferred country");
  });

  it("country alone still counts if offeredMajors is undefined", () => {
    const profile = makeProfile({
      target_majors: ["Engineering"],
      preferred_countries: ["Australia"],
    });
    const result = matchSchool(profile, school({ country: "Australia" }));
    expect(result.score).toBe(1);
    expect(result.reason).toBe("In your preferred country (Australia)");
  });
});

describe("matchMajor()", () => {
  const major = (m: Partial<Major> = {}): Major => ({
    id: "m1", name: "Computer Science", category: "Engineering",
    description: null, career_paths: [], typical_coursework: [],
    qs_ranking_url: null, created_at: "", ...m,
  });

  it("returns no match for null profile", () => {
    expect(matchMajor(null, major())).toEqual({ score: 0, reason: null });
  });

  it("matches when major name appears in target_majors (case-insensitive)", () => {
    const profile = makeProfile({ target_majors: ["computer science"] });
    const result = matchMajor(profile, major({ name: "Computer Science" }));
    expect(result.score).toBe(1);
    expect(result.reason).toBe("Matches your Computer Science");
  });

  it("no match when target_majors don't include this major's name", () => {
    const profile = makeProfile({ target_majors: ["Biology"] });
    const result = matchMajor(profile, major({ name: "Computer Science" }));
    expect(result.score).toBe(0);
    expect(result.reason).toBeNull();
  });
});
