'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {fetchCoursePreparation,type CoursePreparation} from '@/lib/course-preparation';
import {preparationNeedsReview,PREPARATION_LABELS} from '@/lib/course-preparation-model';
export function CoursePreparationReview(){
 const [data,setData]=useState<CoursePreparation|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true);const generation=useRef(0);
 const load=useCallback(async()=>{const request=++generation.current;setLoading(true);try{const next=await fetchCoursePreparation();if(request===generation.current){setData(next);setError(false);}}catch{if(request===generation.current){setData(null);setError(true);}}finally{if(request===generation.current)setLoading(false);}},[]);
 const cancelPending=useCallback(()=>{generation.current++;},[]);
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('focus',refresh);return()=>{cancelPending();window.removeEventListener('focus',refresh);};},[load,cancelPending]);
 const changed=data?.checks.filter(check=>{const course=data.courses.find(c=>c.id===check.course_id);return !course||!course.active||course.school_id!==check.school_id||preparationNeedsReview(check,course);})??[];
 if(!error&&!changed.length)return null;
 return <section aria-label="Course preparation needs review" className="mx-auto mt-4 max-w-6xl rounded-lg border border-amber-300 p-4">
  <h2 className="text-base font-semibold">Review course information</h2>
  {error?<p role="alert" className="text-sm">Course preparation could not be checked. Retry to see whether any recorded information changed.</p>:<><p className="text-sm text-muted-foreground">Recorded information changed or a course became unavailable. Your preparation and supporting work are preserved.</p><ul className="mt-2 space-y-2">{changed.map(check=><li key={check.id}><Link className="text-sm underline" href={`/applications/${check.application_id}#course-preparation`}>{data?.courses.find(c=>c.id===check.course_id)?.name??'Course'}: {PREPARATION_LABELS[check.item_key]}</Link></li>)}</ul></>}
  <Button className="mt-2" size="sm" variant="ghost" disabled={loading} onClick={()=>void load()}>Refresh course checks</Button>
 </section>;
}
