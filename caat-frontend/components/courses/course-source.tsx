import { courseFreshness } from '@/lib/course-data';
import { safeHref } from '@/lib/safe-href';
import type { CourseOffering } from '@/types/courses';

export function ProviderLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const url = safeHref(href);
  return url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 break-words">{children}<span className="sr-only"> (opens in a new tab)</span></a> : null;
}

export function CourseSource({ course, checkedAt }: { course: CourseOffering; checkedAt: string }) {
  const freshness = courseFreshness(course.verified_at, new Date(checkedAt));
  return <div className="space-y-2 text-sm text-muted-foreground">
    {freshness === 'unverified' ? <p>Verification not confirmed. Check the provider.</p> : <p>
      Source checked <time dateTime={course.verified_at!}>{new Date(course.verified_at!).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>.
      {freshness === 'stale' ? ' More than 90 days ago; details may have changed.' : ' Confirm current requirements before applying.'}
    </p>}
    <ProviderLink href={course.source_url}>View official course details</ProviderLink>
  </div>;
}
