import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { loadCourseOfferings } from '@/lib/course-data';

/** Public provider metadata only. Personal saves are never cached here. */
export const getCourseOfferings = unstable_cache(async () => {
  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return loadCourseOfferings(client);
}, ['university-course-offerings-v1'], { revalidate: 3600, tags: ['course-catalog'] });
