import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentRow } from '@/app/(main)/documents/api';
import { evidencePages } from '@/lib/evidence-pagination';

/** Shared by server first paint and client recovery so neither publishes partial counts. */
export function readOwnedDocuments(client: Pick<SupabaseClient, 'from'>, userId: string): Promise<DocumentRow[]> {
  return evidencePages<DocumentRow>((from, to) => client
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false })
    .order('id', { ascending: true })
    .range(from, to), 'Could not load all your documents.');
}
