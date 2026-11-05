import { describe, expect, it, vi } from 'vitest';
import { createMockSupabase, type QueryContext } from './mock-supabase';

const client = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => client.current }));
vi.mock('next/cache', () => ({ unstable_cache: <T>(fn: T) => fn }));
import { getPublicScholarshipBySlug } from '@/lib/public-scholarships';
import sitemap from '@/app/sitemap';

const first = { id: '11111111-1111-4111-8111-111111111111', slug: 'shared-award', title: 'First award', provider_name: 'First university', updated_at: '2026-11-01T12:00:00Z' };
const second = { ...first, id: '22222222-2222-4222-8222-222222222222', title: 'Second award', provider_name: 'Second university' };
function fixture(rows: typeof first[], failAfterFirst = false) {
  const sb = createMockSupabase({ resolver: (query: QueryContext) => {
    const from = Number(query.calls.find((call) => call.method === 'range')?.args[0] ?? 0);
    if (failAfterFirst && from > 0) return { data: null, error: { message: 'Later page unavailable' } };
    let selected = rows;
    for (const call of query.calls.filter((call) => call.method === 'eq')) {
      if (call.args[0] === 'slug') selected = selected.filter((r) => r.slug === call.args[1]);
      if (call.args[0] === 'id') selected = selected.filter((r) => r.id === call.args[1]);
    }
    if (query.calls.some((call) => call.method === 'maybeSingle')) {
      return selected.length > 1 ? { data: null, error: { message: 'Multiple rows returned' } } : { data: selected[0] ?? null, error: null };
    }
    return { data: selected.slice(from, from + 1), error: null };
  } });
  client.current = sb;
  return sb;
}

describe('public scholarship record identity', () => {
  it('does not crash or arbitrarily select a row for an ambiguous bare slug', async () => {
    fixture([first, second]);
    expect(await getPublicScholarshipBySlug('shared-award')).toBeNull();
  });

  it('loads the exact selected award within a shared slug', async () => {
    fixture([first, second]);
    expect(await getPublicScholarshipBySlug('shared-award', second.id)).toMatchObject({ id: second.id, title: 'Second award' });
  });

  it('never falls back to a different row when the selected award does not match', async () => {
    fixture([first]);
    expect(await getPublicScholarshipBySlug('shared-award', second.id)).toBeNull();
    expect(await getPublicScholarshipBySlug('another-slug', first.id)).toBeNull();
  });

  it('keeps existing single-listing bare links working', async () => {
    fixture([first]);
    expect(await getPublicScholarshipBySlug('shared-award')).toMatchObject({ id: first.id });
  });

  it('does not publish a partial choice when a later alias page fails', async () => {
    fixture([first, second], true);
    await expect(getPublicScholarshipBySlug('shared-award', first.id)).rejects.toThrow('Could not load the scholarship listings.');
  });

  it('gives duplicate sitemap slugs distinct record URLs and preserves unique bare URLs', async () => {
    fixture([first, second, { ...first, id: '33333333-3333-4333-8333-333333333333', slug: 'unique-award' }]);
    const paths = (await sitemap()).map((entry) => new URL(entry.url)).filter((url) => url.pathname.startsWith('/scholarship/')).map((url) => url.pathname + url.search);
    expect(paths).toEqual([
      `/scholarship/shared-award?award=${first.id}`,
      `/scholarship/shared-award?award=${second.id}`,
      '/scholarship/unique-award',
    ]);
  });
});
