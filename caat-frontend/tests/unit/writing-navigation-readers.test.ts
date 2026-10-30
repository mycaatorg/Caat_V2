import { beforeEach, expect, it, vi } from 'vitest';
import { createMockSupabase } from './mock-supabase';
const io = vi.hoisted(() => ({ client: null as unknown as ReturnType<typeof createMockSupabase> }));
vi.mock('@/lib/supabase/client', () => ({ get supabase() { return io.client; } }));
import { fetchCustomPrompts } from '@/components/essays/api';
import { listResumes } from '@/components/resume-builder/api';

beforeEach(() => { vi.clearAllMocks(); });
for (const [table, read] of [['custom_essay_prompts', fetchCustomPrompts], ['resumes', listResumes]] as const) {
  it(`${table} keeps a late search destination available under a short server cap`, async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, title: `Title ${i}`, created_at: '2026-01-01', user_id: 'owner' }));
    io.client = createMockSupabase({ user: { id: 'owner' }, resolver: ctx => {
      const from = (ctx.calls.find(c => c.method === 'range')?.args[0] as number | undefined) ?? 0;
      return { data: rows.slice(from, from + 2), error: null };
    } });
    await expect(read()).resolves.toEqual(rows);
    expect(io.client.queries).toHaveLength(4);
    for (const query of io.client.queries) {
      expect(query.table).toBe(table);
      expect(query.calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
      expect(query.calls).toContainEqual({ method: 'order', args: ['id', { ascending: true }] });
    }
  });
  it(`${table} rejects a later failure instead of publishing an incomplete switcher`, async () => {
    io.client = createMockSupabase({ user: { id: 'owner' }, resolver: ctx => {
      const from = (ctx.calls.find(c => c.method === 'range')?.args[0] as number | undefined) ?? 0;
      return from === 0 ? { data: [{ id: 'first' }], error: null } : { data: null, error: { message: 'private database detail' } };
    } });
    await expect(read()).rejects.toThrow('Could not load all your');
  });
}
