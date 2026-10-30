import { expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readOwnedDocuments } from '@/lib/document-reader';
import { createMockSupabase } from './mock-supabase';

it('reads all owned documents across short pages with stable ordering', async () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: `doc-${i}`, user_id: 'owner' }));
  const mock = createMockSupabase({ resolver: context => {
    const from = context.calls.find(call => call.method === 'range')?.args[0] as number;
    return { data: rows.slice(from, from + 2), error: null };
  } });
  await expect(readOwnedDocuments(mock as unknown as SupabaseClient, 'owner')).resolves.toEqual(rows);
  expect(mock.queries).toHaveLength(4);
  for (const query of mock.queries) {
    expect(query.table).toBe('documents');
    expect(query.calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
    expect(query.calls.filter(call => call.method === 'order').map(call => call.args)).toEqual([
      ['uploaded_at', { ascending: false }], ['id', { ascending: true }],
    ]);
  }
});

it('rejects a later page error instead of returning partial document counts', async () => {
  const mock = createMockSupabase({ resolver: context => {
    const from = context.calls.find(call => call.method === 'range')?.args[0];
    return from === 0 ? { data: [{ id: 'first' }], error: null } : { data: null, error: { message: 'private backend detail' } };
  } });
  await expect(readOwnedDocuments(mock as unknown as SupabaseClient, 'owner')).rejects.toThrow('Could not load all your documents.');
});
