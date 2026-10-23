import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { explainEligibility } from '@/lib/scholarship-eligibility';
import EligibilityPanel from '@/components/scholarships/eligibility-panel';
import type { ScholarshipRow } from '@/types/scholarships';

const now = new Date('2026-10-23T12:00:00Z');
const profile = { nationality: 'Australian', student_status: 'domestic' as const };
function row(overrides: Partial<ScholarshipRow> = {}): ScholarshipRow {
  return { id: 's1', external_url: 'https://example.edu.au/scholarship', country: 'Australia',
    citizenships: ['AU'], eligible_countries: [], excluded_countries: [],
    study_level: [], field_of_study: [], year_level: [], eligible_genders: [],
    last_verified_at: '2026-10-20T00:00:00Z', source_last_synced_at: '2026-10-22T00:00:00Z',
    ...overrides } as ScholarshipRow;
}
function report(overrides: Partial<ScholarshipRow> = {}) { return explainEligibility(profile, row(overrides), now); }
function citizenship(overrides: Partial<ScholarshipRow> = {}) { return report(overrides).criteria.find(c => c.id === 'citizenship')!; }

describe('conservative scholarship criteria', () => {
  it('matches explicit Australian citizenship against a recent AU rule', () => {
    expect(citizenship().status).toBe('matched');
    expect(citizenship().reason).toContain('Australian');
  });
  it.each(['Australia and New Zealand', 'Aust.', 'New Zealand'])('keeps exclusions unconfirmed even with explicit AU citizenship: %s', exclusion => {
    const criterion = citizenship({ excluded_countries: [exclusion] });
    expect(criterion.status).toBe('unknown');
    expect(criterion.reason).toContain(exclusion);
  });
  it('retains recorded rules beside a positive result and a profile conflict', () => {
    expect(citizenship({ eligible_countries: ['Australia'] }).reason).toContain('Included countries: Australia.');
    const criterion = explainEligibility({ ...profile, student_status: 'international' }, row({ excluded_countries: ['New Zealand'] }), now).criteria.find(c => c.id === 'citizenship')!;
    expect(criterion.reason).toContain('Excluded countries: New Zealand.');
  });
  it('shows an explicit exclusion as unmet without declaring overall eligibility', () => {
    expect(citizenship({ citizenships: ['NZ'] }).status).toBe('unmet');
  });
  it('does not infer a citizenship match or exclusion from country fields alone', () => {
    expect(citizenship({ citizenships: [], eligible_countries: ['Australia'] }).status).toBe('unknown');
    expect(citizenship({ citizenships: [], excluded_countries: ['Australia'] }).status).toBe('unknown');
  });
  it('keeps a stale unmet rule unknown', () => {
    expect(citizenship({ citizenships: ['NZ'], last_verified_at: '2026-01-01' }).status).toBe('unknown');
  });
  it('uses an inclusive 90-day freshness boundary and offset timestamps', () => {
    const boundary = new Date(now.getTime() - 90 * 86400000).toISOString();
    expect(report({ last_verified_at: boundary.replace('Z', '+00:00') }).freshness).toBe('recent');
    expect(report({ last_verified_at: new Date(Date.parse(boundary) - 1).toISOString() }).freshness).toBe('stale');
  });
  it.each(['Austrian', 'New Zealander'])('does not infer rules for unsupported nationality %s', nationality => {
    expect(explainEligibility({ nationality }, row(), now).criteria.every(c => c.status === 'unknown')).toBe(true);
  });
  it('does not infer unrestricted eligibility from absent data or profile', () => {
    expect(citizenship({ citizenships: [] }).status).toBe('unknown');
    expect(explainEligibility(null, row(), now).criteria.every(c => c.status === 'unknown')).toBe(true);
  });
  it('does not infer citizenship from domestic status or permanent residency', () => {
    expect(explainEligibility({ nationality: null, student_status: 'domestic' }, row(), now).criteria.every(c => c.status === 'unknown')).toBe(true);
    expect(citizenship({ citizenships: ['AU-PR'] }).status).toBe('unknown');
    expect(citizenship({ citizenships: ['INTERNATIONAL'] }).status).toBe('unknown');
  });
  it('keeps conflicting rules and profile answers unknown', () => {
    expect(citizenship({ excluded_countries: ['AU'] }).status).toBe('unknown');
    expect(citizenship({ citizenships: ['NZ'], excluded_countries: ['New Zealand'] }).status).toBe('unknown');
    expect(citizenship({ eligible_countries: ['New Zealand'] }).status).toBe('unknown');
    expect(explainEligibility({ ...profile, student_status: 'international' }, row(), now).criteria.every(c => c.status === 'unknown')).toBe(true);
  });
  it.each([null, 'not-a-date', '2026-10-24T00:00:00Z', '2026-02-30', '2026-01-01T00:00:00Z'])('keeps eligibility unknown for unverified, invalid, future or stale date %s', date => {
    expect(report({ last_verified_at: date }).criteria.every(c => c.status === 'unknown')).toBe(true);
  });
  it('does not treat a fresh sync as verification', () => {
    expect(report({ last_verified_at: null }).freshness).toBe('unverified');
    expect(report({ last_verified_at: null }).syncedAt).toBe('2026-10-22T00:00:00.000Z');
  });
  it.each(['javascript:alert(1)', 'data:text/html,bad', null])('does not trust missing or unsafe source %s', url => {
    const r = report({ external_url: url }); expect(r.sourceUrl).toBeNull();
    expect(r.criteria.every(c => c.status === 'unknown')).toBe(true);
  });
  it('does not infer enrolment, grades or sensitive criteria from preference fields', () => {
    const r = report({ study_level: ['undergraduate'], field_of_study: ['Engineering'], year_level: ['1'],
      minimum_gpa: 3, eligible_genders: ['female'], need_based: true, school_name: 'Example University',
      eligibility_summary: 'Must live in a regional area', application_requirements: { must_meet: ['Submit a statement'] } });
    for (const id of ['study-level', 'field', 'year', 'gpa', 'gender', 'need', 'institution', 'summary', 'requirement-0']) {
      expect(r.criteria.find(c => c.id === id)?.status, id).toBe('unknown');
    }
  });
  it('handles legacy null arrays and malformed requirements without false matches or crashes', () => {
    const r = report({ citizenships: null, eligible_countries: null, application_requirements: { must_meet: [null, 42, 'Check the terms'] } } as unknown as Partial<ScholarshipRow>);
    expect(r.criteria.find(c => c.id === 'citizenship')?.status).toBe('unknown');
    expect(r.criteria.some(c => c.reason.includes('Check the terms'))).toBe(true);
  });
  it('preserves distinct free-text conditions alongside a summary and structured requirements', () => {
    const r = report({ eligibility_summary: 'Support for new students', application_requirements: {
      must_meet: ['Be enrolled'], eligibility_text: 'Applicants must reside in a regional area',
    } });
    expect(r.criteria.find(c => c.id === 'requirements-text')).toMatchObject({ status: 'unknown', reason: 'Applicants must reside in a regional area' });
  });
  it('keeps an unrecognized student-status answer unknown', () => {
    const r = explainEligibility({ nationality: 'Australian', student_status: 'unrecognized' }, row(), now);
    expect(r.criteria.every(c => c.status === 'unknown')).toBe(true);
  });
  it('counts every criterion and keeps an additional official requirements check', () => {
    const r = report();
    expect(r.counts.matched + r.counts.unmet + r.counts.unknown).toBe(r.criteria.length);
    expect(r.criteria.some(c => c.id === 'other' && c.status === 'unknown')).toBe(true);
  });
});

describe('eligibility panel', () => {
  it('renders the explanation, outstanding checks, source and verification date', () => {
    const html = renderToStaticMarkup(<EligibilityPanel report={report()} />);
    expect(html).toContain('Check your eligibility');
    expect(html).toContain('Matches your profile'); expect(html).toContain('Needs checking');
    expect(html).toContain('20 October 2026'); expect(html).toContain('https://example.edu.au/scholarship');
    expect(html).toContain('The provider decides eligibility');
  });
  it('explains old verification and absent source rather than displaying a green result', () => {
    const html = renderToStaticMarkup(<EligibilityPanel report={report({ last_verified_at: '2026-01-01', external_url: 'javascript:alert(1)' })} />);
    expect(html).toContain('more than 90 days'); expect(html).toContain('Source link unavailable');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('Matches your profile');
  });
});
