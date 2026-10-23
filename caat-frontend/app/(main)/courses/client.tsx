'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { loadCourseBookmarks, setCourseBookmark } from '@/lib/course-bookmarks';
import { formatCourseFee } from '@/lib/course-data';
import type { CourseOffering } from '@/types/courses';
import { CourseNavigation } from '@/components/courses/course-navigation';
import { CourseSource, ProviderLink } from '@/components/courses/course-source';
import CourseComparison from '@/components/courses/course-comparison';
import { CourseApplicationAction } from '@/components/courses/course-application-action';
import { startApplicationForSchool, type SchoolApplication } from '@/lib/application-for-school';
import { loadSchoolApplications, type SchoolApplicationRow } from '@/lib/school-applications';

type Props = { courses: CourseOffering[] | null; initialUserId: string; initialSavedIds: string[] | null; initialApplications?: SchoolApplicationRow[] | null; checkedAt: string; initialQuery?: string };
type Applications = { owner: string | null; bySchool: Map<number, SchoolApplication>; error: boolean; loading: boolean };
const bySchool = (rows: SchoolApplicationRow[]) => new Map(rows.map(r => [r.school_id, { id: r.id, status: r.status }]));
function readQuery(query: string) { const p = new URLSearchParams(query); return { search: p.get('q') ?? '', savedOnly: p.get('saved') === '1', course: p.get('course') ?? '' }; }

export default function CoursesClient({ courses, initialUserId, initialSavedIds, initialApplications = [], checkedAt, initialQuery = '' }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const currentUser = useRef(userId);
  const firstLoad = useRef(true);
  const pending = useRef(new Set<string>());
  const [busy, setBusy] = useState(new Set<string>());
  const [saved, setSaved] = useState({ owner: initialUserId as string | null, ids: new Set(initialSavedIds ?? []), error: initialSavedIds === null, loading: false });
  const [reload, setReload] = useState(0);
  // PROD-148: the owner's applications by university, guarded like the saves.
  const firstAppsLoad = useRef(true);
  const [apps, setApps] = useState<Applications>({ owner: initialUserId, bySchool: bySchool(initialApplications ?? []), error: initialApplications === null, loading: false });
  const [appsReload, setAppsReload] = useState(0);
  const [query, setQuery] = useState(() => readQuery(initialQuery));
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    currentUser.current = userId;
    if (authLoading) return;
    if (firstLoad.current && userId === initialUserId && reload === 0) { firstLoad.current = false; return; }
    firstLoad.current = false;
    let alive = true;
    setSaved({ owner: userId, ids: new Set(), error: false, loading: !!userId });
    if (userId) loadCourseBookmarks(supabase, userId).then(ids => {
      if (alive) setSaved({ owner: userId, ids: new Set(ids), error: false, loading: false });
    }).catch(() => { if (alive) setSaved({ owner: userId, ids: new Set(), error: true, loading: false }); });
    return () => { alive = false; };
  }, [userId, authLoading, initialUserId, reload]);

  useEffect(() => {
    if (authLoading) return;
    if (firstAppsLoad.current && userId === initialUserId && appsReload === 0) { firstAppsLoad.current = false; return; }
    firstAppsLoad.current = false;
    let alive = true;
    setApps({ owner: userId, bySchool: new Map(), error: false, loading: !!userId });
    if (userId) loadSchoolApplications(supabase, userId).then(rows => {
      if (alive) setApps({ owner: userId, bySchool: bySchool(rows), error: false, loading: false });
    }).catch(() => { if (alive) setApps({ owner: userId, bySchool: new Map(), error: true, loading: false }); });
    return () => { alive = false; };
  }, [userId, authLoading, initialUserId, appsReload]);

  useEffect(() => {
    const restore = () => setQuery(readQuery(window.location.search));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function updateQuery(next: typeof query) {
    setQuery(next);
    const p = new URLSearchParams();
    if (next.search) p.set('q', next.search); if (next.savedOnly) p.set('saved', '1'); if (next.course) p.set('course', next.course);
    const search = p.toString();
    window.history.replaceState(null, '', `/courses${search ? `?${search}` : ''}`);
  }
  const savedIds = saved.owner === userId ? saved.ids : new Set<string>();
  const savesUnavailable = authLoading || !userId || saved.owner !== userId || saved.loading || saved.error;

  async function toggleSave(course: CourseOffering) {
    if (savesUnavailable || !userId) return;
    const key = `${userId}:${course.id}`;
    if (pending.current.has(key)) return;
    const wasSaved = savedIds.has(course.id);
    const owner = userId;
    pending.current.add(key); setBusy(new Set(pending.current));
    const changeSaved = (isSaved: boolean) => setSaved(cur => {
      if (cur.owner !== owner) return cur;
      const ids = new Set(cur.ids); if (isSaved) ids.add(course.id); else ids.delete(course.id);
      return { ...cur, ids };
    });
    changeSaved(!wasSaved);
    try {
      await setCourseBookmark(supabase, owner, course.id, !wasSaved);
      if (currentUser.current === owner) toast.success(wasSaved ? 'Course removed from your shortlist.' : 'Course saved to your shortlist.');
    } catch {
      changeSaved(wasSaved);
      if (currentUser.current === owner) toast.error(wasSaved ? 'Could not remove course. Please try again.' : 'Could not save course. Please try again.');
    } finally { pending.current.delete(key); setBusy(new Set(pending.current)); }
  }
  const appsReady = !authLoading && !!userId && apps.owner === userId;
  /** Only a labelled click starts tracking. One in-flight start per owner and
   *  university, shared by every saved card at that university. */
  async function startApplication(schoolId: number, institutionName: string) {
    if (!appsReady || apps.loading || apps.error || !userId) return;
    const owner = userId;
    const key = `${owner}:apply-${schoolId}`;
    if (pending.current.has(key)) return;
    pending.current.add(key); setBusy(new Set(pending.current));
    try {
      const { application, created } = await startApplicationForSchool(schoolId);
      setApps(cur => cur.owner === owner ? { ...cur, bySchool: new Map(cur.bySchool).set(schoolId, application) } : cur);
      if (currentUser.current === owner) toast.success(created ? `Started tracking your application to ${institutionName}.` : `You're already tracking ${institutionName}.`);
    } catch {
      if (currentUser.current === owner) toast.error("Couldn't start tracking. Try again.");
    } finally { pending.current.delete(key); setBusy(new Set(pending.current)); }
  }
  function toggleCompare(id: string) { setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : ids.length < 3 ? [...ids, id] : ids); }
  const chosen = selected.flatMap(id => courses?.find(c => c.id === id) ?? []);
  const filtered = courses?.filter(c => (c.active || savedIds.has(c.id) || query.course === c.id) && (!query.savedOnly || savedIds.has(c.id)) && (!query.course || c.id === query.course) && `${c.name} ${c.institution_name} ${c.campus ?? ''} ${c.program_code}`.toLowerCase().includes(query.search.toLowerCase())) ?? [];

  return <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 min-w-0">
    <CourseNavigation current="courses" />
    <header className="max-w-3xl mb-7">
      <h1 className="font-display text-3xl font-semibold">Find the degree behind your interests</h1>
      <p className="mt-3 text-muted-foreground leading-relaxed">A starter catalogue of Australian undergraduate courses. Save specific degrees and compare up to three, while keeping your major exploration and university shortlist.</p>
      <p className="mt-2 text-sm text-muted-foreground">Fees shown are for domestic Commonwealth Supported Places where published. International applicants should check their category on the provider’s website. Coverage is not complete.</p>
    </header>
    {!courses ? <div role="alert" className="border p-6"><p>Could not load university courses.</p><Button variant="outline" className="mt-3" onClick={() => router.refresh()}>Try again</Button></div> : <>
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="flex-1 min-w-48 text-sm font-medium" htmlFor="course-search">Search degrees, universities or campuses<input id="course-search" type="search" value={query.search} onChange={e => updateQuery({ ...query, search: e.target.value, course: '' })} className="mt-2 block h-10 w-full rounded-md border bg-background px-3" /></label>
        <Button variant={query.savedOnly ? 'default' : 'outline'} aria-pressed={query.savedOnly} onClick={() => updateQuery({ ...query, savedOnly: !query.savedOnly, course: '' })}>Saved courses</Button>
        <Button asChild variant="outline"><Link href="/shortlist?tab=course">My shortlist</Link></Button>
      </div>
      {saved.error && saved.owner === userId && <div role="alert" className="mb-5 rounded-md border p-4 text-sm"><p>Could not load saved courses. Your saves have not been cleared.</p><Button variant="outline" className="mt-2" onClick={() => setReload(n => n + 1)}>Retry saved courses</Button></div>}
      {saved.loading && <p role="status" className="mb-4 text-sm">Loading your saved courses…</p>}
      {query.course && <Button variant="outline" className="mb-4" onClick={() => updateQuery({ ...query, course: '', search: '' })}>Show all courses</Button>}
      {selected.length > 0 && <section aria-label="Selected courses" className="mb-6 rounded-lg border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-3"><p className="text-sm font-medium" aria-live="polite">{selected.length} of 3 courses selected</p><Button disabled={selected.length < 2} onClick={() => setCompareOpen(true)}>Compare selected courses</Button><Button variant="ghost" onClick={() => setSelected([])}>Clear comparison</Button></div>
        <ul className="mt-3 flex flex-wrap gap-2">{chosen.map(c => <li key={c.id}><button className="rounded-md border px-3 py-2 text-sm text-left hover:bg-muted" aria-label={`Remove ${c.name} from comparison`} onClick={() => toggleCompare(c.id)}>{c.name} <span aria-hidden="true">×</span></button></li>)}</ul>
      </section>}
      <p role="status" className="mb-4 text-sm text-muted-foreground">{filtered.length} course{filtered.length !== 1 ? 's' : ''}{query.savedOnly ? ' saved' : ''}</p>
      {filtered.length === 0 ? <div className="border border-dashed p-8 text-center"><p>{query.savedOnly ? 'No saved courses match this view.' : 'No courses match this view.'}</p><Button variant="outline" className="mt-3" onClick={() => updateQuery({ search: '', savedOnly: false, course: '' })}>Browse all courses</Button></div> :
        <div className="grid gap-5 lg:grid-cols-2">{filtered.map(c => <article key={c.id} aria-label={`${c.name} at ${c.institution_name}`} className="min-w-0 rounded-lg border bg-card p-5 sm:p-6">
          <p className="text-sm text-muted-foreground">{c.institution_name}</p><h2 className="mt-1 font-display text-xl font-semibold leading-snug">{c.name}</h2>
          {!c.active && <p className="mt-3 text-sm font-medium">No longer in the active catalogue. Check current availability with the provider.</p>}
          <dl className="my-5 space-y-3 text-sm leading-relaxed">
            <div><dt className="font-medium">Campus and duration</dt><dd className="text-muted-foreground">{c.campus ?? 'Campus not confirmed'}. {c.duration ?? 'Duration not confirmed'}</dd></div>
            <div><dt className="font-medium">Prerequisites</dt><dd className="text-muted-foreground">{c.prerequisites ?? 'Prerequisites not confirmed. Check the provider.'}{c.prerequisites_url && <> <ProviderLink href={c.prerequisites_url}>Check prerequisite details</ProviderLink></>}</dd></div>
            <div><dt className="font-medium">Assumed knowledge</dt><dd className="text-muted-foreground">{c.assumed_knowledge ?? 'Assumed knowledge not confirmed'}</dd></div>
            <div><dt className="font-medium">Indicative fees</dt><dd className="text-muted-foreground">{formatCourseFee(c)}</dd></div>
          </dl>
          <CourseSource course={c} checkedAt={checkedAt} />
          {savedIds.has(c.id) && <div className="mt-4">{!appsReady || apps.loading
            ? <p role="status" className="text-xs text-muted-foreground">Checking your applications…</p>
            : <CourseApplicationAction institutionName={c.institution_name} schoolId={c.school_id} application={c.school_id === null ? null : apps.bySchool.get(c.school_id) ?? null}
                busy={busy.has(`${userId}:apply-${c.school_id}`)} unavailable={apps.error}
                onStart={() => { if (c.school_id !== null) void startApplication(c.school_id, c.institution_name); }}
                onRetry={() => setAppsReload(n => n + 1)} />}</div>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant={savedIds.has(c.id) ? 'secondary' : 'default'} disabled={savesUnavailable || busy.has(`${userId}:${c.id}`) || (!c.active && !savedIds.has(c.id))} aria-label={savedIds.has(c.id) ? `Remove ${c.name} from saved courses` : `Save ${c.name}`} onClick={() => toggleSave(c)}>{savedIds.has(c.id) ? 'Saved' : 'Save course'}</Button>
            <Button variant="outline" aria-label={`Compare ${c.name} at ${c.institution_name}`} aria-pressed={selected.includes(c.id)} disabled={selected.length >= 3 && !selected.includes(c.id)} onClick={() => toggleCompare(c.id)}>{selected.includes(c.id) ? 'Selected' : 'Compare'}</Button>
          </div>
        </article>)}</div>}
    </>}
    <Dialog.Root open={compareOpen} onOpenChange={setCompareOpen}><Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-background p-4 sm:p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 mb-2"><Dialog.Title className="font-display text-2xl">Compare university courses</Dialog.Title><Dialog.Close asChild><Button variant="outline" aria-label="Close comparison">Close</Button></Dialog.Close></div>
        <Dialog.Description className="mb-5 text-sm text-muted-foreground">Check the same details across your choices. Provider rules and fees can change.</Dialog.Description>
        <CourseComparison courses={chosen} checkedAt={checkedAt} />
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
  </div>;
}
