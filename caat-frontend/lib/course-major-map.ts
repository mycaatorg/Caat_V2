/**
 * PROD-148: reviewed links from a major to specific catalogue courses.
 *
 * This list is the review step: each pair is an editorial call approved by the
 * owner (plan docs/superpowers/plans/2026-10-23-opportunity-requirements.md,
 * Task 0 gate; spec section C). There is no inference: no fuzzy, category or
 * `school_majors` matching. A major name must equal `majors.name` exactly
 * (case-sensitive, inner spacing included; only leading/trailing whitespace is
 * trimmed). Course IDs must exist in the seeded catalogue
 * (supabase/migrations/20261023070000_course_offerings.sql); a unit test fails
 * otherwise.
 *
 * The proposed Commerce/Business -> `unsw-3502-kensington` pair is NOT here.
 * Neither "Commerce" nor "Business" exists as a major name in the checked-in
 * majors seed (supabase/seeds/majors_seed.sql has "Business Administration",
 * "Finance", "Accounting", "Economics"), and the plan says a missing name drops
 * its pair rather than re-pointing it. Add it back only after the exact
 * production name is confirmed.
 *
 * Revisit with a `course_offering_majors` table once the catalogue has ingestion.
 */
import type { CourseOffering } from '@/types/courses';

export type CourseMajorLink = { courseId: string; majorName: string; reviewedOn: string; note: string };

export const COURSE_MAJOR_LINKS: readonly CourseMajorLink[] = [
  {
    courseId: 'unsw-3778-kensington',
    majorName: 'Computer Science',
    reviewedOn: '2026-10-23',
    note: 'UNSW names program 3778 "Bachelor of Science (Computer Science)"; source https://www.unsw.edu.au/study/undergraduate/bachelor-of-computer-science',
  },
  {
    courseId: 'unsw-3789-kensington',
    majorName: 'Computer Science',
    reviewedOn: '2026-10-23',
    note: 'UNSW program 3789 is the Computer Science stream of the Science / Science double degree; source https://www.unsw.edu.au/study/undergraduate/bachelor-of-science-computer-science',
  },
  {
    courseId: 'sydney-bpadvcmp1000-camperdown',
    majorName: 'Computer Science',
    reviewedOn: '2026-10-23',
    note: 'Editorial call approved by the owner: Sydney\'s Bachelor of Advanced Computing is its computing degree; source https://www.sydney.edu.au/content/courses/courses/uc/bachelor-of-advanced-computing.html',
  },
  {
    courseId: 'anu-aacom',
    majorName: 'Computer Science',
    reviewedOn: '2026-10-23',
    note: 'Editorial call approved by the owner: ANU\'s Bachelor of Advanced Computing (Honours) is its computing degree; source https://programsandcourses.anu.edu.au/2027/program/aacom',
  },
];

/** True when the major has at least one reviewed course (exact name match). */
export function hasCourseLinks(majorName: string): boolean {
  const name = majorName.trim();
  return COURSE_MAJOR_LINKS.some((link) => link.majorName === name);
}

/** The reviewed, active catalogue courses for a major, in mapping order.
 *  Unknown or inactive course IDs are silently left out. */
export function coursesForMajor(majorName: string, catalogue: readonly CourseOffering[]): CourseOffering[] {
  const name = majorName.trim();
  const byId = new Map(catalogue.map((course) => [course.id, course]));
  return COURSE_MAJOR_LINKS.flatMap((link) => {
    if (link.majorName !== name) return [];
    const course = byId.get(link.courseId);
    return course && course.active ? [course] : [];
  });
}
