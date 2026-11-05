import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ScholarshipComparison from '@/components/scholarships/scholarship-comparison';
import type { ScholarshipRow } from '@/types/scholarships';
const now = new Date('2026-11-06T00:00:00Z');
const award = {
 id: 'award-one', title: 'Shared Award', provider_name: 'North Foundation', amount_value: 5000, amount_currency: 'AUD',
 amount_display: null, frequency: 'yearly', deadline_at: '2027-06-01', study_level: ['undergraduate'], field_of_study: ['Engineering'], citizenships: ['AU'],
 requires_essay: true, eligibility_summary: 'Recorded engineering requirement', application_requirements: null, school_name: null,
 external_url: 'https://north.example.test/award', last_verified_at: null, source_last_synced_at: '2026-11-05T00:00:00Z', is_active: true,
} as ScholarshipRow;
const html = (rows: ScholarshipRow[]) => renderToStaticMarkup(<ScholarshipComparison scholarships={rows} now={now} />);
describe('scholarship comparison facts', () => {
 it('keeps same-name awards in distinct columns with exact detail links and recorded facts', () => {
  const result = html([award, { ...award, id: 'award-two', provider_name: 'South Foundation', amount_value: 9000 }]);
  for (const value of ['North Foundation', 'South Foundation', 'A$5,000', 'A$9,000', '1 June 2027', 'Recorded engineering requirement', '/scholarships/award-one', '/scholarships/award-two']) expect(result).toContain(value);
  expect(result).toContain('<table'); expect(result).toContain('scope="col"'); expect(result).toContain('scope="row"');
 });
 it('keeps missing rules unknown and invalid dates unreadable as real dates', () => {
  const result = html([{ ...award, amount_value: null, deadline_at: '2027-02-30', frequency: null, requires_essay: null, study_level: [], field_of_study: [], citizenships: [], eligibility_summary: null }]);
  expect(result).toContain('Amount not recorded'); expect(result).toContain('Not recorded');
  expect(result).not.toContain('2 Mar 2027'); expect(result).not.toContain('No essay required'); expect(result).not.toContain('Open to everyone');
 });
 it('does not treat an import timestamp as verification or allow unsafe source links', () => {
  const result = html([{ ...award, external_url: 'javascript:alert(1)' }]);
  expect(result).toContain('Source check date not recorded'); expect(result).toContain('Importing is not a new verification');
  expect(result).not.toContain('href="javascript:'); expect(result).not.toContain('Source checked 5 Nov');
 });
 it('flags stale sources and inactive records without claiming eligibility', () => {
  const result = html([{ ...award, is_active: false, last_verified_at: '2025-01-01T00:00:00Z' }]);
  expect(result).toContain('over 90 days ago'); expect(result).toContain('No longer active');
  expect(result).not.toContain('You are eligible'); expect(result).toContain('does not confirm eligibility');
 });
 it('does not turn other recorded currencies or missing currencies into dollars', () => {
  const yen = html([{ ...award, amount_currency: 'JPY', amount_display: 'See details' }]);
  expect(yen).toContain('JPY 5,000'); expect(yen).not.toContain('$5,000');
  const unknown = html([{ ...award, amount_currency: null }]);
  expect(unknown).toContain('5,000 (currency not recorded)'); expect(unknown).not.toContain('$5,000');
 });
});
