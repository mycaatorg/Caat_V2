import Link from 'next/link';
import { coursesForMajor, hasCourseLinks } from '@/lib/course-major-map';
import type { CourseOffering } from '@/types/courses';

/**
 * PROD-148: "University courses in CAAT" on a major page, from the reviewed
 * mapping only. Public catalogue data; nothing personal. No section when the
 * major has no reviewed courses; a failed catalogue read says so.
 */
export function MajorCourses({ majorName, courses }: { majorName: string; courses: CourseOffering[] | null }) {
  if (!hasCourseLinks(majorName)) return null;
  const linked = courses ? coursesForMajor(majorName, courses) : [];
  if (courses && linked.length === 0) return null;
  const heading = 'University courses in CAAT';
  return (
    <section aria-label={heading} className="border-b border-border py-6">
      <h2 className="text-[10px] font-code tracking-[0.18em] uppercase text-muted-foreground mb-4">{heading}</h2>
      {!courses ? (
        <p role="status" className="text-sm text-muted-foreground font-serif">Couldn&apos;t load university courses.</p>
      ) : (
        <>
          <ul className="border border-border divide-y divide-border">
            {linked.map((course) => (
              <li key={course.id} className="px-4 py-3 min-w-0">
                <Link href={`/courses?course=${encodeURIComponent(course.id)}`} className="text-sm font-serif hover:underline break-words">
                  {course.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {course.institution_name}{course.campus ? ` · ${course.campus}` : ''}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-3 font-serif">A reviewed starter list, not every course that teaches this major.</p>
        </>
      )}
    </section>
  );
}
