import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockSupabase, type QueryContext } from './mock-supabase';

const client = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => client.current }));
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }));
import { getPublicScholarshipSlugs } from '@/lib/public-scholarships';
import sitemap from '@/app/sitemap';

const at = '2026-11-01T12:00:00Z';
const offset = (query: QueryContext) => Number(query.calls.find((call) => call.method === 'range')?.args[0] ?? 0);
const catalogue = ['award-a', 'award-b', 'award-c', 'award-d'].map((slug) => ({ slug, updated_at: at }));
beforeEach(() => { client.current = null; });

describe('public scholarship sitemap completeness', () => {
  it.each([3, 4])('includes all %i scholarship URLs under a two-row API cap', async (size) => {
    const rows = catalogue.slice(0, size);
    const sb = createMockSupabase({ resolver: (query) => ({ data: rows.slice(offset(query), offset(query) + 2), error: null }) });
    client.current = sb;

    const entries = await sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname).filter((path) => path.startsWith('/scholarship/'));

    expect(paths).toEqual(size === 3
      ? ['/scholarship/award-a', '/scholarship/award-b', '/scholarship/award-c']
      : ['/scholarship/award-a', '/scholarship/award-b', '/scholarship/award-c', '/scholarship/award-d']);
    expect(sb.queries.map(offset)).toEqual(size === 3 ? [0, 2, 3] : [0, 2, 4]);
  });

  it('orders tied timestamps by unique ID and keeps public catalogue filters', async () => {
    const sb = createMockSupabase({ resolver: () => ({ data: [], error: null }) });
    client.current = sb;
    expect(await getPublicScholarshipSlugs()).toEqual([]);
    const query = sb.queries[0];
    expect(query.table).toBe('scholarships');
    expect(query.calls).toContainEqual({ method: 'select', args: ['slug, updated_at'] });
    expect(query.calls).toContainEqual({ method: 'eq', args: ['is_active', true] });
    expect(query.calls).toContainEqual({ method: 'not', args: ['slug', 'is', null] });
    expect(query.calls.filter((call) => call.method === 'order')).toEqual([
      { method: 'order', args: ['updated_at', { ascending: false }] },
      { method: 'order', args: ['id', { ascending: true }] },
    ]);
  });

  it('rejects a later page failure and returns only static routes, never a partial catalogue', async () => {
    const sb = createMockSupabase({ resolver: (query) => offset(query) === 0
      ? { data: catalogue.slice(0, 2), error: null }
      : { data: null, error: { message: 'Catalogue unavailable' } } });
    client.current = sb;

    await expect(getPublicScholarshipSlugs()).rejects.toThrow();
    const entries = await sitemap();
    expect(entries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/', '/scholarship', '/signup', '/login', '/help', '/contact', '/privacy', '/terms',
    ]);
  });

  it('advances past rows with empty slugs without publishing empty detail URLs', async () => {
    const rows = [{ slug: '', updated_at: at }, { slug: null, updated_at: at }, catalogue[0]];
    const sb = createMockSupabase({ resolver: (query) => ({ data: rows.slice(offset(query), offset(query) + 2), error: null }) });
    client.current = sb;

    expect(await getPublicScholarshipSlugs()).toEqual([{ slug: 'award-a', updated_at: at }]);
    expect(sb.queries.map(offset)).toEqual([0, 2, 3]);
  });
});
