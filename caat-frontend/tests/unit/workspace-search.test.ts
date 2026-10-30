import { expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readWorkspaceIndex, selectWorkspaceItems, type WorkspaceItem } from '@/lib/workspace-search';
import { createMockSupabase } from './mock-supabase';

it('reads complete owned metadata from every source even with short pages', async () => {
  const tables = ['user_school_applications', 'documents', 'essay_drafts', 'resumes'];
  const mock = createMockSupabase({ resolver: context => {
    const from = context.calls.find(call => call.method === 'range')?.args[0] as number;
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, schools: { name: 'Sydney', country: 'Australia' }, file_name: `File ${i}`, category: 'identity', prompt_id: 'prompt', label: `Essay ${i}`, title: `Resume ${i}` }));
    return { data: rows.slice(from, from + 2), error: null };
  } });
  const items = await readWorkspaceIndex(mock as unknown as SupabaseClient, 'owner');
  expect(items).toHaveLength(20);
  expect(items.find(item => item.kind === 'essay')?.href).toBe('/essays?prompt=prompt&draft=id-0');
  expect(items.find(item => item.kind === 'document')?.href).toBe('/documents?document=id-0');
  expect(items.find(item => item.kind === 'resume')?.href).toBe('/resume-builder?resume=id-0');
  expect(items.find(item => item.kind === 'application')?.href).toBe('/applications/id-0');
  const allowed: Record<string, string> = {
    user_school_applications: 'id, schools(name, country)', documents: 'id, file_name, category',
    essay_drafts: 'id, prompt_id, label', resumes: 'id, title',
  };
  for (const table of tables) expect(mock.queries.filter(q => q.table === table)).toHaveLength(4);
  for (const query of mock.queries) {
    expect(query.calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
    expect(query.calls).toContainEqual({ method: 'select', args: [allowed[query.table]] });
    expect(query.calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
  }
});

it('rejects all results on a late source error without leaking backend details', async () => {
  const mock = createMockSupabase({ resolver: context => {
    const from = context.calls.find(call => call.method === 'range')?.args[0];
    if (context.table === 'documents' && from !== 0) return { data: null, error: { message: 'private detail' } };
    return { data: from === 0 ? [{ id: 'one' }] : [], error: null };
  } });
  await expect(readWorkspaceIndex(mock as unknown as SupabaseClient, 'owner')).rejects.toThrow('Could not load your workspace. Try again.');
});

it('matches literal metadata, filters kinds, requires two characters and leaves the index intact', () => {
  const rows: WorkspaceItem[] = [
    { id: '2', kind: 'resume', title: 'Plan 100%_[]', detail: 'Resume', href: '/resume-builder?resume=2' },
    { id: '1', kind: 'document', title: 'Plan 100%_[]', detail: 'Identity', href: '/documents?document=1' },
    { id: '3', kind: 'essay', title: 'Other', detail: 'Essay draft', href: '/essays?prompt=1&draft=3' },
  ];
  expect(selectWorkspaceItems(rows, ' p ')).toEqual([]);
  expect(selectWorkspaceItems(rows, ' 100%_[] ')).toHaveLength(2);
  expect(selectWorkspaceItems(rows, 'PLAN', 'document').map(row => row.id)).toEqual(['1']);
  expect(selectWorkspaceItems(rows, 'Identity').map(row => row.id)).toEqual(['1']);
  expect(selectWorkspaceItems(rows, 'plan').map(row => row.id)).toEqual(['1', '2']);
  expect(rows.map(row => row.id)).toEqual(['2', '1', '3']);
});
