import type { SupabaseClient } from '@supabase/supabase-js';
import { evidencePages } from '@/lib/evidence-pagination';

export type WorkspaceKind = 'application' | 'document' | 'essay' | 'resume';
export type WorkspaceItem = { id: string; kind: WorkspaceKind; title: string; detail: string; href: string };
const READ_ERROR = 'Could not load your workspace. Try again.';

/** Metadata only: document locations and writing contents never enter this index. */
export async function readWorkspaceIndex(client: Pick<SupabaseClient, 'from'>, userId: string): Promise<WorkspaceItem[]> {
  if (!userId) throw new Error('Sign in to search your workspace.');
  const read = <T>(table: string, columns: string) => evidencePages<T>(async (from, to) => {
    const { data, error } = await client.from(table).select(columns).eq('user_id', userId)
      .order('id', { ascending: true }).range(from, to);
    return { data: data as unknown as T[] | null, error };
  }, READ_ERROR);
  const [applications, documents, essays, resumes] = await Promise.all([
    read<{ id: string; schools: { name: string; country: string | null } | null }>('user_school_applications', 'id, schools(name, country)'),
    read<{ id: string; file_name: string; category: string }>('documents', 'id, file_name, category'),
    read<{ id: string; prompt_id: string; label: string | null }>('essay_drafts', 'id, prompt_id, label'),
    read<{ id: string; title: string | null }>('resumes', 'id, title'),
  ]);
  const id = encodeURIComponent;
  return [
    ...applications.map(row => ({ id: row.id, kind: 'application' as const, title: row.schools?.name || 'Application', detail: row.schools?.country || 'University application', href: `/applications/${id(row.id)}` })),
    ...documents.map(row => ({ id: row.id, kind: 'document' as const, title: row.file_name, detail: row.category.replaceAll('_', ' '), href: `/documents?document=${id(row.id)}` })),
    ...essays.map(row => ({ id: row.id, kind: 'essay' as const, title: row.label || 'Untitled essay draft', detail: 'Essay draft', href: `/essays?prompt=${id(row.prompt_id)}&draft=${id(row.id)}` })),
    ...resumes.map(row => ({ id: row.id, kind: 'resume' as const, title: row.title || 'Untitled resume', detail: 'Resume', href: `/resume-builder?resume=${id(row.id)}` })),
  ];
}

export function selectWorkspaceItems(items: WorkspaceItem[], query: string, kind: WorkspaceKind | 'all' = 'all'): WorkspaceItem[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return items.filter(item => (kind === 'all' || item.kind === kind)
    && `${item.title} ${item.detail}`.toLowerCase().includes(term))
    .sort((a, b) => a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}
