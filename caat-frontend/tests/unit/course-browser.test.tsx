// @vitest-environment jsdom
import React, { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { button, change, click, deferred, mountComponent, queryButton, unmountAll } from './dom-helpers';
import { loadCourseOfferings, normalizeCourse } from '@/lib/course-data';
import { createMockSupabase } from './mock-supabase';

const io = vi.hoisted(() => ({ user: { id: 'owner' } as { id: string } | null, load: vi.fn(), save: vi.fn(), start: vi.fn(), loadApps: vi.fn(), refresh: vi.fn(), toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/course-bookmarks', () => ({ loadCourseBookmarks: io.load, setCourseBookmark: io.save }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/application-for-school', () => ({ startApplicationForSchool: io.start }));
vi.mock('@/lib/school-applications', () => ({ loadSchoolApplications: io.loadApps }));
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
const props = () => ({ courses, initialUserId: 'owner', initialSavedIds: [] as string[] | null, initialApplications: [] as { id: string; school_id: number; status: 'researching' | 'applying' }[] | null, checkedAt: '2026-10-23T12:00:00Z' });
beforeEach(() => { vi.clearAllMocks(); io.user = { id: 'owner' }; io.load.mockResolvedValue([]); io.save.mockResolvedValue(undefined); io.loadApps.mockResolvedValue([]); });
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
    expect(dialog.querySelector('[role="region"][aria-label="Scroll course comparison horizontally"] table')).not.toBeNull();
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
  it('deep links to one course and clears back to the full list', async () => {
    await mountComponent(<CoursesClient {...props()} initialQuery="course=course-1" />);
    expect(document.querySelectorAll('article')).toHaveLength(1);
    expect(document.querySelector('article')?.getAttribute('aria-label')).toBe('Beta at Example University');
    await click(button('Show all courses'));
    expect(document.querySelectorAll('article')).toHaveLength(4);
    expect(window.location.search).toBe('');
  });
  it('shows a deep-linked inactive course while saved courses are unavailable', async () => {
    io.load.mockReturnValue(new Promise(() => {}));
    const archived = courses.map((course, i) => ({ ...course, active: i !== 0 }));
    await mountComponent(<CoursesClient {...props()} courses={archived} initialSavedIds={null} initialQuery="course=course-0" />);
    expect(document.body.textContent).not.toContain('No courses match');
    expect(document.querySelector('article')?.getAttribute('aria-label')).toBe('Alpha at Example University');
    expect(document.body.textContent).toContain('No longer in the active catalogue');
  });
  it('fails the whole catalogue load when any row is invalid rather than dropping it', async () => {
    const valid = { ...courses[0], verified_at: '2026-10-23T00:00:00Z' };
    const client = createMockSupabase({ resolver: () => ({ data: [valid, { ...valid, id: 'bad', source_url: 'javascript:alert(1)' }], error: null }) });
    await expect(loadCourseOfferings(client as never)).rejects.toThrow('Could not load university courses');
  });
});

describe('track an application from a saved course (PROD-148)', () => {
  // Alpha and Beta are at school 7; Gamma has no linked university.
  const linked = courses.map((c, i) => ({ ...c, school_id: i < 2 ? 7 : null }));
  const TRACK = 'Track an application at Example University';
  const tracks = () => [...document.querySelectorAll<HTMLButtonElement>('button')].filter(b => b.textContent === TRACK);
  type Started = { application: { id: string; status: string }; created: boolean };

  it('shows no action on unsaved cards and never starts one on mount or save', async () => {
    await mountComponent(<CoursesClient {...props()} courses={linked} />);
    expect(tracks()).toHaveLength(0);
    await click(button('Save Alpha'));
    expect(tracks()).toHaveLength(1);
    expect(io.start).not.toHaveBeenCalled();
    expect(io.loadApps).not.toHaveBeenCalled();
  });

  it('starts once on a double click and updates every saved card at that university', async () => {
    const insert = deferred<Started>();
    io.start.mockReturnValueOnce(insert.promise);
    await mountComponent(<CoursesClient {...props()} courses={linked} initialSavedIds={['course-0', 'course-1', 'course-2']} />);
    expect(tracks()).toHaveLength(2);
    expect(document.body.textContent).toContain("This course isn't linked to a university in CAAT yet.");
    await click(tracks()[0]); await click(tracks()[0]);
    expect(tracks().every(b => b.disabled)).toBe(true);
    await act(async () => insert.resolve({ application: { id: 'app-7', status: 'researching' }, created: true }));
    expect(io.start).toHaveBeenCalledTimes(1);
    expect(io.start).toHaveBeenCalledWith(7);
    expect(tracks()).toHaveLength(0);
    const opens = [...document.querySelectorAll('a')].filter(a => a.textContent?.includes('Open your Example University application'));
    expect(opens.map(a => a.getAttribute('href'))).toEqual(['/applications/app-7', '/applications/app-7']);
    expect(io.toast.success).toHaveBeenCalledWith('Started tracking your application to Example University.');
  });

  it('says the application already exists when another tab created it', async () => {
    io.start.mockResolvedValueOnce({ application: { id: 'app-7', status: 'applying' }, created: false });
    await mountComponent(<CoursesClient {...props()} courses={linked} initialSavedIds={['course-0']} />);
    await click(tracks()[0]);
    expect(io.toast.success).toHaveBeenCalledWith("You're already tracking Example University.");
    expect(io.toast.error).not.toHaveBeenCalled();
  });

  it('opens an existing application rather than offering to create one', async () => {
    await mountComponent(<CoursesClient {...props()} courses={linked} initialSavedIds={['course-0']} initialApplications={[{ id: 'app-7', school_id: 7, status: 'applying' }]} />);
    expect(tracks()).toHaveLength(0);
    expect(document.querySelector('a[href="/applications/app-7"]')?.textContent).toContain('Open your Example University application');
  });

  it('keeps the button and toasts when starting fails', async () => {
    io.start.mockRejectedValueOnce(new Error('offline'));
    await mountComponent(<CoursesClient {...props()} courses={linked} initialSavedIds={['course-0']} />);
    await click(tracks()[0]);
    expect(io.toast.error).toHaveBeenCalledWith("Couldn't start tracking. Try again.");
    expect(tracks()[0].disabled).toBe(false);
  });

  it('shows Retry instead of a create button when the applications read failed, and retries only the read', async () => {
    io.loadApps.mockResolvedValueOnce([{ id: 'app-7', school_id: 7, status: 'applying' }]);
    await mountComponent(<CoursesClient {...props()} courses={linked} initialSavedIds={['course-0']} initialApplications={null} />);
    expect(document.body.textContent).toContain("Couldn't check your applications.");
    expect(tracks()).toHaveLength(0);
    await click(button('Retry checking your applications'));
    expect(io.loadApps).toHaveBeenCalledWith({}, 'owner');
    expect(io.start).not.toHaveBeenCalled();
    expect(document.querySelector('a[href="/applications/app-7"]')).not.toBeNull();
  });

  it("discards a previous account's in-flight start after an account switch", async () => {
    const insert = deferred<Started>();
    io.start.mockReturnValueOnce(insert.promise);
    io.load.mockResolvedValue(['course-0']);
    const peerApps = deferred<{ id: string; school_id: number; status: string }[]>();
    io.loadApps.mockReturnValueOnce(peerApps.promise);
    function Switcher() {
      const [, refresh] = React.useState(0);
      return <><button onClick={() => { io.user = { id: 'peer' }; refresh(n => n + 1); }}>Switch account</button><CoursesClient {...props()} courses={linked} initialSavedIds={['course-0']} /></>;
    }
    await mountComponent(<Switcher />);
    await click(tracks()[0]);
    await click(button('Switch account'));
    await act(async () => insert.resolve({ application: { id: 'owner-app', status: 'researching' }, created: true }));
    expect(document.querySelector('a[href="/applications/owner-app"]')).toBeNull();
    await act(async () => peerApps.resolve([]));
    expect(io.loadApps).toHaveBeenCalledWith({}, 'peer');
    expect(tracks()).toHaveLength(1);
    expect(tracks()[0].disabled).toBe(false);
  });
});
