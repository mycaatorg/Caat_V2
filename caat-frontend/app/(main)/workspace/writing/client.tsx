'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileText, FileUser, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase/client';
import { readWritingDesk, selectWriting, type WritingFilters, type WritingItem } from '@/lib/writing-desk';

const INITIAL: WritingFilters = { query: '', kind: 'all', school: 'all', status: 'all', sort: 'recent' };
const PAGE_SIZE = 20;
const selectClass = 'h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
const dateFormat = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
function savedDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? `Updated ${dateFormat.format(new Date(value))}` : 'Update date unavailable';
}
export default function WritingDeskClient() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" className="p-6">Loading your writing…</p>;
  if (!user) return <p className="p-6"><Link className="underline" href="/login?next=%2Fworkspace%2Fwriting">Sign in to see your writing</Link></p>;
  return <WritingDesk key={user.id} userId={user.id} />;
}
function WritingDesk({ userId }: { userId: string }) {
  const [items, setItems] = useState<WritingItem[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [filters, setFilters] = useState<WritingFilters>(INITIAL);
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    readWritingDesk(supabase, userId).then(data => { if (active) setItems(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [userId, version]);
  function refresh() { setItems(null); setError(false); setPage(1); setVersion(value => value + 1); }
  function update(patch: WritingFilters) { setFilters(current => ({ ...current, ...patch })); setPage(1); }
  function clear() { setFilters(INITIAL); setPage(1); }
  const loading = items === null && !error;
  const selected = selectWriting(items ?? [], filters);
  const pageCount = Math.max(1, Math.ceil(selected.length / PAGE_SIZE)), safePage = Math.min(page, pageCount);
  const visible = selected.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const schools = [...new Map((items ?? []).filter(item => item.schoolId !== null).map(item => [item.schoolId!, item.schoolName || 'University unavailable'])).entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl"><h1 className="text-3xl font-bold tracking-tight">Writing desk</h1><p className="mt-2 text-sm text-muted-foreground">Pick up an essay or resume. See which university it belongs to and find the draft you want to work on next.</p></div>
      <Button variant="outline" onClick={refresh} disabled={loading}><RefreshCw className="mr-2 size-4" />Refresh writing</Button>
    </div>
    <nav aria-label="Writing tools" className="flex flex-wrap gap-3">
      <Button asChild><Link href="/essays"><FileText className="mr-2 size-4" />Open essay editor</Link></Button>
      <Button variant="outline" asChild><Link href="/resume-builder"><FileUser className="mr-2 size-4" />Open resume builder</Link></Button>
    </nav>
    <div className="space-y-4 rounded-lg border p-4">
      <div><label htmlFor="writing-query" className="mb-2 block text-sm font-medium">Search writing</label><Input id="writing-query" aria-label="Search writing" maxLength={200} value={filters.query} onChange={event => update({ query: event.target.value })} placeholder="Draft title, essay prompt or university" /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="min-w-0 space-y-2 text-sm">Writing type<select aria-label="Writing type" className={selectClass} value={filters.kind} onChange={event => update({ kind: event.target.value as WritingFilters['kind'] })}><option value="all">All writing</option><option value="essay">Essay drafts</option><option value="resume">Resumes</option></select></label>
        <label className="min-w-0 space-y-2 text-sm">University<select aria-label="University" className={selectClass} value={filters.school} onChange={event => update({ school: event.target.value })}><option value="all">All universities</option><option value="general">General / untagged</option>{schools.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="min-w-0 space-y-2 text-sm">Draft status<select aria-label="Draft status" className={selectClass} value={filters.status} onChange={event => update({ status: event.target.value as WritingFilters['status'] })}><option value="all">Any status</option><option value="current">Current essay drafts</option><option value="other">Other essay drafts</option></select></label>
        <label className="min-w-0 space-y-2 text-sm">Sort writing<select aria-label="Sort writing" className={selectClass} value={filters.sort} onChange={event => update({ sort: event.target.value as WritingFilters['sort'] })}><option value="recent">Recently updated</option><option value="oldest">Oldest update first</option><option value="title">Title A–Z</option></select></label>
      </div>
      <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>
    </div>
    {error ? <div role="alert" className="space-y-3 rounded-lg border p-6"><p>Could not load your writing. Please try again.</p><Button onClick={refresh}>Retry</Button></div>
      : loading ? <p role="status">Loading your writing…</p>
      : items?.length === 0 ? <div className="rounded-lg border border-dashed p-8"><h2 className="text-xl font-semibold">Your writing starts here</h2><p className="mt-2 text-sm text-muted-foreground">Open the essay editor to start a draft, or the resume builder to prepare your experience. Your saved writing will appear here.</p></div>
      : <section aria-label="Your writing" className="space-y-4">
        <p role="status" aria-label="Writing results" className="text-sm text-muted-foreground">{selected.length} pieces of writing{selected.length > PAGE_SIZE ? ` · Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, selected.length)}` : ''}</p>
        {selected.length === 0 ? <div className="rounded-lg border border-dashed p-6"><h2 className="font-semibold">No writing matches these filters</h2><p className="mt-2 text-sm text-muted-foreground">Try a different title or clear the filters to see all your writing.</p></div>
          : <ul className="divide-y rounded-lg border">{visible.map(item => <li key={`${item.kind}:${item.id}`} data-writing-item>
            <Link href={item.href} prefetch={false} className="group flex min-w-0 gap-3 rounded-lg p-4 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:gap-4 sm:p-5">
              {item.kind === 'essay' ? <FileText aria-hidden className="mt-1 size-5 shrink-0 text-primary" /> : <FileUser aria-hidden className="mt-1 size-5 shrink-0 text-primary" />}
              <div className="min-w-0 flex-1 space-y-2"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><h2 className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{item.title}</h2><span className="shrink-0 text-xs text-muted-foreground">{savedDate(item.updatedAt)}</span></div>
                <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{item.context}</p>
                <div className="flex flex-wrap gap-2 text-xs"><span className="rounded bg-muted px-2 py-1">{item.schoolName || 'General / untagged'}</span><span className="rounded border px-2 py-1">{item.kind === 'resume' ? 'Resume' : item.isCurrent ? 'Current draft' : 'Other draft'}</span></div>
              </div><ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          </li>)}</ul>}
        {pageCount > 1 && <nav aria-label="Writing pages" className="flex items-center justify-between gap-3"><Button variant="outline" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous writing</Button><span className="text-sm">{safePage} / {pageCount}</span><Button variant="outline" disabled={safePage === pageCount} onClick={() => setPage(safePage + 1)}>Next writing</Button></nav>}
      </section>}
  </div>;
}
