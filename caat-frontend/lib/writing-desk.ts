import type { SupabaseClient } from '@supabase/supabase-js';
import { evidencePages } from '@/lib/evidence-pagination';

export type WritingItem = {
  id: string; kind: 'essay' | 'resume'; title: string; context: string;
  schoolId: string | null; schoolName: string | null; isCurrent: boolean | null;
  updatedAt: string | null; href: string;
};
export type WritingFilters = {
  query?: string; kind?: 'all' | WritingItem['kind']; school?: string;
  status?: 'all' | 'current' | 'other'; sort?: 'recent' | 'oldest' | 'title';
};
const READ_ERROR = 'Could not load your writing. Please try again.';

/** Navigation metadata only; editor bodies and resume sections stay in their editors. */
export async function readWritingDesk(client: Pick<SupabaseClient, 'from'>, userId: string): Promise<WritingItem[]> {
  if (!userId) throw new Error('Sign in to see your writing.');
  const read = <T>(table: string, columns: string, owned = true) => evidencePages<T>(async (from, to) => {
    let query = client.from(table).select(columns);
    if (owned) query = query.eq('user_id', userId);
    const { data, error } = await query.order('id', { ascending: true }).range(from, to);
    return { data: data as unknown as T[] | null, error };
  }, READ_ERROR);
  type Draft = { id: string; prompt_id: string; label: string | null; school_id: number | null; schools: { name: string } | null; is_current: boolean; updated_at: string | null };
  type Prompt = { id: string; title: string };
  const [drafts, resumes, custom, shared] = await Promise.all([
    read<Draft>('essay_drafts', 'id, prompt_id, label, school_id, is_current, updated_at, schools(name)'),
    read<{ id: string; title: string | null; updated_at: string | null }>('resumes', 'id, title, updated_at'),
    read<Prompt>('custom_essay_prompts', 'id, title'),
    read<Prompt>('essay_prompts', 'id, title', false),
  ]);
  const titles = new Map([...shared, ...custom].map(prompt => [prompt.id, prompt.title]));
  const id = encodeURIComponent;
  return [
    ...drafts.map(row => ({ id: row.id, kind: 'essay' as const, title: row.label || 'Untitled essay draft', context: titles.get(row.prompt_id) || 'Essay prompt unavailable', schoolId: row.school_id === null ? null : String(row.school_id), schoolName: row.school_id === null ? null : row.schools?.name || 'University unavailable', isCurrent: row.is_current, updatedAt: row.updated_at, href: `/essays?prompt=${id(row.prompt_id)}&draft=${id(row.id)}` })),
    ...resumes.map(row => ({ id: row.id, kind: 'resume' as const, title: row.title || 'Untitled resume', context: 'Resume', schoolId: null, schoolName: null, isCurrent: null, updatedAt: row.updated_at, href: `/resume-builder?resume=${id(row.id)}` })),
  ];
}

export function selectWriting(items: WritingItem[], filters: WritingFilters): WritingItem[] {
  const term = (filters.query ?? '').trim().toLowerCase();
  const selected = items.filter(item =>
    (!filters.kind || filters.kind === 'all' || item.kind === filters.kind)
    && (!filters.school || filters.school === 'all' || (filters.school === 'general' ? item.schoolId === null : item.schoolId === filters.school))
    && (!filters.status || filters.status === 'all' || (item.kind === 'essay' && item.isCurrent === (filters.status === 'current')))
    && `${item.title} ${item.context} ${item.schoolName ?? ''}`.toLowerCase().includes(term));
  return selected.sort((a, b) => {
    if (filters.sort !== 'title') {
      const aTime = a.updatedAt ? Date.parse(a.updatedAt) : NaN, bTime = b.updatedAt ? Date.parse(b.updatedAt) : NaN;
      const aValid = Number.isFinite(aTime), bValid = Number.isFinite(bTime);
      if (aValid !== bValid) return aValid ? -1 : 1;
      if (aValid && aTime !== bTime) return filters.sort === 'oldest' ? aTime - bTime : bTime - aTime;
    }
    return a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
  });
}
