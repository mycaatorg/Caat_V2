'use client';
import { resumeRequest } from '@/lib/community-resume-request';
import { useEffect,useRef,useState } from 'react';
import { prepareResumeShareAction } from '@/app/(main)/communities/actions';
import type { ResumeShareInput } from '@/lib/community-resume-share-schema';
import { Button } from '@/components/ui/button';
import { SharedResumeContent } from './SharedResumeContent';

export function ResumeSharePicker({resumeId,onChange,anonymous,disabled=false}:{resumeId:string;onChange:(value:ResumeShareInput|null)=>void;anonymous:boolean;disabled?:boolean}) {
 const [preview,setPreview]=useState<ResumeShareInput|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[confirmed,setConfirmed]=useState(false);
 const generation=useRef(0);
 useEffect(()=>{
  const requests=generation;requests.current++;
  // Selection invalidates both the displayed copy and its consent.
  setPreview(null);setConfirmed(false);setError(null);setBusy(false);onChange(null);
  return ()=>{requests.current++;};
 },[resumeId,onChange]);
 async function prepare(){
  const request=++generation.current;setBusy(true);setPreview(null);setConfirmed(false);onChange(null);setError(null);
  try{
   const result=await resumeRequest(prepareResumeShareAction(resumeId));
   if(generation.current!==request)return;
   if(result.error||!result.snapshot)setError(result.error??'Could not prepare this resume. Please try again.');
   else setPreview({post_id:crypto.randomUUID(),snapshot:result.snapshot});
  }catch{if(generation.current===request)setError('Could not prepare this resume. Please try again.');}
  finally{if(generation.current===request)setBusy(false);}
 }
 return <div className="space-y-3">
  <p className="text-sm text-muted-foreground">Share a fixed copy with anyone who can view this post. In a private group, this follows the group’s access rules. Later draft edits stay private. Deleting your draft won’t remove this copy; use Remove shared copy on the post.</p>
  {anonymous&&<p className="text-sm font-medium">Your resume can identify you even when your post is anonymous.</p>}
  <Button type="button" variant="outline" disabled={disabled||busy||!resumeId} onClick={prepare}>{busy?'Preparing preview…':'Preview shared copy'}</Button>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {preview&&<>
   <p className="text-xs text-muted-foreground">This is exactly what readers will see. Review every section, including contact details. Basic formatting is preserved.</p>
   <div className="max-h-96 overflow-y-auto" tabIndex={0} aria-label="Review shared resume"><SharedResumeContent snapshot={preview.snapshot}/></div>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={disabled} onChange={e=>{setConfirmed(e.target.checked);onChange(e.target.checked?preview:null);}}/>I reviewed this copy and agree to share its contents with this post’s audience.</label>
  </>}
 </div>;
}
