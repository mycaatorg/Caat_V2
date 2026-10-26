'use client';
import { resumeRequest } from '@/lib/community-resume-request';
import {useEffect,useRef,useState} from 'react';
import {useInView} from 'react-intersection-observer';
import {FileText} from 'lucide-react';
import {Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Button} from '@/components/ui/button';
import {readCommunityResumeAction,revokeCommunityResumeAction} from '@/app/(main)/communities/actions';
import type {ResumeSnapshot} from '@/lib/community-resume-share-schema';
import {SharedResumeContent} from './SharedResumeContent';

export function ResumeInlinePreview({postId,isOwner,management=false}:{postId:string;isOwner:boolean;management?:boolean}){
 const [snapshot,setSnapshot]=useState<ResumeSnapshot|null>(null),[error,setError]=useState<string|null>(null);
 const [open,setOpen]=useState(false),[retry,setRetry]=useState(0),[removed,setRemoved]=useState(false);
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[removeError,setRemoveError]=useState<string|null>(null);
 const generation=useRef(0),identity=useRef(postId);
 const {ref,inView}=useInView({threshold:0.05});
 useEffect(()=>{
  identity.current=postId;setBusy(false);
  setSnapshot(null);setError(null);setRemoved(false);setOpen(false);setConfirm(false);setRemoveError(null);
  return ()=>{identity.current="";};
 },[postId]);
 useEffect(()=>{
  let disposed=false,pending=false;
  const requests=generation;
  const clear=()=>{generation.current++;setSnapshot(null);};
  async function load(){
   if(disposed||removed||document.visibilityState==='hidden'||(!inView&&!open)||pending)return;
   const request=++generation.current;pending=true;
   try{
    const result=await resumeRequest(readCommunityResumeAction(postId));
    if(!disposed&&generation.current===request){setSnapshot(current=>JSON.stringify(current)===JSON.stringify(result.snapshot)?current:result.snapshot);setError(result.error);}
   }catch{if(!disposed&&generation.current===request){setSnapshot(null);setError('Could not load the shared resume. Please try again.');}}
   finally{pending=false;}
  }
  function visibility(){if(document.visibilityState==='hidden')clear();else void load();}
  void load();const interval=setInterval(load,30000);
  window.addEventListener('focus',load);document.addEventListener('visibilitychange',visibility);
  return ()=>{disposed=true;requests.current++;clearInterval(interval);window.removeEventListener('focus',load);document.removeEventListener('visibilitychange',visibility);};
 },[postId,inView,open,retry,removed]);
 async function remove(){
  setBusy(true);setRemoveError(null);
  try{
   const result=await resumeRequest(revokeCommunityResumeAction(postId));
   if(identity.current!==postId)return;
   if(result.error)setRemoveError(result.error);
   else{generation.current++;setRemoved(true);setSnapshot(null);setOpen(false);setConfirm(false);}
  }catch{if(identity.current===postId)setRemoveError('Could not remove the shared copy. Please try again.');}
  finally{if(identity.current===postId)setBusy(false);}
 }
 return <div ref={ref} className="space-y-3 rounded-lg border bg-muted/20 p-4">
  <div className="flex items-center gap-2 text-sm font-medium"><FileText aria-hidden className="size-4"/>{snapshot?.title??'Shared resume'}</div>
  {removed?<p role="status" className="text-sm">Shared copy removed.</p>:snapshot?<>
   <p className="text-xs text-muted-foreground">Read-only copy · {snapshot.sections.length} sections · Later draft edits stay private</p>
   <Button variant="outline" size="sm" onClick={()=>setOpen(true)}>Read shared resume</Button>
  </>:<div className="space-y-2"><p role="status" className="text-sm text-muted-foreground">{error??'Loading shared resume…'}</p>{error&&<Button variant="outline" size="sm" onClick={()=>setRetry(n=>n+1)}>Retry resume</Button>}</div>}
  {isOwner&&!removed&&(snapshot||confirm||management)&&<div className="space-y-2">
   {confirm?<><p className="text-sm">Remove this copy from the post? Your private draft stays saved. Readers may have already saved a copy.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="destructive" disabled={busy} onClick={remove}>Confirm removal</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</Button></div></>:<Button size="sm" variant="ghost" onClick={()=>setConfirm(true)}>Remove shared copy</Button>}
   {removeError&&<p role="alert" className="text-sm text-destructive">{removeError}</p>}
  </div>}
  <Sheet open={open} onOpenChange={setOpen}><SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader className="mb-6"><SheetTitle>Shared resume</SheetTitle><SheetDescription>A fixed copy shared with this post’s audience.</SheetDescription></SheetHeader>{snapshot?<SharedResumeContent snapshot={snapshot}/>:<p role="status">{error??'Checking access…'}</p>}</SheetContent></Sheet>
 </div>;
}
