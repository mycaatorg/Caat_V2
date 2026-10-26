'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {removeOwnCommunityContentAction} from '@/app/(main)/communities/actions';
import type {OwnedCommunityContent} from '@/app/(main)/communities/actions/owned-content';
import {resumeRequest} from '@/lib/community-resume-request';

function OwnedContentItem({row}:{row:OwnedCommunityContent}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[removed,setRemoved]=useState(row.removed),[error,setError]=useState<string|null>(null);
 const pending=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[]);
 async function remove(){
  if(pending.current)return;pending.current=true;setBusy(true);setError(null);
  try{
   const result=await resumeRequest(removeOwnCommunityContentAction(row.kind,row.id));
   if(!alive.current)return;
   if(result.error){setError(result.error);return;}
   setRemoved(true);setConfirm(false);
  }catch{if(alive.current)setError('Could not remove your content. Please try again.');}
  finally{pending.current=false;if(alive.current)setBusy(false);}
 }
 return <li className="space-y-3 rounded-xl border bg-card p-5">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Your {row.kind}</h2><time className="text-sm text-muted-foreground" dateTime={row.created_at}>{new Date(row.created_at).toISOString().slice(0,10)}</time></div>
  {removed?<p role="status" className="text-sm text-muted-foreground">Content removed. A placeholder keeps existing replies in place.</p>:<>
   <p className="break-words whitespace-pre-wrap">{row.content||'Attachment or empty text'}</p>
   {confirm?<div className="space-y-3"><p className="text-sm text-muted-foreground">Remove this {row.kind}{row.kind==='post'?' and its attachments':''}? This cannot be undone. Existing replies stay in their community.</p><div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={busy} onClick={remove}>{busy?'Removing…':'Confirm removal'}</Button><Button variant="outline" disabled={busy} onClick={()=>{setConfirm(false);setError(null);}}>Cancel</Button></div></div>:<Button variant="outline" onClick={()=>setConfirm(true)}>Remove {row.kind}</Button>}
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </>}
 </li>;
}
export function OwnedContentManager({rows}:{rows:OwnedCommunityContent[]}){
 return <ul className="space-y-4">{rows.map(row=><OwnedContentItem key={`${row.kind}:${row.id}`} row={row}/>)}</ul>;
}
