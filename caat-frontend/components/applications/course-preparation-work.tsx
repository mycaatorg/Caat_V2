'use client';
import {useCallback,useEffect,useRef,useState,type RefObject} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {LibraryDialog} from '@/components/evidence/library-dialog';
import {fetchApplicationWorkSources,type WorkSource} from '@/lib/requirement-evidence';
import {fetchCoursePreparationWork,linkCoursePreparationWork,unlinkCoursePreparationWork} from '@/lib/course-preparation';
import {PREPARATION_LABELS} from '@/lib/course-preparation-model';
import {REQUIREMENT_WORK_CHANGED} from '@/lib/requirement-work-events';
import type {PreparationCheck,PreparationWork} from '@/types/course-preparation';
const key=(s:WorkSource)=>`${s.kind}:${s.id}`;
const matches=(w:PreparationWork,s:WorkSource)=>s.kind==='evidence'?w.evidence_link_id===s.id:w.essay_draft_id===s.id;
export function CoursePreparationWork({check,disabled}:{check:PreparationCheck;disabled:boolean}) {
 const [open,setOpen]=useState(false);const opener=useRef<HTMLButtonElement>(null);
 return <><Button ref={opener} size="sm" variant="ghost" disabled={disabled} onClick={()=>setOpen(true)}>Supporting work</Button>{open&&<WorkDialog returnFocusRef={opener} check={check} onClose={()=>setOpen(false)}/>}</>;
}
function WorkDialog({check,onClose,returnFocusRef}:{check:PreparationCheck;onClose:()=>void;returnFocusRef:RefObject<HTMLElement|null>}) {
 const [data,setData]=useState<{links:PreparationWork[];sources:WorkSource[]}|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[query,setQuery]=useState(''),[selected,setSelected]=useState('');
 const generation=useRef(0),writing=useRef(false);
 const load=useCallback(async()=>{
  const request=++generation.current;setLoading(true);
  try{const [links,sources]=await Promise.all([fetchCoursePreparationWork(check.application_id),fetchApplicationWorkSources(check.application_id)]);if(request===generation.current){setData({links:links.filter(l=>l.check_id===check.id),sources});setError(null);}}
  catch{if(request===generation.current){setData(null);setError('Could not load supporting work. Refresh to try again.');}}
  finally{if(request===generation.current)setLoading(false);}
 },[check.application_id,check.id]);
 const cancelPending=useCallback(()=>{generation.current++;},[]);
 useEffect(()=>{void load();const refresh=()=>{if(!writing.current)void load();};window.addEventListener('focus',refresh);window.addEventListener(REQUIREMENT_WORK_CHANGED,refresh);return()=>{cancelPending();window.removeEventListener('focus',refresh);window.removeEventListener(REQUIREMENT_WORK_CHANGED,refresh);};},[load,cancelPending]);
 const run=async(action:()=>Promise<void>)=>{if(writing.current)return;writing.current=true;setBusy(true);setError(null);try{await action();setSelected('');await load();}catch(e){setError(e instanceof Error?e.message:'Could not save. Refresh to try again.');}finally{writing.current=false;setBusy(false);}};
 const linked=(s:WorkSource)=>!!data?.links.some(l=>matches(l,s));
 const choice=data?.sources.find(s=>key(s)===selected);
 return <LibraryDialog returnFocusRef={returnFocusRef} title="Course supporting work" description={PREPARATION_LABELS[check.item_key]} busy={busy} onClose={onClose}>
  <p className="text-sm text-muted-foreground">Choose work already linked to this application, or a saved essay draft. Linking does not mark preparation reviewed or send anything to the provider.</p>
  <p className="mt-2 text-xs text-muted-foreground">Add more documents or library items using this application&apos;s cards, or save a draft in <Link href="/essays" className="underline">Essays</Link>.</p>
  <Button size="sm" variant="ghost" className="mt-2" disabled={busy||loading} onClick={()=>void load()}>Refresh supporting work</Button>
  {error&&<p role="alert" className="my-2 text-sm text-destructive">{error}</p>}
  {loading&&<p role="status" className="text-sm">Loading supporting work…</p>}
  {data&&<>
   <h3 className="mt-3 text-sm font-medium">Linked work</h3>
   {!data.links.length&&<p className="text-sm text-muted-foreground">No work linked yet.</p>}
   <ul className="mt-2 space-y-2">{data.links.map(link=>{const source=data.sources.find(s=>matches(link,s));return <li key={link.id} className="min-w-0 rounded-md border p-3 text-sm"><p className="break-words font-medium">{source?.title??'Source unavailable'}</p>{source&&<><p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{source.body||'No text saved yet.'}</p><Link href={source.href} className="text-xs underline">Open source</Link><p className="text-xs text-muted-foreground">{source.tailored?'Application-specific version':'Current saved work'}; follows edits to the source.</p></>}<Button variant="ghost" size="sm" disabled={busy||loading||!!error} onClick={()=>void run(()=>unlinkCoursePreparationWork(link))}>Remove link</Button></li>;})}</ul>
   <label className="mt-4 block text-sm">Find supporting work<input className="mt-1 w-full rounded border bg-background p-2" value={query} onChange={e=>setQuery(e.target.value)} disabled={busy}/></label>
   <fieldset disabled={busy||loading||!!error} className="mt-2 min-w-0 space-y-2"><legend className="sr-only">Available work</legend>{data.sources.filter(s=>!linked(s)&&`${s.title} ${s.category}`.toLowerCase().includes(query.toLowerCase().trim())).map(s=><label key={key(s)} className="flex min-w-0 items-start gap-2 rounded border p-2 text-sm"><input type="radio" name="course-work" checked={selected===key(s)} onChange={()=>setSelected(key(s))}/><span className="min-w-0 break-words">{s.title} · {s.category}</span></label>)}</fieldset>
   {choice&&!linked(choice)&&<p className="my-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm">{choice.body||'No text saved yet.'}</p>}
   <Button className="mt-3" disabled={busy||loading||!!error||!choice||linked(choice)} onClick={()=>{if(choice)void run(()=>linkCoursePreparationWork(check,choice));}}>Link selected work</Button>
  </>}
 </LibraryDialog>;
}
