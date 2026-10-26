'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {loadShareCandidates,loadShares,previewShare,createShare,replaceShare,revokeShare,removeShare} from '@/lib/shortlist-sharing';
import {newShareToken,shareKey,shareLink,SHARE_KIND_LABEL} from '@/lib/shortlist-sharing-model';
import type {SharedItem,ShareSelection,ShareRecord} from '@/types/shortlist-sharing';
import {SharePreview} from './share-preview';

type Candidate=Awaited<ReturnType<typeof loadShareCandidates>>[number];
const message=(error:unknown)=>error instanceof Error?error.message:'Something went wrong. Try again.';
export function ShareManager(){
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [records,setRecords]=useState<ShareRecord[]>([]);
 const [selection,setSelection]=useState<ShareSelection>([]);
 const [items,setItems]=useState<SharedItem[]|null>(null);
 const [search,setSearch]=useState('');
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [listError,setListError]=useState('');
 const [historyError,setHistoryError]=useState('');
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [published,setPublished]=useState(false);
 const [link,setLink]=useState<{id:string;url:string;items:SharedItem[]}|null>(null);
 const [viewId,setViewId]=useState<string|null>(null);
 const [confirm,setConfirm]=useState<{record:ShareRecord;action:'replace'|'remove'}|null>(null);
 const generation=useRef(0);const candidateLoad=useRef(0);const historyLoad=useRef(0);
 const pendingToken=useRef<string|null>(null);const replaceTokens=useRef(new Map<string,string>());
 const inFlight=useRef(false);const notice=useRef<HTMLDivElement>(null);
 const reloadCandidates=useCallback(async()=>{
  const run=++candidateLoad.current;setLoading(true);setListError('');
  try{const rows=await loadShareCandidates();if(run===candidateLoad.current)setCandidates(rows);}
  catch(e){if(run===candidateLoad.current)setListError(message(e));}
  finally{if(run===candidateLoad.current)setLoading(false);}
 },[]);
 const reloadHistory=useCallback(async()=>{
  const run=++historyLoad.current;setHistoryError('');
  try{const rows=await loadShares();if(run===historyLoad.current)setRecords(rows);}
  catch(e){if(run===historyLoad.current)setHistoryError(message(e));}
 },[]);
 useEffect(()=>{void reloadCandidates();void reloadHistory();return()=>{generation.current++;candidateLoad.current++;historyLoad.current++;};},[reloadCandidates,reloadHistory]);
 useEffect(()=>{if(error)notice.current?.focus();},[error]);
 function toggle(candidate:Candidate){
  if(inFlight.current)return;
  setSelection(current=>current.some(s=>shareKey(s)===shareKey(candidate))?current.filter(s=>shareKey(s)!==shareKey(candidate)):current.length<20?[...current,{kind:candidate.kind,id:candidate.id}]:current);
  setItems(null);setLink(null);setPublished(false);pendingToken.current=null;setError('');setStatus('');
 }
 async function action(run:()=>Promise<void>){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setStatus('');
  const current=generation.current;
  try{await run();}catch(e){if(current===generation.current)setError(message(e));}
  finally{inFlight.current=false;if(current===generation.current)setBusy(false);}
 }
 function updateRecord(row:ShareRecord){historyLoad.current++;setRecords(rows=>[row,...rows.filter(r=>r.id!==row.id)]);}
 const visible=candidates.filter(c=>`${c.label} ${c.description} ${SHARE_KIND_LABEL[c.kind]}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="max-w-5xl space-y-8 p-6 pt-0">
  <header><Link href="/shortlist" className="text-sm underline underline-offset-4">Back to shortlist</Link><p className="mt-6 font-code text-[10px] uppercase tracking-widest text-muted-foreground">A second opinion</p><h1 className="mt-2 font-display text-3xl">Share a little <span className="italic text-[#9a1a27] dark:text-[#e89ca4]">perspective</span></h1><p className="mt-3 max-w-2xl text-sm text-muted-foreground">Choose the items you want a parent, teacher or friend to see. Preview exactly what they will receive before creating a link.</p></header>
  <div className="border-l-2 border-[#9a1a27] bg-muted/30 p-4 text-sm"><p>Only the selected catalogue details are shared. Your profile, applications, essays and documents stay private.</p><p className="mt-2 text-muted-foreground">Anyone with the link can read it for 30 days. Revoking stops future access, but cannot remove copies or screenshots already saved.</p></div>
  {error?<div ref={notice} tabIndex={-1} role="alert" className="border border-destructive p-4 text-sm">{error}</div>:null}
  <p role="status" className="text-sm" aria-live="polite">{status}</p>
  <section aria-labelledby="choose-items"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="choose-items" className="font-display text-2xl">1. Choose what to share</h2><span className="font-code text-xs">{selection.length} / 20 selected</span></div>
   {listError?<div role="alert" className="border p-4"><p>{listError}</p><Button disabled={busy} variant="outline" onClick={()=>void reloadCandidates()}>Retry saved items</Button></div>:loading?<p role="status">Loading saved items…</p>:<>
    <label className="block text-sm">Find a saved item<input className="mt-2 block w-full rounded-none border bg-background p-3" value={search} onChange={e=>setSearch(e.target.value)} type="search"/></label>
    <fieldset disabled={busy} className="mt-4 max-h-96 overflow-y-auto border"><legend className="sr-only">Select saved items</legend>{visible.map(candidate=>{const selected=selection.some(s=>shareKey(s)===shareKey(candidate));return <label key={shareKey(candidate)} className="flex min-h-14 cursor-pointer items-start gap-3 border-b p-4 last:border-b-0"><input className="mt-1 h-4 w-4 accent-[#9a1a27]" type="checkbox" checked={selected} disabled={!selected&&selection.length>=20} onChange={()=>toggle(candidate)}/><span><span className="block font-medium">{candidate.label}</span><span className="text-xs text-muted-foreground">{SHARE_KIND_LABEL[candidate.kind]}{candidate.description?` · ${candidate.description}`:''}</span></span></label>;})}{visible.length===0?<p className="p-5 text-sm text-muted-foreground">{candidates.length?'No matching items.':'Save a course, university, major or scholarship to get started.'}</p>:null}</fieldset>
   </>}
   <Button className="mt-4 rounded-none" disabled={busy||selection.length===0||loading||!!listError} onClick={()=>void action(async()=>{setLink(null);const expected=await previewShare(selection);setItems(expected);setPublished(false);pendingToken.current=null;})}>Preview selected items</Button>
  </section>
  {items?<section aria-labelledby="preview-items"><h2 id="preview-items" className="mb-2 font-display text-2xl">2. Exactly what they will see</h2><p className="mb-4 text-sm text-muted-foreground">This snapshot stays the same if you later change your shortlist.</p><SharePreview items={items}/><Button className="mt-4 rounded-none" disabled={busy||published} onClick={()=>void action(async()=>{pendingToken.current??=newShareToken();const token=pendingToken.current;const row=await createShare(selection,items,token);updateRecord(row);setLink({id:row.id,url:shareLink(window.location.origin,token),items:row.items});setPublished(true);setStatus('Shared link created. Copy it below.');})}>{published?'Link created':'Create shared link'}</Button></section>:null}
  {link?<section className="border border-[#9a1a27]/40 bg-muted/30 p-5" aria-labelledby="copy-link"><h2 id="copy-link" className="font-display text-xl">Your shared link</h2><p className="mt-2 text-sm font-medium">{link.items.map(item=>item.title).join(" · ")}</p><p className="my-3 text-sm text-muted-foreground">Copy it now. After leaving this page, use Replace link to get a new link; the old one will stop working.</p><input aria-label="Shared link" className="block w-full min-w-0 border bg-background p-3 font-code text-xs" readOnly value={link.url} onFocus={e=>e.target.select()}/><Button variant="outline" className="mt-3 rounded-none" onClick={()=>{void navigator.clipboard?.writeText(link.url).then(()=>setStatus('Link copied.')).catch(()=>setStatus('Select and copy the link above.')) ;if(!navigator.clipboard)setStatus('Select and copy the link above.');}}>Copy link</Button></section>:null}
  <section aria-labelledby="manage-links"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="manage-links" className="font-display text-2xl">Manage shared links</h2><Button disabled={busy} variant="outline" className="rounded-none" onClick={()=>void reloadHistory()}>Refresh links</Button></div>
   {historyError?<p role="alert">{historyError}</p>:null}
   {!records.length&&!historyError?<p className="text-sm text-muted-foreground">No shared links yet.</p>:null}
   <ul className="space-y-4">{records.map(row=>{const expired=Date.parse(row.expires_at)<=Date.now();const active=!row.revoked_at&&!expired;return <li key={row.id} className="border p-5">
    <h3 className="font-display text-xl">{row.items[0].title}{row.items.length>1?` + ${row.items.length-1} more`:''}</h3><p className="my-2 text-sm text-muted-foreground">{row.revoked_at?'Revoked':expired?'Expired':`Active until ${new Date(row.expires_at).toLocaleDateString()}`} · Created {new Date(row.created_at).toLocaleDateString()}</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" className="rounded-none" onClick={()=>setViewId(viewId===row.id?null:row.id)} aria-expanded={viewId===row.id}>View shared items</Button>{active?<><Button disabled={busy} variant="outline" className="rounded-none" onClick={()=>setConfirm({record:row,action:'replace'})}>Replace link</Button><Button disabled={busy} variant="outline" className="rounded-none" onClick={()=>void action(async()=>{const revoked=await revokeShare(row.id);updateRecord(revoked);if(link?.id===row.id)setLink(null);setStatus('Link revoked. Future access is blocked.');})}>Revoke link</Button></>:null}<Button disabled={busy} variant="ghost" className="rounded-none" onClick={()=>setConfirm({record:row,action:'remove'})}>Remove link</Button></div>
    {confirm?.record.id===row.id?<div className="mt-4 border-l-2 border-[#9a1a27] p-4"><p className="text-sm">{confirm.action==='replace'?'Replace this link? The old link will stop working. Shared items and the expiry date stay the same.':'Remove this shared link? Access will stop and it will leave this list.'}</p><div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void action(async()=>{
     if(confirm.action==='replace'){let token=replaceTokens.current.get(row.id);if(!token){token=newShareToken();replaceTokens.current.set(row.id,token);}const replaced=await replaceShare(row,token);updateRecord(replaced);setLink({id:row.id,url:shareLink(window.location.origin,token),items:replaced.items});setItems(null);setPublished(false);pendingToken.current=null;replaceTokens.current.delete(row.id);setStatus('Link replaced. Copy the new link above.');}
     else{await removeShare(row.id);historyLoad.current++;setRecords(rows=>rows.filter(r=>r.id!==row.id));if(link?.id===row.id)setLink(null);setStatus('Shared link removed.');}
     setConfirm(null);
    })}>{confirm.action==='replace'?'Confirm replacement':'Confirm removal'}</Button><Button disabled={busy} variant="outline" onClick={()=>setConfirm(null)}>Cancel</Button></div></div>:null}
    {viewId===row.id?<div className="mt-4"><SharePreview items={row.items}/></div>:null}
   </li>;})}</ul>
  </section>
 </div>;
}
