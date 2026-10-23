// @vitest-environment jsdom
import React, { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { button, change, click, deferred, mountComponent, queryButton, unmountAll } from './dom-helpers';
import { normalizeCourse } from '@/lib/course-data';

const io = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, load: vi.fn(), save: vi.fn(), refresh: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/course-bookmarks', () => ({ loadCourseBookmarks: io.load, setCourseBookmark: io.save }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/providers/AuthContext', () => ({ useAuth: () => ({ user: io.user, loading: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: io.refresh }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a> }));
vi.mock('sonner', () => ({ toast: io.toast }));
import CoursesClient from '@/app/(main)/courses/client';

const courses = ['Alpha', 'Beta', 'Gamma', 'Delta'].map((name, i) => normalizeCourse({
  id: `course-${i}`, institution_key: 'example', institution_name: 'Example University', program_code: String(i), name,
  source_url: 'https://example.edu.au/course', verified_at: '2026-10-23T00:00:00Z', campus: 'Main', duration: '3 years', active: true,
  prerequisites: null, assumed_knowledge: 'Mathematics', fee_amount: i === 3 ? null : 8500, fee_year: i === 1 ? 2027 : 2026,
  fee_category: 'Domestic CSP', fee_basis: 'First year; tuition only',
})!);
const props = () => ({ courses, initialUserId: 'owner', initialSavedIds: [] as string[] | null, checkedAt: '2026-10-23T12:00:00Z' });
beforeEach(() => { vi.clearAllMocks(); io.user = { id: 'owner' }; io.load.mockResolvedValue([]); io.save.mockResolvedValue(undefined); });
afterEach(() => { unmountAll(); window.history.replaceState({}, '', '/courses'); });

describe('university course browser', () => {
  it('keeps the major explorer alongside explicit starter coverage and course unknowns', async () => {
    await mountComponent(<CoursesClient {...props()} />);
    expect(document.querySelector('a[href="/majors"]')?.textContent).toContain('Explore majors');
    expect(document.body.textContent).toContain('starter catalogue');
    expect(document.body.textContent).toContain('Prerequisites not confirmed');
    expect(document.body.textContent).toContain('Fee not confirmed');
  });
  it('limits comparison to three and preserves selection when search hides a card', async () => {
    await mountComponent(<CoursesClient {...props()} />);
    for (const name of ['Alpha', 'Beta', 'Gamma']) await click(button(`Compare ${name} at Example University`));
    expect(button('Compare Delta at Example University').disabled).toBe(true);
    await change(document.querySelector<HTMLInputElement>('#course-search')!, 'Delta');
    await click(button('Compare selected courses'));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Alpha'); expect(dialog.textContent).toContain('Beta'); expect(dialog.textContent).toContain('Gamma');
    expect(dialog.textContent).toContain('different years');
    expect(dialog.querySelectorAll('thead th[scope="col"]')).toHaveLength(4);
    await click(button('Close comparison'));
    await click(button('Remove Alpha from comparison'));
    expect(button('Compare Delta at Example University').disabled).toBe(false);
  });
  it('rolls back only a failed save while another succeeds and allows retry', async () => {
    const pending = deferred(); io.save.mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    await mountComponent(<CoursesClient {...props()} />);
    await click(button('Save Alpha')); await click(button('Save Beta'));
    expect(button('Remove Alpha from saved courses').disabled).toBe(true);
    await act(async () => pending.reject(new Error('offline')));
    expect(button('Save Alpha')).toBeTruthy(); expect(button('Remove Beta from saved courses')).toBeTruthy();
    await click(button('Save Alpha'));
    expect(button('Remove Alpha from saved courses')).toBeTruthy();
    expect(io.toast.error).toHaveBeenCalled();
  });
  it('preserves failed removals', async () => {
    io.save.mockRejectedValue(new Error('offline'));
    await mountComponent(<CoursesClient {...props()} initialSavedIds={['course-0']} />);
    await click(button('Remove Alpha from saved courses'));
    expect(button('Remove Alpha from saved courses')).toBeTruthy();
  });
  it('does not present a failed saved-list load as an empty list and supports retry', async () => {
    io.load.mockResolvedValue(['course-0']);
    await mountComponent(<CoursesClient {...props()} initialSavedIds={null} />);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load saved courses');
    expect(button('Save Alpha').disabled).toBe(true);
    await click(button('Retry saved courses'));
    expect(button('Remove Alpha from saved courses')).toBeTruthy();
  });
  it('shows only saved inactive courses with an unavailable label', async () => {
    const archived = courses.map((course, i) => ({ ...course, active: i > 1 }));
    await mountComponent(<CoursesClient {...props()} courses={archived} initialSavedIds={['course-0']} />);
    expect(document.body.textContent).toContain('No longer in the active catalogue');
    expect(button('Remove Alpha from saved courses')).toBeTruthy();
    expect(queryButton('Save Beta')).toBeNull();
  });
  it('discards previous-owner saves and ignores an old mutation result after account change', async () => {
    const mutation = deferred(); const read = deferred<string[]>();
    io.save.mockReturnValueOnce(mutation.promise); io.load.mockReturnValueOnce(read.promise);
    function Switcher() {
      const [, refresh] = React.useState(0);
      return <><button onClick={() => { io.user = { id: 'peer' }; refresh(n => n + 1); }}>Switch account</button><CoursesClient {...props()} initialSavedIds={['course-0']} /></>;
    }
    await mountComponent(<Switcher />);
    await click(button('Remove Alpha from saved courses'));
    await click(button('Switch account'));
    expect(queryButton('Remove Alpha from saved courses')).toBeNull();
    await act(async () => read.resolve(['course-1']));
    await act(async () => mutation.reject(new Error('old request failed')));
    expect(queryButton('Remove Alpha from saved courses')).toBeNull();
    expect(button('Remove Beta from saved courses')).toBeTruthy();
    expect(io.load).toHaveBeenCalledWith({}, 'peer');
  });
  it('shows a catalogue load failure with retry', async () => {
    await mountComponent(<CoursesClient {...props()} courses={null} />);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not load university courses');
    await click(button('Try again')); expect(io.refresh).toHaveBeenCalled();
  });
});
