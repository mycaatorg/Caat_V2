import { expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMockSupabase } from './mock-supabase';
import { readWritingDesk, selectWriting, type WritingItem } from '@/lib/writing-desk';

it('loads all writing and context through short pages, with private ownership and metadata only', async () => {
  const projections: Record<string, string> = { essay_drafts: 'id, prompt_id, label, school_id, is_current, updated_at, schools(name)', resumes: 'id, title, updated_at', custom_essay_prompts: 'id, title', essay_prompts: 'id, title' };
  const mock = createMockSupabase({ resolver: q => {
    const from = q.calls.find(c => c.method === 'range')!.args[0] as number;
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, prompt_id: `id-${i}`, title: `${q.table} ${i}`, label: `Draft ${i}`, school_id: i ? 9 : null, schools: i ? { name: 'University' } : null, is_current: i === 0, updated_at: '2026-01-01T00:00:00Z' }));
    return { data: rows.slice(from, from + 2), error: null };
  } });
  const result = await readWritingDesk(mock as unknown as SupabaseClient, 'owner');
  expect(result).toHaveLength(10);
  expect(result.find(x => x.kind === 'essay' && x.id === 'id-4')).toMatchObject({ context: 'custom_essay_prompts 4', schoolId: '9', schoolName: 'University', href: '/essays?prompt=id-4&draft=id-4' });
  expect(result.find(x => x.kind === 'resume')?.isCurrent).toBeNull();
  for (const q of mock.queries) {
    expect(q.calls).toContainEqual({ method: 'select', args: [projections[q.table]] });
    expect(q.calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
    if (q.table !== 'essay_prompts') expect(q.calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
  }
  expect(mock.queries).toHaveLength(16);
});
it('keeps owned writing with unavailable context and rejects later source failure without partial results', async () => {
  let fail = false;
  const mock = createMockSupabase({ resolver: q => {
    const from = q.calls.find(c => c.method === 'range')!.args[0] as number;
    if (fail && q.table === 'custom_essay_prompts') return { data: null, error: { message: 'private detail' } };
    return { data: q.table === 'essay_drafts' && from === 0 ? [{ id: 'a', prompt_id: 'missing', label: null, school_id: 42, schools: null, is_current: false, updated_at: null }] : [], error: null };
  } });
  const result = await readWritingDesk(mock as unknown as SupabaseClient, 'owner');
  expect(result[0]).toMatchObject({ title: 'Untitled essay draft', context: 'Essay prompt unavailable', schoolName: 'University unavailable', schoolId: '42' });
  fail = true;
  await expect(readWritingDesk(mock as unknown as SupabaseClient, 'owner')).rejects.toThrow('Could not load your writing');
  await expect(readWritingDesk(mock as unknown as SupabaseClient, '')).rejects.toThrow('Sign in');
});
const item = (id: string, patch: Partial<WritingItem>): WritingItem => ({ id, kind: 'essay', title: `Draft ${id}`, context: 'Prompt', schoolId: null, schoolName: null, isCurrent: true, updatedAt: null, href: '/essays', ...patch });
it('combines literal filters without counting resumes as essay drafts and never mutates the source', () => {
  const rows = [item('a',{title:'100%_[x]',schoolId:'9',schoolName:'Sydney'}),item('b',{isCurrent:false}),item('c',{kind:'resume',isCurrent:null})];
  expect(selectWriting(rows,{query:' %_[x] ',school:'9'}).map(x=>x.id)).toEqual(['a']);
  expect(selectWriting(rows,{query:'sydney'}).map(x=>x.id)).toEqual(['a']);
  expect(selectWriting(rows,{status:'current'}).map(x=>x.id)).toEqual(['a']);
  expect(selectWriting(rows,{status:'other'}).map(x=>x.id)).toEqual(['b']);
  expect(selectWriting(rows,{kind:'resume',status:'current'})).toEqual([]);
  expect(selectWriting(rows,{school:'general'}).map(x=>x.id)).toEqual(['b','c']);
  expect(rows.map(x=>x.id)).toEqual(['a','b','c']);
});
it('sorts recent, oldest and title deterministically, with invalid dates always last', () => {
  const rows=[item('z',{updatedAt:'bad'}),item('c',{updatedAt:'2026-02-01'}),item('a',{updatedAt:'2026-01-01'}),item('b',{updatedAt:'2026-01-01'})];
  expect(selectWriting(rows,{}).map(x=>x.id)).toEqual(['c','a','b','z']);
  expect(selectWriting(rows,{sort:'oldest'}).map(x=>x.id)).toEqual(['a','b','c','z']);
  expect(selectWriting(rows,{sort:'title'}).map(x=>x.id)).toEqual(['a','b','c','z']);
});
