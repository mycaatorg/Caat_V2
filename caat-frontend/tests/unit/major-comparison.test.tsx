import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const source = vi.hoisted(() => ({
  id: 'engineering', name: 'Engineering', category: 'Engineering', description: 'Design useful systems',
  career_paths: ['Civil engineer'], typical_coursework: ['Fluid mechanics'], qs_ranking_url: null, created_at: '2026-01-01',
}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => ({
  select: (columns: string) => ({ order: async () => ({ data: [Object.fromEntries(columns.split(',').map(key => [key.trim(), source[key.trim() as keyof typeof source]]))] }) }),
}) }) }));
import { getMajorsList } from '@/lib/majors-catalog';
import CompareTable from '@/components/majors/compare-table';

describe('major catalogue comparison', () => {
  it('renders careers and coursework returned by the real catalogue loader', async () => {
    const majors = await getMajorsList();
    const html = renderToStaticMarkup(<CompareTable majors={majors} />);
    expect(html).toContain('Civil engineer');
    expect(html).toContain('Fluid mechanics');
  });
  it('explains when career and coursework data are unavailable', async () => {
    const majors = await getMajorsList();
    const html = renderToStaticMarkup(<CompareTable majors={majors.map(m => ({ ...m, career_paths: [], typical_coursework: [] }))} />);
    expect(html).toContain('Career information not available');
    expect(html).toContain('Coursework information not available');
  });
});
