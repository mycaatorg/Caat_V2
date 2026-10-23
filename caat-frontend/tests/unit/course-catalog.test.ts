import { describe, expect, it } from 'vitest';
import { normalizeCourse, courseFreshness, formatCourseFee, loadCourseOfferings } from '@/lib/course-data';
import { createMockSupabase } from './mock-supabase';

const raw = (overrides: Record<string, unknown> = {}) => ({
  id: 'unsw-3778-kensington', institution_key: 'unsw', institution_name: 'UNSW Sydney', program_code: '3778',
  name: 'Bachelor of Science (Computer Science)', campus: 'Kensington', school_id: null, duration: '3 years',
  prerequisites: null, assumed_knowledge: 'Mathematics Extension 1', fee_amount: 8500, fee_year: 2026,
  fee_category: 'Domestic Commonwealth Supported Place', fee_basis: 'Indicative first 48 credit points; tuition only',
  source_url: 'https://www.unsw.edu.au/study/undergraduate/bachelor-of-computer-science', application_url: null,
  application_route: 'Domestic applications via UAC', prerequisites_url: null, uac_code: '425800',
  verified_at: '2026-10-23T00:00:00Z', source_year: 2026, active: true, ...overrides,
});

describe('course offering boundary', () => {
  it('keeps offerings sharing a UAC code distinct', () => {
    const first = normalizeCourse(raw());
    const second = normalizeCourse(raw({ id: 'unsw-3789-kensington', program_code: '3789' }));
    expect(first!.uac_code).toBe(second!.uac_code);
    expect(first!.id).not.toBe(second!.id);
  });
  it('preserves unknown prerequisites, fees and campus rather than inferring values', () => {
    const course = normalizeCourse(raw({ prerequisites: null, fee_amount: null, campus: null }))!;
    expect(course.prerequisites).toBeNull(); expect(course.campus).toBeNull();
    expect(formatCourseFee(course)).toBe('Fee not confirmed. Check the provider.');
  });
  it.each([-1, '8500', null, Number.NaN])('does not show an invalid fee amount %s', value => {
    expect(formatCourseFee(normalizeCourse(raw({ fee_amount: value }))!)).toContain('not confirmed');
  });
  it.each(['fee_year', 'fee_category', 'fee_basis'])('requires %s to make an amount meaningful', field => {
    expect(formatCourseFee(normalizeCourse(raw({ [field]: null }))!)).toContain('not confirmed');
  });
  it('keeps year, student category and basis attached to the quoted amount', () => {
    const text = formatCourseFee(normalizeCourse(raw())!);
    for (const term of ['8,500', '2026', 'Domestic', '48 credit points', 'tuition only']) expect(text).toContain(term);
  });
  it('rejects missing identity and unsafe provider links', () => {
    expect(normalizeCourse(raw({ id: '' }))).toBeNull();
    expect(normalizeCourse(raw({ source_url: 'javascript:alert(1)' }))).toBeNull();
    const course = normalizeCourse(raw({ application_url: 'data:text/html,bad', prerequisites_url: 'javascript:alert(1)' }))!;
    expect(course.application_url).toBeNull(); expect(course.prerequisites_url).toBeNull();
  });
  it('labels recent, stale, future and missing verification separately', () => {
    const now = new Date('2026-10-23T12:00:00Z');
    expect(courseFreshness('2026-10-23T00:00:00Z', now)).toBe('recent');
    expect(courseFreshness('2026-01-01T00:00:00Z', now)).toBe('stale');
    expect(courseFreshness('2026-10-24T00:00:00Z', now)).toBe('unverified');
    expect(courseFreshness(null, now)).toBe('unverified');
    expect(courseFreshness('2026-02-30', now)).toBe('unverified');
  });
  it('retains inactive offerings so existing bookmarks can still resolve', async () => {
    const client = createMockSupabase({ resolver: () => ({ data: [raw({ active: false })], error: null }) });
    const list = await loadCourseOfferings(client as never);
    expect(list).toHaveLength(1); expect(list[0].active).toBe(false);
  });
  it('never turns a failed catalogue read into an empty catalogue', async () => {
    const client = createMockSupabase({ resolver: () => ({ data: null, error: { message: 'offline' } }) });
    await expect(loadCourseOfferings(client as never)).rejects.toThrow('Could not load university courses');
  });
});
