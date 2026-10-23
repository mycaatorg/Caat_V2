import { describe, expect, it } from 'vitest';
import {
  CHECKLIST_NOTICE,
  ITEM_KEY_PATTERN,
  requirementsChecklist,
  ruleKey,
  type ChecklistScholarship,
} from '@/lib/requirements-checklist';
import { explainEligibility, scholarshipSourceState } from '@/lib/scholarship-eligibility';
import type { ScholarshipRow } from '@/types/scholarships';

const now = new Date('2026-10-23T12:00:00Z');
function row(overrides: Partial<ChecklistScholarship> = {}): ChecklistScholarship {
  return {
    id: 's1',
    requires_essay: null,
    deadline_at: null,
    external_url: null,
    application_requirements: null,
    eligibility_summary: null,
    last_verified_at: null,
    source_last_synced_at: null,
    school_name: null,
    is_active: true,
    ...overrides,
  };
}
const build = (overrides: Partial<ChecklistScholarship> = {}) => requirementsChecklist(row(overrides), now);
const item = (overrides: Partial<ChecklistScholarship>, key: string) => build(overrides).items.find((i) => i.key === key)!;

describe('requirements checklist: fixed items from recorded fields', () => {
  it('lists the four fixed items in order with stable keys', () => {
    expect(build().items.map((i) => i.key)).toEqual(['separate-application', 'essay', 'deadline', 'official-link']);
  });

  it.each([
    [true, 'A separate scholarship application is required (recorded)', 'recorded'],
    [false, 'No separate application is required (recorded)', 'recorded'],
    [undefined, 'Not recorded whether a separate application is needed', 'not-recorded'],
    ['yes', 'Not recorded whether a separate application is needed', 'not-recorded'],
  ])('separate application flag %s', (flag, label, state) => {
    const reqs = flag === undefined ? {} : { separate_application_required: flag };
    const i = item({ application_requirements: reqs }, 'separate-application');
    expect(i.label).toBe(label);
    expect(i.state).toBe(state);
  });

  it('shows a recorded application mode as recorded text', () => {
    expect(item({ application_requirements: { application_mode: ' online form ' } }, 'separate-application').detail).toBe('Recorded application mode: online form');
    expect(item({ application_requirements: { application_mode: '' } }, 'separate-application').detail).toBeNull();
  });

  it.each([
    [true, 'An essay is required (recorded)', 'recorded'],
    [false, 'No essay is required (recorded)', 'recorded'],
    [null, 'Not recorded whether an essay is required', 'not-recorded'],
  ])('essay %s', (requires_essay, label, state) => {
    const i = item({ requires_essay }, 'essay');
    expect(i.label).toBe(label);
    expect(i.state).toBe(state);
  });

  it('deadline: future, past, missing, invalid and impossible dates', () => {
    expect(item({ deadline_at: '2026-12-01T00:00:00Z' }, 'deadline')).toMatchObject({ label: 'Closes 1 Dec 2026 (recorded)', state: 'recorded' });
    expect(item({ deadline_at: '2026-01-15' }, 'deadline')).toMatchObject({
      label: 'The recorded closing date (15 Jan 2026) has passed. Check whether it has reopened.', state: 'passed',
    });
    for (const deadline_at of [null, 'soon', '2026-02-30']) {
      expect(item({ deadline_at }, 'deadline')).toMatchObject({ label: 'No closing date recorded', state: 'not-recorded' });
    }
  });

  it('official link only when the recorded URL is safe', () => {
    expect(item({ external_url: 'https://provider.example/s' }, 'official-link')).toMatchObject({
      label: 'Read the official scholarship page', href: 'https://provider.example/s', state: 'recorded',
    });
    for (const external_url of [null, 'javascript:alert(1)', 'not a url']) {
      expect(item({ external_url }, 'official-link')).toMatchObject({ label: 'No safe official link recorded', href: null, state: 'not-recorded' });
    }
  });
});

describe('requirements checklist: every item states its source', () => {
  it('recorded values say Recorded; unknowns and rules say Check with the provider', () => {
    const recorded = build({ requires_essay: true, deadline_at: '2026-12-01', external_url: 'https://p.example', application_requirements: { separate_application_required: false } });
    for (const i of recorded.items) expect(i.source).toBe('Recorded');
    const unknown = build();
    for (const i of unknown.items) expect(i.source).toBe('Check with the provider');
    const rules = build({ application_requirements: { must_meet: ['Rule A'] } }).items.filter((i) => i.kind === 'rule');
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe('Check with the provider');
  });

  it('never defaults an unknown to "No"', () => {
    for (const i of build().items) {
      expect(i.label).not.toMatch(/^No (essay|separate)/);
      expect(i.state).not.toBe('recorded');
    }
  });
});

describe('requirements checklist: recorded rules', () => {
  it('turns must_meet strings into rules, dropping non-strings and blanks', () => {
    const rules = build({ application_requirements: { must_meet: ['  Rule one ', 7, '', '   ', null, 'Rule two'] } }).items.filter((i) => i.kind === 'rule');
    expect(rules.map((r) => r.label)).toEqual(['Recorded rule: Rule one', 'Recorded rule: Rule two']);
    expect(rules.every((r) => r.state === 'recorded')).toBe(true);
  });

  it('adds the summary and eligibility_text once each, deduped against each other and must_meet', () => {
    const labels = (o: Partial<ChecklistScholarship>) => build(o).items.filter((i) => i.kind === 'rule').map((r) => r.label);
    expect(labels({ eligibility_summary: 'Summary', application_requirements: { eligibility_text: 'Extra text', must_meet: ['Rule'] } }))
      .toEqual(['Recorded rule: Rule', 'Recorded rule: Extra text', 'Recorded rule: Summary']);
    expect(labels({ eligibility_summary: 'Same', application_requirements: { eligibility_text: ' Same ' } })).toEqual(['Recorded rule: Same']);
    expect(labels({ application_requirements: { eligibility_text: 'Rule', must_meet: ['Rule', 'Rule'] } })).toEqual(['Recorded rule: Rule']);
  });

  it('rule keys are stable under reordering and change with the text', () => {
    const keysOf = (must_meet: string[]) => build({ application_requirements: { must_meet } }).items.filter((i) => i.kind === 'rule').map((i) => i.key);
    const [a, b] = keysOf(['Rule A', 'Rule B']);
    expect(keysOf(['Rule B', 'Rule A'])).toEqual([b, a]);
    expect(ruleKey('Rule  A ')).toBe(a);
    expect(ruleKey('Rule A!')).not.toBe(a);
    expect(ruleKey('Rule A')).toBe(ruleKey('Rule A'));
  });

  it('every key matches the database CHECK pattern', () => {
    const all = build({ eligibility_summary: 'S', application_requirements: { must_meet: ['x', 'Ünïcödé rule', 'A'.repeat(5000)], eligibility_text: 'T' } }).items;
    for (const i of all) expect(i.key).toMatch(ITEM_KEY_PATTERN);
    expect(ITEM_KEY_PATTERN.source).toBe('^(separate-application|essay|deadline|official-link|rule:[a-z0-9]{8,64})$');
  });
});

describe('requirements checklist: source freshness', () => {
  it('a source older than 90 days carries a "Last checked <date>" stale label', () => {
    const c = build({ last_verified_at: '2026-04-06T00:00:00Z' });
    expect(c.freshness).toBe('stale');
    expect(c.staleLabel).toBe('Last checked 6 Apr 2026');
    for (const i of c.items) expect(i.sourceSuffix).toBe('as recorded 6 Apr 2026, stale');
  });

  it('a recent source has no stale label; a missing, future or invalid date is unverified', () => {
    expect(build({ last_verified_at: '2026-10-01T00:00:00Z' })).toMatchObject({ freshness: 'recent', staleLabel: null });
    for (const last_verified_at of [null, '2027-01-01T00:00:00Z', 'garbage', '2026-02-30']) {
      const c = build({ last_verified_at });
      expect(c.freshness).toBe('unverified');
      expect(c.staleLabel).toBeNull();
      expect(c.sourceNote).toBe('Source check date not recorded. Details may have changed.');
    }
  });

  it('agrees with explainEligibility for the same rows (shared helper)', () => {
    for (const last_verified_at of [null, '2026-10-20T00:00:00Z', '2026-04-06T00:00:00Z', '2027-01-01T00:00:00Z', '2026-02-30']) {
      const r = { id: 's1', last_verified_at, source_last_synced_at: '2026-10-22T00:00:00Z', external_url: 'https://p.example' } as ScholarshipRow;
      const fromEligibility = explainEligibility(null, r, now);
      const state = scholarshipSourceState(r, now);
      expect(state).toEqual({ sourceUrl: fromEligibility.sourceUrl, verifiedAt: fromEligibility.verifiedAt, syncedAt: fromEligibility.syncedAt, freshness: fromEligibility.freshness });
      expect(build({ last_verified_at }).freshness).toBe(fromEligibility.freshness);
    }
  });
});

describe('requirements checklist: what it never says', () => {
  const full = build({
    requires_essay: true,
    deadline_at: '2026-01-01',
    external_url: 'https://p.example',
    eligibility_summary: 'Summary text',
    last_verified_at: '2026-01-01T00:00:00Z',
    application_requirements: { separate_application_required: true, application_mode: 'online', must_meet: ['Rule'], eligibility_text: 'More' },
  });

  it('no item claims eligibility, admission, a match or a submission', () => {
    const text = full.items.flatMap((i) => [i.label, i.detail ?? '', i.source, i.sourceSuffix]).join('\n');
    expect(text).not.toMatch(/\b(eligib|qualif|admit|matched|submitted)/i);
  });

  it('the notice says completing the checklist is not submitting an application', () => {
    expect(CHECKLIST_NOTICE).toContain('Completing this checklist is not submitting an application');
    expect(CHECKLIST_NOTICE).not.toMatch(/\b(you are eligible|admitted)\b/i);
  });

  it('flags inactive rows and recorded institution, without reading any profile', () => {
    expect(build({ is_active: false }).inactive).toBe(true);
    expect(build({ school_name: ' Synthetic University ' }).recordedInstitution).toBe('Synthetic University');
    expect(build().recordedInstitution).toBeNull();
    expect(requirementsChecklist.length).toBe(2);
  });
});
