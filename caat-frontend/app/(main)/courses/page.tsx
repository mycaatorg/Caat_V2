import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { createServerClient } from '@/lib/supabase/server';
import { getCourseOfferings } from '@/lib/course-catalog';
import { loadCourseBookmarks } from '@/lib/course-bookmarks';
import CoursesClient from './client';

export const metadata = { title: 'University courses' };

export default async function CoursesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['q', 'saved', 'course']) if (typeof params[key] === 'string') query.set(key, params[key]);
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login?next=/courses');
  const [courses, saved] = await Promise.all([
    getCourseOfferings().catch(() => null),
    loadCourseBookmarks(client, user.id).catch(() => null),
  ]);
  return <><PageHeader title="Courses" /><CoursesClient courses={courses} initialUserId={user.id} initialSavedIds={saved} checkedAt={new Date().toISOString()} initialQuery={query.toString()} /></>;
}
