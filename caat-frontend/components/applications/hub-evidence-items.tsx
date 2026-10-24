"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LibraryDialog } from '@/components/evidence/library-dialog';
import { listEvidenceItems, evidenceText, type EvidenceItem } from '@/lib/evidence-items';
import { ITEM_TAILOR_BODY_MAX, fetchItemLinks, linkItem, unlinkItem, tailorItem, keepItemTailoring, resetItemTailoring, itemSourceChanged, type ItemLink } from '@/lib/evidence-item-links';
const titleOf=(link:ItemLink)=>link.tailoredTitle ?? link.item?.title ?? 'Library item unavailable';
const bodyOf=(link:ItemLink)=>link.tailoredAt ? link.tailoredBody ?? '' : link.item ? evidenceText(link.item) : '';
export function HubEvidenceItems({applicationId,schoolName}:{applicationId:string;schoolName:string}) {
  const [links,setLinks]=useState<ItemLink[]>([]),[loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
  const [picking,setPicking]=useState(false),[editing,setEditing]=useState<ItemLink|null>(null),[confirm,setConfirm]=useState<{link:ItemLink;action:'unlink'|'reset'}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  useEffect(()=>{let active=true;fetchItemLinks(applicationId).then(data=>{if(active){setLinks(data);setFailed(false);}}).catch(()=>{if(active)setFailed(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[applicationId,retry]);
  const replace=(next:ItemLink)=>setLinks(cur=>cur.map(l=>l.id===next.id?next:l));
  const refresh=()=>{setLoading(true);setError(null);setConfirm(null);setRetry(n=>n+1);};
  async function run(work:()=>Promise<void>) {
    if(busy)return;setBusy(true);setError(null);
    try{await work();}catch(e){setError(e instanceof Error?e.message:'Could not save this change. Try again.');}finally{setBusy(false);}
  }
  return <Card role="region" aria-label="Application activities, awards and experience">
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-base">Activities, awards and experience</CardTitle><Button size="sm" variant="ghost" disabled={loading||busy} onClick={refresh} aria-label="Refresh linked items">Refresh</Button></div><p className="text-sm text-muted-foreground">Reuse your work and tailor it for {schoolName}.</p></CardHeader>
    <CardContent>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">Loading linked items…</p> : failed ? <div role="alert" className="space-y-2 text-sm"><p>Could not load your linked activities, awards and experience.</p><Button variant="outline" aria-label="Retry linked items" onClick={refresh}>Retry</Button></div> : links.length===0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No library items linked yet. Add work you want to use for this application.</p> : <ul className="divide-y">
        {links.map(link=><li key={link.id} className="py-4" data-item-link={link.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="min-w-0 flex-1 font-medium break-words">{titleOf(link)}</h3><div className="flex gap-1"><Button size="sm" variant="outline" disabled={busy||!link.item} aria-label={`Tailor ${titleOf(link)}`} onClick={()=>{setConfirm(null);setEditing(link);}}>Tailor</Button><Button size="sm" variant="ghost" disabled={busy} aria-label={`Unlink ${titleOf(link)}`} onClick={()=>{setError(null);setConfirm({link,action:'unlink'});}}>Unlink</Button></div></div>
          <p className="mt-2 whitespace-pre-line break-words text-sm">{bodyOf(link)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{link.tailoredAt?`Tailored for ${schoolName}`:'Follows your library'}{link.item ? ` · ${link.item.kind}` : ''}</p>
          {link.tailoredAt && <Button className="mt-2" size="sm" variant="ghost" disabled={busy} onClick={()=>setConfirm({link,action:'reset'})}>Use library version</Button>}
          {itemSourceChanged(link) && <div role="status" className="mt-3 rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/20"><p>Library version updated since you tailored this. Your text has been kept.</p><Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={()=>void run(async()=>{replace(await keepItemTailoring(link));setConfirm(null);})}>Keep mine</Button></div>}
          {confirm?.link.id===link.id && <div role="group" aria-label={confirm.action==='unlink'?'Unlink item':'Reset item tailoring'} className="mt-3 space-y-2">
            <p className="text-sm">{confirm.action==='unlink'?'Remove this link? The item stays in your library and other applications.':'Replace this application’s tailored text with the current library version?'}</p>
            <div className="flex gap-2"><Button size="sm" disabled={busy} aria-label={confirm.action==='unlink'?'Confirm unlink item':'Confirm use library item'} onClick={()=>void run(async()=>{if(confirm.action==='unlink'){await unlinkItem(confirm.link);setLinks(cur=>cur.filter(l=>l.id!==confirm.link.id));}else{replace(await resetItemTailoring(confirm.link));}setConfirm(null);})}>{busy?'Saving…':confirm.action==='unlink'?'Unlink':'Use library version'}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</Button></div>
          </div>}
        </li>)}
      </ul>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button variant="outline" disabled={loading||failed||busy} onClick={()=>setPicking(true)}>Add from your library</Button><Link href="/profile#evidence-library" className="text-sm text-[#9a1a27] dark:text-[#e06b78] underline underline-offset-2">Manage library</Link></div>
      {picking && <ItemPicker applicationId={applicationId} linkedIds={new Set(links.map(l=>l.itemId))} onLinked={link=>{setLinks(cur=>cur.some(l=>l.id===link.id)?cur:[...cur,link]);setPicking(false);}} onClose={()=>setPicking(false)} />}
      {editing && <TailorItemDialog seen={editing} schoolName={schoolName} onSaved={replace} onClose={()=>setEditing(null)} />}
    </CardContent>
  </Card>;
}
function ItemPicker({applicationId,linkedIds,onLinked,onClose}:{applicationId:string;linkedIds:Set<string>;onLinked:(link:ItemLink)=>void;onClose:()=>void}) {
  const [items,setItems]=useState<EvidenceItem[]|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
  useEffect(()=>{let active=true;listEvidenceItems().then(data=>{if(active){setItems(data);setFailed(false);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[retry]);
  const available=(items??[]).filter(i=>!linkedIds.has(i.id));
  async function add(item:EvidenceItem){if(busy)return;setBusy(item.id);setError(null);try{onLinked(await linkItem(applicationId,item.id));}catch(e){setError(e instanceof Error?e.message:'Could not link this item. Try again.');}finally{setBusy(null);}}
  return <LibraryDialog title="Add from your library" description="Link an activity, award or experience. You can tailor it for this application afterward." busy={busy!==null} onClose={onClose}>
    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    {failed ? <div role="alert"><p>Could not load your library.</p><Button variant="outline" onClick={()=>{setFailed(false);setRetry(n=>n+1);}}>Retry library items</Button></div> : items===null ? <p role="status">Loading library…</p> : available.length===0 ? <p className="text-sm">{items.length?'All your library items are linked here.':'Your library is empty.'} <Link href="/profile#evidence-library" className="underline">Manage library</Link></p> : <ul className="divide-y">{available.map(item=><li key={item.id} className="py-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-medium break-words">{item.title}</p><p className="text-xs capitalize text-muted-foreground">{item.kind}</p></div><Button size="sm" variant="outline" disabled={busy!==null} aria-label={`Link ${item.title}`} onClick={()=>void add(item)}>{busy===item.id?'Linking…':'Link'}</Button></div><p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{evidenceText(item)}</p></li>)}</ul>}
  </LibraryDialog>;
}
function TailorItemDialog({seen,schoolName,onSaved,onClose}:{seen:ItemLink;schoolName:string;onSaved:(link:ItemLink)=>void;onClose:()=>void}) {
  const [draft,setDraft]=useState({title:titleOf(seen),body:bodyOf(seen)}),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError(null);try{onSaved(await tailorItem(seen,draft));onClose();}catch(e){setError(e instanceof Error?e.message:'Could not save this change. Try again.');}finally{setBusy(false);}}
  return <LibraryDialog title={`Tailor for ${schoolName}`} description="Save a complete version of this text for this application. The library and other applications stay unchanged." busy={busy} onClose={onClose}>
    <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4"><label className="block text-sm font-medium">Application title<Input className="mt-1" required maxLength={200} value={draft.title} onChange={e=>setDraft(d=>({...d,title:e.target.value}))} /></label><label className="block text-sm font-medium">Application description<Textarea className="mt-1 min-h-40" maxLength={ITEM_TAILOR_BODY_MAX} value={draft.body} onChange={e=>setDraft(d=>({...d,body:e.target.value}))} /></label></fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex gap-2"><Button type="submit" disabled={busy}>{busy?'Saving…':'Save application version'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button></div></form>
  </LibraryDialog>;
}
