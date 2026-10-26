'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {readSharedShortlist} from '@/lib/shared-shortlist-reader';
import {SharePreview} from './share-preview';
import type {SharedSnapshot} from '@/types/shortlist-sharing';
import {Button} from '@/components/ui/button';

export function SharedShortlist(){
 const [snapshot,setSnapshot]=useState<SharedSnapshot|null>(null);
 const [state,setState]=useState<'loading'|'ready'|'unavailable'|'error'>('loading');
 const refresh=useRef<()=>void>(()=>{});
 useEffect(()=>{
  let generation=0;let expiry:ReturnType<typeof setTimeout>|undefined;
  const hidden=()=>document.visibilityState==='hidden';
  function clear(){generation++;clearTimeout(expiry);setSnapshot(null);}
  async function read(){
   clear();
   if(hidden())return;
   const current=generation;const token=window.location.hash.slice(1);
   setState('loading');
   try{
    const data=await readSharedShortlist(token);
    if(current!==generation||hidden())return;
    const remaining=data?Date.parse(data.expires_at)-Date.now():0;
    if(!data||remaining<=0){setState('unavailable');return;}
    setSnapshot(data);setState('ready');
    // Rechecks occur every 30s; clamp long expiry to the platform timer limit.
    expiry=setTimeout(()=>{clear();setState('unavailable');},Math.min(remaining,2147483647));
   }catch{if(current===generation){setSnapshot(null);setState('error');}}
  }
  function visibility(){if(hidden())clear();else void read();}
  refresh.current=()=>void read();void read();
  const poll=setInterval(()=>{if(document.visibilityState!=='hidden')void read();},30000);
  window.addEventListener('hashchange',read);window.addEventListener('focus',read);document.addEventListener('visibilitychange',visibility);
  return()=>{generation++;clearTimeout(expiry);clearInterval(poll);window.removeEventListener('hashchange',read);window.removeEventListener('focus',read);document.removeEventListener('visibilitychange',visibility);refresh.current=()=>{};};
 },[]);
 return <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
  <Link href="/" className="font-display text-xl font-bold">CAAT</Link>
  <header className="mb-8 mt-10"><p className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">Shared with you</p><h1 className="mt-2 font-display text-4xl">A shortlist to <span className="italic text-[#9a1a27] dark:text-[#e89ca4]">consider</span></h1><p className="mt-3 text-sm text-muted-foreground">A saved snapshot of selected items. Check official sources for current details.</p></header>
  {snapshot?<><SharePreview items={snapshot.items}/><p className="my-4 text-sm text-muted-foreground">Shared {new Date(snapshot.created_at).toLocaleDateString()} · Available until {new Date(snapshot.expires_at).toLocaleDateString()}</p></>:<div role="status" className="border p-6"><h2 className="font-display text-xl">{state==='loading'?'Checking this link…':state==='error'?'Could not check this link':'Link unavailable'}</h2><p className="mt-2 text-sm text-muted-foreground">{state==='loading'?'Please wait.':state==='error'?'Check your connection and try again.':'It may have expired, been replaced or been revoked. Ask the person who shared it for a new link.'}</p></div>}
  <Button className="mt-4 rounded-none" variant="outline" onClick={()=>refresh.current()}>Refresh link</Button>
 </main>;
}
