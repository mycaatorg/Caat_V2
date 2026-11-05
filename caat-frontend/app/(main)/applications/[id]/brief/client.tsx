'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthContext';
import { Button } from '@/components/ui/button';
import { fetchApplicationHub, type ApplicationHub } from '../api';
import { buildApplicationBrief } from '@/lib/application-brief';
import {fetchCoursePreparation} from '@/lib/course-preparation';
import {fetchApplicationTasks} from '@/lib/application-tasks';
import {buildBriefCourses,buildBriefTasks,type BriefExtra} from '@/lib/application-brief-extras';
import { ApplicationBriefDocument } from '@/components/applications/application-brief-document';
export default function ApplicationBriefClient({applicationId}:{applicationId:string}) {
 const {user,loading}=useAuth();
 if(loading)return <p role="status" className="p-6">Loading your application brief…</p>;
 if(!user)return <p className="p-6"><Link className="underline" href={`/login?next=${encodeURIComponent(`/applications/${applicationId}/brief`)}`}>Sign in to view this application brief</Link></p>;
 return <BriefWorkspace key={`${user.id}:${applicationId}`} applicationId={applicationId}/>;
}
type BriefSnapshot={hub:ApplicationHub;preparedAt:string};
type ExtraChoice={enabled:boolean;request:number};
function useBriefExtra<T>(choice:ExtraChoice,snapshot:BriefSnapshot|null,read:(value:BriefSnapshot)=>Promise<T[]>):BriefExtra<T>|null {
 const [result,setResult]=useState<{snapshot:BriefSnapshot;request:number;section:BriefExtra<T>}|null>(null);
 useEffect(()=>{
  if(!choice.enabled||!snapshot)return;
  let active=true;
  read(snapshot).then(rows=>{if(active)setResult({snapshot,request:choice.request,section:{state:'ready',rows}});}).catch(()=>{if(active)setResult({snapshot,request:choice.request,section:{state:'unavailable'}});});
  return()=>{active=false;};
 },[choice.enabled,choice.request,snapshot,read]);
 if(!choice.enabled)return null;
 return result?.snapshot===snapshot&&result?.request===choice.request?result.section:{state:'loading'};
}
function BriefWorkspace({applicationId}:{applicationId:string}) {
 const [snapshot,setSnapshot]=useState<BriefSnapshot|null>(null);
 const [courseChoice,setCourseChoice]=useState<ExtraChoice>({enabled:false,request:0}),[taskChoice,setTaskChoice]=useState<ExtraChoice>({enabled:false,request:0});
 const readCourses=useCallback(async(value:BriefSnapshot)=>buildBriefCourses(await fetchCoursePreparation(applicationId,value.hub.schoolId),applicationId,value.hub.schoolId,value.preparedAt),[applicationId]);
 const readTasks=useCallback(async()=>buildBriefTasks(await fetchApplicationTasks(applicationId)),[applicationId]);
 const courses=useBriefExtra(courseChoice,snapshot,readCourses),personalTasks=useBriefExtra(taskChoice,snapshot,readTasks);
 const [error,setError]=useState(false),[version,setVersion]=useState(0),[includeNotes,setIncludeNotes]=useState(false),[includeScholarships,setIncludeScholarships]=useState(false);
 useEffect(()=>{let active=true;fetchApplicationHub(applicationId).then(hub=>{if(active)setSnapshot({hub,preparedAt:new Date().toISOString()});}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[applicationId,version]);
 function reload(){setSnapshot(null);setError(false);setVersion(v=>v+1);}
 const back=<Link className="text-sm underline underline-offset-4" href={`/applications/${encodeURIComponent(applicationId)}`}>Back to application</Link>;
 if(error)return <div className="space-y-4 p-6"><p role="alert">Could not load this application brief. Try again.</p><Button onClick={reload}>Retry brief</Button><div>{back}</div></div>;
 if(!snapshot)return <p role="status" className="p-6">Loading your application brief…</p>;
 const brief=buildApplicationBrief(snapshot.hub,{preparedAt:snapshot.preparedAt,includeNotes,includeScholarships,courses,personalTasks});
 const incomplete = brief.scholarships?.state === 'unavailable'||!!courses&&courses.state!=='ready'||!!personalTasks&&personalTasks.state!=='ready';
 return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
  <div className="flex flex-wrap items-center justify-between gap-3">{back}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={reload}>Refresh brief</Button><Button disabled={incomplete} onClick={()=>{if(!incomplete)window.print();}}>Print / Save PDF</Button></div></div>
  <div className="space-y-3 rounded-lg border bg-muted/20 p-4"><h1 className="text-xl font-semibold">Preview your application brief</h1><p className="max-w-prose text-sm text-muted-foreground">Print includes the preparation information shown below. Essay bodies and document contents are excluded.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeNotes} onChange={e=>setIncludeNotes(e.target.checked)} disabled={!snapshot.hub.application.notes?.trim()} className="h-4 w-4 accent-[#9a1a27]"/>Include my application notes</label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includeScholarships" checked={includeScholarships} onChange={e=>setIncludeScholarships(e.target.checked)} className="h-4 w-4 accent-[#9a1a27]"/>Include attached scholarship checklists</label>
   {brief.scholarships?.state==='unavailable' && <p role="alert" className="text-sm">Could not load the attached scholarship checklists completely. Refresh the brief to try again, or uncheck this section to print without it.</p>}
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includeCourses" checked={courseChoice.enabled} onChange={e=>setCourseChoice(current=>({enabled:e.target.checked,request:current.request+1}))} className="h-4 w-4 accent-[#9a1a27]"/>Include course preparation</label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="includeTasks" checked={taskChoice.enabled} onChange={e=>setTaskChoice(current=>({enabled:e.target.checked,request:current.request+1}))} className="h-4 w-4 accent-[#9a1a27]"/>Include my personal application tasks</label>
   {(courses?.state==='loading'||personalTasks?.state==='loading')&&<p role="status" className="text-sm">Loading the selected sections before printing…</p>}
   {courses?.state==='unavailable'&&<p role="alert" className="text-sm">Could not load course preparation completely. Refresh the brief, or uncheck this section to print without it.</p>}
   {personalTasks?.state==='unavailable'&&<p role="alert" className="text-sm">Could not load personal tasks completely. Refresh the brief, or uncheck this section to print without it.</p>}
  </div>
  <div data-application-brief-preview className="overflow-hidden rounded-lg border shadow-sm"><ApplicationBriefDocument brief={brief}/></div>
  {!incomplete && typeof document!=='undefined' && createPortal(<div data-print-application aria-hidden="true"><ApplicationBriefDocument brief={brief}/></div>,document.body)}
 </div>;
}
