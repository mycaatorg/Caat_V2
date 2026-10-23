import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeCourse } from "@/lib/course-data";
import { COURSE_MAJOR_LINKS, coursesForMajor, hasCourseLinks } from "@/lib/course-major-map";
import type { CourseOffering } from "@/types/courses";

// The seeded public catalogue (PROD-76). Every reviewed pair must point at a real offering.
const migration = readFileSync(join(__dirname, "../../supabase/migrations/20261023070000_course_offerings.sql"), "utf8");
const SEEDED_IDS = [...migration.matchAll(/^VALUES \('([^']+)'/gm)].map((m) => m[1]);

const offering = (id: string, active = true): CourseOffering => normalizeCourse({
  id, institution_key: "k", institution_name: `Institution ${id}`, program_code: id, name: `Course ${id}`,
  source_url: "https://example.edu.au/c", campus: "Main", active,
})!;
const catalogue = SEEDED_IDS.map((id) => offering(id));

describe("reviewed major-to-course mapping (PROD-148)", () => {
  it("parses the seeded catalogue", () => {
    expect(SEEDED_IDS).toEqual(expect.arrayContaining(["unsw-3778-kensington", "anu-aacom"]));
  });

  it("references only seeded course IDs", () => {
    for (const link of COURSE_MAJOR_LINKS) expect(SEEDED_IDS, link.courseId).toContain(link.courseId);
  });

  it("has no duplicate pairs, and every entry records when and why it was reviewed", () => {
    const pairs = COURSE_MAJOR_LINKS.map((l) => `${l.majorName}|${l.courseId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const link of COURSE_MAJOR_LINKS) {
      expect(link.reviewedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(link.note.trim().length).toBeGreaterThan(10);
      expect(link.majorName).toBe(link.majorName.trim());
    }
  });

  it("holds exactly the owner-approved Computer Science pairs", () => {
    expect(COURSE_MAJOR_LINKS.map((l) => [l.majorName, l.courseId])).toEqual([
      ["Computer Science", "unsw-3778-kensington"],
      ["Computer Science", "unsw-3789-kensington"],
      ["Computer Science", "sydney-bpadvcmp1000-camperdown"],
      ["Computer Science", "anu-aacom"],
    ]);
  });

  it("matches the major name exactly (after trimming), never by case, inner spacing or substring", () => {
    expect(coursesForMajor("Computer Science", catalogue).map((c) => c.id)).toEqual([
      "unsw-3778-kensington", "unsw-3789-kensington", "sydney-bpadvcmp1000-camperdown", "anu-aacom",
    ]);
    expect(coursesForMajor("  Computer Science ", catalogue)).toHaveLength(4);
    for (const name of ["computer science", "COMPUTER SCIENCE", "Computer  Science", "Computer", "Computer Science and Engineering", "Science"]) {
      expect(coursesForMajor(name, catalogue), name).toEqual([]);
      expect(hasCourseLinks(name), name).toBe(false);
    }
    expect(hasCourseLinks("Computer Science")).toBe(true);
  });

  it("shows nothing for an unmapped major", () => {
    expect(coursesForMajor("History", catalogue)).toEqual([]);
    expect(hasCourseLinks("History")).toBe(false);
  });

  it("silently drops a mapped course that is missing from the catalogue or inactive", () => {
    const partial = catalogue.filter((c) => c.id !== "anu-aacom").map((c) => (c.id === "unsw-3789-kensington" ? { ...c, active: false } : c));
    expect(coursesForMajor("Computer Science", partial).map((c) => c.id)).toEqual(["unsw-3778-kensington", "sydney-bpadvcmp1000-camperdown"]);
  });
});
