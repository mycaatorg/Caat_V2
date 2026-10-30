"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Library } from 'lucide-react';
import { selectLibrary, type LibraryFilters } from '@/lib/library-workspace';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listEvidenceItems, fetchItemUsage, deleteEvidenceItem, evidenceText, type EvidenceItem, type ItemUsage } from '@/lib/evidence-items';
import { EvidenceItemEditor } from './EvidenceItemEditor';
import { EvidenceImportDialog } from './EvidenceImportDialog';
export function EvidenceLibraryCard({ workspace = false, itemId }: { workspace?: boolean; itemId?: string }) {
  const opener=useRef<HTMLElement|null>(null), region=useRef<HTMLDivElement|null>(null);
  const [items,setItems]=useState<EvidenceItem[]>([]), [usage,setUsage]=useState<Record<string,ItemUsage[]>>({});
  const [loading,setLoading]=useState(true), [failed,setFailed]=useState(false), [retry,setRetry]=useState(0);
  const [editor,setEditor]=useState<EvidenceItem | 'new' | null>(null), [importing,setImporting]=useState(false);
  const [query,setQuery]=useState(''), [useFilter,setUseFilter]=useState<LibraryFilters['usage']>('all'), [sort,setSort]=useState<LibraryFilters['sort']>('recent'), [page,setPage]=useState(1);
  const [filter,setFilter]=useState('all'), [deleting,setDeleting]=useState<string | null>(null), [busy,setBusy]=useState(false), [error,setError]=useState<string | null>(null);
  // Usage is a snapshot; the server FK also prevents deletion if another tab links an item later.
  useEffect(()=>{let active=true;Promise.all([listEvidenceItems(),fetchItemUsage()]).then(([next,used])=>{if(active){setItems(next);setUsage(used);setFailed(false);}}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[retry]);
  const reload=()=>{setLoading(true);setError(null);setDeleting(null);setRetry(n=>n+1);};
  const saved=(item:EvidenceItem)=>setItems(cur=>cur.some(i=>i.id===item.id)?cur.map(i=>i.id===item.id?item:i):[item,...cur]);
  async function remove(item:EvidenceItem) {
    if(busy)return;setBusy(true);setError(null);
    try {await deleteEvidenceItem(item);setItems(cur=>cur.filter(i=>i.id!==item.id));setDeleting(null);}catch(e){setError(e instanceof Error?e.message:'Could not delete this item. Try again.');}finally{setBusy(false);}
  }
  const disabled=loading || failed || busy;
  const targeted = workspace && !!itemId;
  const scopedItems = targeted ? items.filter(item => item.id === itemId) : items;
  const selected = workspace ? selectLibrary(scopedItems, usage, { query, kind: filter as LibraryFilters['kind'], usage: useFilter, sort }) : items.filter(i=>filter==='all'||i.kind===filter);
  const pageCount = Math.max(1, Math.ceil(selected.length / 12)), safePage = Math.min(page, pageCount);
  if (workspace && page !== safePage) setPage(safePage);
  const visible = workspace ? selected.slice((safePage-1)*12, safePage*12) : selected;
  function clearFilters() { setQuery(''); setFilter('all'); setUseFilter('all'); setSort('recent'); setPage(1); }
  const selectClass = 'mt-1 h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-primary';
  return <Card ref={region} tabIndex={-1} id="evidence-library" role="region" aria-label="Activities, awards and experience library">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Library className="h-5 w-5 text-[#9a1a27] dark:text-[#e06b78]" aria-hidden="true"/>Your application library</CardTitle><p className="max-w-prose text-sm text-muted-foreground">Activities, awards and experience you can reuse. Link an item from any university application, then tailor it there.</p>{!workspace && <Link href="/workspace/library" className="w-fit text-sm underline underline-offset-4">Open experience library</Link>}</CardHeader>
    <CardContent>
      <div className="mb-5 flex flex-wrap gap-2">{!targeted && <Button disabled={disabled} onClick={e=>{opener.current=e.currentTarget;setEditor('new');}}>Add library item</Button>}{!targeted && <Button variant="outline" disabled={disabled} onClick={e=>{opener.current=e.currentTarget;setImporting(true);}}>Import existing work</Button>}<Button variant="ghost" disabled={loading || busy} onClick={reload} aria-label="Refresh library">Refresh</Button></div>
      {targeted && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-y py-3 text-sm"><p>Opened from a library item link</p><Link className="underline underline-offset-4" href="/workspace/library">All library items</Link></div>}
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {workspace && !targeted && !loading && !failed && <section aria-label="Find library items" className="mb-5 space-y-3 border-y py-4">
        <label className="block text-sm font-medium">Search library<Input aria-label="Search library" maxLength={200} value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Title, organisation, role or description" className="mt-2" /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="min-w-0 text-sm">Library type<select aria-label="Library type" className={selectClass} value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="all">All types</option><option value="activity">Activities</option><option value="award">Awards</option><option value="experience">Experience</option></select></label>
          <label className="min-w-0 text-sm">Application use<select aria-label="Application use" className={selectClass} value={useFilter} onChange={e=>{setUseFilter(e.target.value as LibraryFilters['usage']);setPage(1);}}><option value="all">Any use</option><option value="linked">Linked to an application</option><option value="unlinked">Not linked yet</option></select></label>
          <label className="min-w-0 text-sm">Sort library<select aria-label="Sort library" className={selectClass} value={sort} onChange={e=>{setSort(e.target.value as LibraryFilters['sort']);setPage(1);}}><option value="recent">Newest added</option><option value="oldest">Oldest added</option><option value="name">Title A–Z</option></select></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" aria-label="Library results" className="text-sm text-muted-foreground">{selected.length} matching {selected.length===1?'item':'items'} of {items.length}</p><Button variant="ghost" onClick={clearFilters}>Clear library filters</Button></div>
      </section>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading your library…</p> : failed ? <div role="alert" className="space-y-2 text-sm"><p>Could not load your library and where it is used.</p><Button variant="outline" onClick={reload} aria-label="Retry library">Retry</Button></div> : targeted && !scopedItems.length ? <p role="status" className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">This library item is unavailable. It may have been removed or is not available to this account.</p> : items.length===0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Your library is empty. Add an activity, award or experience, or import work you already saved.</p> : <>
        {!workspace && <label className="mb-3 flex items-center gap-2 text-sm">Show<select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-md border bg-background p-2"><option value="all">All items ({items.length})</option><option value="activity">Activities</option><option value="award">Awards</option><option value="experience">Experience</option></select></label>}
        <ul className="divide-y">{visible.map(item=>{
          const used=usage[item.id]??[];
          return <li key={item.id} className="py-5" data-library-item={item.id}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs capitalize text-muted-foreground">{item.kind}</p><h3 className="font-semibold break-words">{item.title}</h3></div><div className="flex gap-1"><Button variant="outline" size="sm" disabled={busy} aria-label={`Edit ${item.title}`} onClick={e=>{opener.current=e.currentTarget;setEditor(item);}}>Edit</Button><Button variant="ghost" size="sm" disabled={busy || used.length>0} aria-label={`Delete ${item.title}`} onClick={()=>{setDeleting(item.id);setError(null);}}>Delete</Button></div></div>
            <p className="mt-2 max-w-prose whitespace-pre-line break-words text-sm text-muted-foreground">{evidenceText(item)}</p>
            {used.length>0 ? <div className="mt-3 text-sm"><p className="font-medium">Used in {used.length} {used.length===1?'application':'applications'}</p><ul className="mt-1 space-y-1">{used.map(u=><li key={u.applicationId}><Link className="text-[#9a1a27] dark:text-[#e06b78] underline underline-offset-2" href={`/applications/${u.applicationId}`}>{u.schoolName}{u.tailored?' (tailored)':''}</Link></li>)}</ul><p className="mt-1 text-xs text-muted-foreground">Unlink from these applications before deleting this item.</p></div> : <p className="mt-3 text-xs text-muted-foreground">Not linked to an application yet.</p>}
            {deleting===item.id && <div role="group" aria-label={`Delete ${item.title}`} className="mt-3 space-y-2"><p className="text-sm">Delete this library item? Its original profile activity or resume entry stays unchanged.</p><div className="flex gap-2"><Button size="sm" variant="destructive" disabled={busy} onClick={()=>void remove(item)} aria-label="Confirm delete item">{busy?'Deleting…':'Delete item'}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setDeleting(null)}>Cancel</Button></div></div>}
          </li>;
        })}</ul>
        {!selected.length && <p className="py-4 text-sm text-muted-foreground">{workspace ? 'No library items match your search and filters.' : 'No items of this type yet.'}</p>}
        {workspace && !targeted && selected.length>0 && <nav aria-label="Library pages" className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="text-sm text-muted-foreground">Page {safePage} of {pageCount}</span><div className="flex gap-2"><Button variant="outline" aria-label="Previous library items" disabled={safePage===1} onClick={()=>setPage(safePage-1)}>Previous</Button><Button variant="outline" aria-label="Next library items" disabled={safePage===pageCount} onClick={()=>setPage(safePage+1)}>Next</Button></div></nav>}
      </>}
      {editor && <EvidenceItemEditor returnFocusRef={opener} fallbackFocusRef={region} key={editor==='new'?'new':editor.id} item={editor==='new'?undefined:editor} usedCount={editor==='new'?0:(usage[editor.id]?.length??0)} onSaved={saved} onClose={()=>setEditor(null)} />}
      {importing && <EvidenceImportDialog returnFocusRef={opener} fallbackFocusRef={region} existingKeys={new Set(items.flatMap(i=>i.origin_key?[i.origin_key]:[]))} onImported={saved} onClose={()=>setImporting(false)} />}
    </CardContent>
  </Card>;
}
