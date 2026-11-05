// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { button, click, mountComponent, unmountAll } from './dom-helpers';
import type { ScholarshipRow } from '@/types/scholarships';
const io = vi.hoisted(() => ({ user: { id: 'student-a' } as { id: string } | null, from: vi.fn(), replace: vi.fn() }));
vi.mock('@/components/providers/AuthContext', () => ({ useAuth: () => ({ user: io.user }) }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { from: io.from } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: io.replace }), usePathname: () => '/scholarships', useSearchParams: () => new URLSearchParams() }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
import ScholarshipsClient from '@/app/(main)/scholarships/client';
const rows = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((title, index) => ({
 id: `award-${index}`, title, provider_name: 'Example Foundation', funding_type: [], study_level: [], field_of_study: [], citizenships: [], eligible_countries: [], excluded_countries: [], tags: [], eligible_genders: [], year_level: [],
 amount_value: 5000, amount_currency: 'AUD', amount_display: null, description: 'Recorded award', external_url: 'https://example.test/award',
 requires_essay: null, eligibility_summary: null, application_requirements: null, deadline_at: null, school_name: null, is_active: true,
 last_verified_at: null, source_last_synced_at: null, slug: null, external_id: null, awards_count: null, frequency: null,
 minimum_gpa: null, need_based: false, merit_based: false, country: null, state_region: null, application_open_at: null,
 start_term: null, is_recurring: false, is_featured: false, contact_info: null, raw_payload: null, created_at: '2026-01-01', updated_at: '2026-11-06',
} as ScholarshipRow));
const props = (page = rows) => ({ rows: page, totalCount: 4, currentPage: 1, itemsPerPage: 12, profile: null, initialBookmarkedIds: [], initialTracking: [], availableUniversities: [] });
const choose = (title: string) => button(new RegExp(`^Compare ${title} at Example Foundation, listing`));
beforeEach(() => { vi.clearAllMocks(); io.user = { id: 'student-a' }; });
afterEach(unmountAll);
describe('catalogue comparison controls', () => {
 it('limits selections, opens distinct table columns and clears without bookmark writes', async () => {
  await mountComponent(<ScholarshipsClient {...props()} />);
  expect(button('Compare selected scholarships').disabled).toBe(true);
  for (const title of ['Alpha', 'Beta', 'Gamma']) await click(choose(title));
  expect(choose('Delta').disabled).toBe(true);
  await click(button('Compare selected scholarships'));
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.querySelectorAll('thead th[scope="col"]')).toHaveLength(4);
  expect(dialog.querySelector('a[href="/scholarships/award-1"]')).not.toBeNull();
  await click(button('Close scholarship comparison'));
  await click(button('Remove Alpha, listing 1 from comparison'));
  expect(choose('Delta').disabled).toBe(false);
  await click(button('Clear scholarship comparison'));
  expect(button('Compare selected scholarships').disabled).toBe(true);
  expect(io.from).not.toHaveBeenCalled();
 });
 it('retains selected records after catalogue navigation and closes on account switch', async () => {
  function Harness() {
   const [page, setPage] = React.useState(rows.slice(0, 2));
   const [, refresh] = React.useState(0);
   return <><button onClick={() => setPage(rows.slice(2))}>Next fixture page</button><button onClick={() => { io.user = { id: 'student-b' }; refresh(n => n + 1); }}>Switch fixture account</button><ScholarshipsClient {...props(page)} /></>;
  }
  await mountComponent(<Harness />); await click(choose('Alpha')); await click(choose('Beta'));
  await click(button('Next fixture page')); await click(button('Compare selected scholarships'));
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Alpha');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Beta');
  await click(button('Switch fixture account'));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.body.textContent).not.toContain('Alpha');
  expect(button('Compare selected scholarships').disabled).toBe(true);
  expect(io.from).not.toHaveBeenCalled();
 });
});
