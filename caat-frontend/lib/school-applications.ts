import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationStatus } from '@/types/applications';

export type SchoolApplicationRow = { id: string; school_id: number; status: ApplicationStatus };

/**
 * The owner's applications keyed by university (PROD-148), for saved course
 * cards. Personal data: never cache it. A failed read throws so the caller can
 * show Retry instead of offering to create an application that may exist.
 */
export async function loadSchoolApplications(client: SupabaseClient, userId: string): Promise<SchoolApplicationRow[]> {
  const { data, error } = await client.from('user_school_applications').select('id, school_id, status').eq('user_id', userId);
  if (error) throw new Error('Could not check your applications', { cause: error });
  return (data ?? []).map(row => ({ id: row.id as string, school_id: Number(row.school_id), status: row.status as ApplicationStatus }));
}
