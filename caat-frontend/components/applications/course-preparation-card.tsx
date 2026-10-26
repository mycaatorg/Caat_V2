'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {ProviderLink} from '@/components/courses/course-source';
import {fetchCoursePreparation,saveCoursePreparation,type CoursePreparation} from '@/lib/course-preparation';
import {PREPARATION_KEYS,PREPARATION_LABELS,preparationNeedsReview,snapshotForCourse} from '@/lib/course-preparation-model';
import {CoursePreparationWork} from './course-preparation-work';
import type {CourseOffering} from '@/types/courses';
import type {PreparationAction,PreparationCheck,PreparationKey} from '@/types/course-preparation';
import type {Json} from '@/types/database';

function RecordedFacts({snapshot}:{snapshot:Json}) {
 const s=snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)?snapshot:{};
 const text=(key:string)=>typeof s[key]==='string'?s[key] as string:null;
 return <div className="min-w-0 space-y-1 text-xs">
  <p className="whitespace-pre-wrap break-words">{text('text')||'No information recorded. Check with the provider; this does not mean there is no requirement.'}</p>
  <ProviderLink href={text('url')}>View provider details</ProviderLink>
  <ProviderLink href={text('source_url')}>Course source</ProviderLink>
  <p className="text-muted-foreground">Source year: {typeof s.source_year==='number'?s.source_year:'not recorded'} · Last checked: {text('verified_at')?new Date(text('verified_at')!).toLocaleDateString('en-AU',{timeZone:'UTC'}):'not recorded'}</p>
 </div>;
}
export function CoursePreparationCard({applicationId,schoolId}:{applicationId:string;schoolId:number}) {
 const [data,setData]=useState<CoursePreparation|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const generation=useRef(0),writing=useRef(false),region=useRef<HTMLElement>(null);
 const load=useCallback(async()=>{
  const request=++generation.current;setLoading(true);
  try{const next=await fetchCoursePreparation(applicationId,schoolId);if(request===generation.current){setData(next);setError(null);}}
  catch{if(request===generation.current){setData(null);setError('Could not load course preparation. Refresh to try again.');}}
  finally{if(request===generation.current)setLoading(false);}
 },[applicationId,schoolId]);
 const cancelPending=useCallback(()=>{generation.current++;},[]);
 useEffect(()=>{void load();const refresh=()=>{if(!writing.current)void load();};window.addEventListener('focus',refresh);return()=>{cancelPending();window.removeEventListener('focus',refresh);};},[load,cancelPending]);
 const run=async(course:CourseOffering,key:PreparationKey,action:PreparationAction,check?:PreparationCheck)=>{
  if(writing.current)return;writing.current=true;setBusy(true);setError(null);
  try{await saveCoursePreparation({applicationId,course,key,action,check});await load();}
  catch(e){setError(e instanceof Error?e.message:'Could not save preparation. Refresh to try again.');}
  finally{writing.current=false;setBusy(false);region.current?.focus();}
 };
 const savedSet=new Set(data?.savedCourseIds??[]);
 const disabled=loading||busy||!data||!!error;
 return <section ref={region} tabIndex={-1} id="course-preparation" aria-label="Course preparation" className="min-w-0 scroll-mt-20">
  <Card><CardHeader><CardTitle className="text-base">Course preparation</CardTitle></CardHeader><CardContent className="space-y-4">
   <p className="text-sm text-muted-foreground">Review the recorded information and connect your supporting work. These are your preparation checks, not confirmation of eligibility or a submitted application.</p>
   <Button size="sm" variant="outline" disabled={loading||busy} onClick={()=>void load()}>Refresh preparation</Button>
   {loading&&<p role="status" className="text-sm">Loading preparation…</p>}
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   {data&&!data.courses.length&&<p className="text-sm text-muted-foreground">Save a course at this university to start preparing.</p>}
   {data?.courses.map(course=>{
    const available=course.active&&course.school_id===schoolId;
    const checks=data.checks.filter(c=>c.course_id===course.id);
    return <article key={course.id} className="min-w-0 space-y-3 rounded-lg border p-3">
     <h3 className="break-words text-sm font-semibold">{course.name}</h3>
     {!savedSet.has(course.id)&&<p className="text-xs text-muted-foreground">No longer saved</p>}
     {!available&&<p className="text-sm text-amber-800 dark:text-amber-300">This course is unavailable for this application. Your previous preparation and work are preserved; confirm the course with the provider.</p>}
     {PREPARATION_KEYS.filter(key=>checks.some(c=>c.item_key===key)||(savedSet.has(course.id)&&available)).map(key=>{
      const check=checks.find(c=>c.item_key===key),changed=!!check&&(preparationNeedsReview(check,course)||!available);
      return <div key={key} role="group" aria-label={`${course.name}: ${PREPARATION_LABELS[key]}`} className="min-w-0 space-y-2 border-t pt-3">
       <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="text-sm font-medium">{PREPARATION_LABELS[key]}</h4><span className={`text-xs ${changed?'text-amber-800 dark:text-amber-300':'text-muted-foreground'}`}>{changed?'Needs review':check?.reviewed?'Reviewed':check?'In progress':'Not started'}</span></div>
       {key==='assumed_knowledge'&&<p className="text-xs text-muted-foreground">Preparation guidance, not automatically an entry requirement.</p>}
       {changed&&<div className="space-y-2 rounded-md bg-muted/40 p-2"><p className="text-xs font-medium">Previously saved information</p><RecordedFacts snapshot={check!.snapshot}/><p className="text-xs">Recorded information changed. Compare with the current information below and check the provider before continuing.</p></div>}
       <RecordedFacts snapshot={snapshotForCourse(course,key)}/>
       <div className="flex flex-wrap gap-2">
        {!check?<Button size="sm" variant="outline" disabled={disabled||!available} onClick={()=>void run(course,key,'start')}>Start check</Button>:<>
         {changed?available&&<Button size="sm" variant="outline" disabled={disabled} onClick={()=>void run(course,key,'acknowledge',check)}>Use current information</Button>:<Button size="sm" variant="outline" disabled={disabled} onClick={()=>void run(course,key,check.reviewed?'reopen':'reviewed',check)}>{check.reviewed?'Reopen check':'Mark reviewed'}</Button>}
         <CoursePreparationWork check={check} disabled={disabled}/>
        </>}
       </div>
       {changed&&available&&<p className="text-xs text-muted-foreground">Using current information reopens this check. Supporting links stay attached for you to review.</p>}
      </div>;
     })}
    </article>;
   })}
  </CardContent></Card>
 </section>;
}
