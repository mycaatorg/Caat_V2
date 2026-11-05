import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScholarshipRow } from '@/types/scholarships';

const state = vi.hoisted(() => ({ rows: [] as ScholarshipRow[] }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('@/components/public/PublicChrome', () => ({ PublicHeader: () => null, PublicFooter: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getBrowserClient: () => ({ auth: { getClaims: async () => ({ data: null }) } }) }));
vi.mock('@/lib/public-scholarships', () => ({
  getPublicScholarshipsBySlug: async (slug: string) => state.rows.filter((row) => row.slug === slug),
  getPublicScholarshipBySlug: async (slug: string, award?: string) => {
    const rows = state.rows.filter((row) => row.slug === slug);
    return award === undefined ? (rows.length === 1 ? rows[0] : null) : rows.find((row) => row.id === award) ?? null;
  },
  getRelatedScholarships: async () => [],
}));
import PublicScholarshipPage, { generateMetadata } from '@/app/scholarship/[slug]/page';
import { TrackScholarshipCta } from '@/components/public/TrackScholarshipCta';

const first: ScholarshipRow = {
  id: '11111111-1111-4111-8111-111111111111', slug: 'shared-award', title: 'First award', provider_name: 'First university',
  external_id: null, external_url: 'https://first.example/award', description: null,
  amount_value: 5000, amount_currency: 'AUD', amount_display: null, awards_count: null, frequency: null,
  study_level: [], funding_type: [], eligible_countries: [], excluded_countries: [], citizenships: [], eligible_genders: [],
  minimum_gpa: null, requires_essay: null, need_based: false, merit_based: false, school_name: null, country: null,
  state_region: null, application_open_at: null, deadline_at: '2027-01-01', start_term: null, is_recurring: false,
  is_active: true, is_featured: false, last_verified_at: null, source_last_synced_at: null, tags: [], field_of_study: [],
  year_level: [], eligibility_summary: null, application_requirements: null, contact_info: null, raw_payload: null,
  created_at: '2026-01-01', updated_at: '2026-11-01',
};
const second = { ...first, id: '22222222-2222-4222-8222-222222222222', title: 'Second award', provider_name: 'Second university', amount_value: 9000 };
const props = (award?: string | string[]) => ({ params: Promise.resolve({ slug: 'shared-award' }), searchParams: Promise.resolve(award === undefined ? {} : { award }) });
beforeEach(() => { state.rows = [first, second]; });

describe('public scholarship choice and selected detail', () => {
  it('shows both choices with distinct links for an ambiguous bare alias', async () => {
    const html = renderToStaticMarkup(await PublicScholarshipPage(props()));
    expect(html).toContain('Choose a scholarship');
    expect(html).toContain('First university');
    expect(html).toContain('Second university');
    expect(html).toContain(`/scholarship/shared-award?award=${first.id}`);
    expect(html).toContain(`/scholarship/shared-award?award=${second.id}`);
    expect((await generateMetadata(props())).title).toBe('Choose a scholarship');
  });

  it('aligns selected detail, canonical metadata, structured data and sign-up return', async () => {
    const html = renderToStaticMarkup(await PublicScholarshipPage(props(second.id)));
    const metadata = await generateMetadata(props(second.id));
    expect(metadata.title).toBe('Second award');
    expect(metadata.alternates?.canonical).toBe(`/scholarship/shared-award?award=${second.id}`);
    expect(html).toContain('Second university');
    expect(html).not.toContain('First university');
    expect(html).toContain(`https://www.mycaat.com/scholarship/shared-award?award=${second.id}`);
    expect(html).toContain(`/signup?next=${encodeURIComponent(`/scholarship/shared-award?award=${second.id}`)}`);
  });

  it.each(['missing-id', '', [first.id, second.id]])('rejects invalid or repeated selection %s without a fallback', async (award) => {
    state.rows = [first];
    await expect(PublicScholarshipPage(props(award))).rejects.toThrow('NOT_FOUND');
  });

  it('preserves the existing canonical URL for a single listing', async () => {
    state.rows = [first];
    expect((await generateMetadata(props())).alternates?.canonical).toBe('/scholarship/shared-award');
    expect(renderToStaticMarkup(await PublicScholarshipPage(props()))).toContain('First award');
  });

  it('retains record identity through the logged-out tracking link', () => {
    const html = renderToStaticMarkup(<TrackScholarshipCta slug="shared-award" scholarshipId={second.id} />);
    expect(html).toContain(`/signup?next=${encodeURIComponent(`/scholarship/shared-award?award=${second.id}`)}`);
  });
});
