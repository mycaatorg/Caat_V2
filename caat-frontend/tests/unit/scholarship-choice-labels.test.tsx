// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { ScholarshipChoices } from '@/components/public/ScholarshipChoices';
import type { ScholarshipRow } from '@/types/scholarships';

const render = (element: React.ReactElement) => { document.body.innerHTML = renderToStaticMarkup(element); };
const choices = () => document.querySelectorAll('h2 a');
const sources = () => document.querySelectorAll('a[target="_blank"]');
afterEach(() => { document.body.innerHTML = ''; });
const first = {
  id: 'record-one', slug: 'same-award', title: 'Shared Award', provider_name: 'North Foundation',
  amount_value: 5000, amount_currency: 'AUD', amount_display: null, deadline_at: '2027-06-01',
  is_active: true, external_url: 'https://north.example.test/award',
} as ScholarshipRow;
const second = { ...first, id: 'record-two', provider_name: 'South Foundation' };
const name = (provider: string, position: number) => `Shared Award — ${provider}, A$5,000, recorded deadline 1 June 2027, listing ${position} of 2`;

describe('scholarship choice accessible names', () => {
  it('includes the visible title and public facts when reading links outside their list', () => {
    render(<ScholarshipChoices scholarships={[first, second]} />);
    expect(choices()[0]).toHaveAccessibleName(name('North Foundation', 1));
    expect(choices()[0]).toHaveAttribute('href', '/scholarship/same-award?award=record-one');
    expect(choices()[1]).toHaveAccessibleName(name('South Foundation', 2));
    expect(choices()[1]).toHaveAttribute('href', '/scholarship/same-award?award=record-two');
  });

  it('distinguishes records even when every visible public fact is identical', () => {
    render(<ScholarshipChoices scholarships={[first, { ...first, id: second.id }]} />);
    expect(choices()[0]).toHaveAccessibleName(name('North Foundation', 1));
    expect(choices()[1]).toHaveAccessibleName(name('North Foundation', 2));
  });

  it('uses readable missing-fact text without exposing record IDs', () => {
    const missing = { ...first, provider_name: null, amount_value: null, deadline_at: 'invalid' } as unknown as ScholarshipRow;
    render(<ScholarshipChoices scholarships={[missing]} />);
    expect(choices()[0]).toHaveAccessibleName('Shared Award — provider not recorded, See Details, deadline not recorded, listing 1 of 1');
    expect(choices()[0]).not.toHaveAccessibleName(/record-one|Invalid Date|undefined|null/);
  });

  it('gives repeated official-source links their own listing context', () => {
    render(<ScholarshipChoices scholarships={[first, { ...first, id: second.id }]} />);
    expect(sources()[0]).toHaveAccessibleName(`Official scholarship page for ${name('North Foundation', 1)}`);
    expect(sources()[0]).toHaveAttribute('href', first.external_url);
    expect(sources()[1]).toHaveAccessibleName(`Official scholarship page for ${name('North Foundation', 2)}`);
  });
});
