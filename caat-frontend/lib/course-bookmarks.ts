import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadCourseBookmarks(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from('user_course_bookmarks').select('course_id').eq('user_id', userId);
  if (error) throw new Error('Could not load saved courses', { cause: error });
  return (data ?? []).map(row => row.course_id as string);
}

export async function setCourseBookmark(client: SupabaseClient, userId: string, courseId: string, saved: boolean): Promise<void> {
  if (!saved) {
    const { error } = await client.from('user_course_bookmarks').delete().eq('user_id', userId).eq('course_id', courseId);
    if (error) throw new Error('Could not remove course', { cause: error });
    return;
  }
  const result = await client.from('user_course_bookmarks').upsert({ user_id: userId, course_id: courseId }, { onConflict: 'user_id,course_id', ignoreDuplicates: true }).select('course_id');
  if (result.error) throw new Error('Could not save course', { cause: result.error });
  if (result.data?.some(row => row.course_id === courseId)) return;
  // DO NOTHING legitimately returns no row for an existing save; verify it exists.
  const existing = await client.from('user_course_bookmarks').select('course_id').eq('user_id', userId).eq('course_id', courseId).maybeSingle();
  if (existing.error || existing.data?.course_id !== courseId) throw new Error('Could not save course', { cause: existing.error });
}
