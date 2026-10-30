'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowUpRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { readWorkspaceIndex, selectWorkspaceItems, type WorkspaceItem, type WorkspaceKind } from '@/lib/workspace-search';

const kinds: { value: WorkspaceKind; label: string }[] = [
  { value: 'application', label: 'Applications' }, { value: 'document', label: 'Documents' },
  { value: 'essay', label: 'Essay drafts' }, { value: 'resume', label: 'Resumes' },
];
const PAGE_SIZE = 20;

export default function WorkspaceSearchClient() {
  const { user, loading } = useAuth();
  if (loading) return <p role="status" className="p-6">Loading your workspace…</p>;
  if (!user) return <p className="p-6"><Link className="underline" href="/login?next=%2Fworkspace%2Fsearch">Sign in to search your work</Link></p>;
  // A changed account gets a new index and query immediately, before any async read completes.
  return <SearchWorkspace key={user.id} userId={user.id} />;
}

function SearchWorkspace({ userId }: { userId: string }) {
  const [items, setItems] = useState<WorkspaceItem[] | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<WorkspaceKind | 'all'>('all');
  const [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    readWorkspaceIndex(supabase, userId).then(data => { if (active) setItems(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [userId, version]);
  function reload() { setItems(null); setError(false); setPage(1); setVersion(value => value + 1); }
  const loading = items === null && !error;
  const readyQuery = query.trim().length >= 2;
  const allMatches = selectWorkspaceItems(items ?? [], query);
  const matches = kind === 'all' ? allMatches : allMatches.filter(item => item.kind === kind);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = matches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  return <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold tracking-tight">Find your work</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Search your applications, document filenames, essay draft labels and resume titles.</p></div>
      <Button variant="outline" disabled={loading} onClick={reload}><RefreshCw className="mr-2 size-4" />Refresh results</Button>
    </div>
    <div className="space-y-2">
      <label htmlFor="workspace-query" className="text-sm font-medium">Search your work</label>
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground" />
        <Input id="workspace-query" aria-label="Search your work" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} maxLength={200} placeholder="A university, filename or draft label" className="h-12 pl-11 text-base" />
      </div>
      <p className="text-xs text-muted-foreground">Searches titles and filenames, not the text inside your files or writing.</p>
    </div>
    {error ? <div role="alert" className="space-y-3 border p-5"><p>Could not load your workspace. Try again.</p><Button onClick={reload}>Retry</Button></div>
      : loading ? <p role="status">Loading your workspace…</p>
      : !readyQuery ? <div className="border border-dashed p-6 text-sm text-muted-foreground"><p>Enter at least 2 characters to find your saved work.</p><p className="mt-2">Open a result to continue where you left off.</p></div>
      : <>
        <nav aria-label="Filter search results" className="flex flex-wrap gap-2">
          {[{ value: 'all' as const, label: 'All', count: allMatches.length }, ...kinds.map(entry => ({ ...entry, count: allMatches.filter(item => item.kind === entry.value).length }))].map(entry =>
            <Button key={entry.value} variant={kind === entry.value ? 'default' : 'outline'} aria-pressed={kind === entry.value} onClick={() => { setKind(entry.value); setPage(1); }}>{entry.label} ({entry.count})</Button>)}
        </nav>
        <p role="status" aria-label="Search results" className="text-sm text-muted-foreground">{matches.length} results{matches.length > PAGE_SIZE ? ` · Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, matches.length)}` : ''}</p>
        {matches.length === 0 ? <div className="space-y-2 border border-dashed p-6"><p>No saved work matches this search.</p><p className="text-sm text-muted-foreground">Try a shorter name or another type of work.</p></div>
          : <ul className="divide-y border-y">{visible.map(item => <li key={`${item.kind}:${item.id}`} data-search-result>
            <Link prefetch={false} href={item.href} className="group flex min-w-0 items-center justify-between gap-4 px-2 py-4 hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <div className="min-w-0 space-y-1"><p className="break-words font-medium [overflow-wrap:anywhere]">{item.title}</p><p className="text-xs text-muted-foreground">{kinds.find(entry => entry.value === item.kind)?.label} · {item.detail}</p></div>
              <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          </li>)}</ul>}
        {pages > 1 && <nav aria-label="Search result pages" className="flex items-center justify-between gap-3"><Button variant="outline" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous results</Button><span className="text-sm">{safePage} / {pages}</span><Button variant="outline" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}>Next results</Button></nav>}
      </>}
  </div>;
}
