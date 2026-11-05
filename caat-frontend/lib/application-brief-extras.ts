import type {CoursePreparation} from '@/lib/course-preparation';
import type {TaskDetails} from '@/lib/personal-tasks';
import {PREPARATION_KEYS,PREPARATION_LABELS,preparationNeedsReview,snapshotForCourse} from '@/lib/course-preparation-model';
import {courseFreshness} from '@/lib/course-data';
import {safeHref} from '@/lib/safe-href';
import {briefDate} from '@/lib/application-brief';
import type {Json} from '@/types/database';

export type BriefCourseFacts={name:string|null;programCode:string|null;campus:string|null;text:string|null;url:string|null;sourceUrl:string|null;sourceYear:number|null;checkedAt:string|null;sourceNote:string};
export type BriefCourse={key:string;title:string;code:string|null;campus:string|null;saved:boolean;available:boolean;currentMissing:boolean;items:{key:string;label:string;guidance:boolean;status:'Not started'|'In progress'|'Reviewed'|'Needs review';current:BriefCourseFacts|null;previous:BriefCourseFacts|null}[]};
export type BriefPersonalTask={key:string;text:string;date:string;status:'Open'|'Completed'};
export type BriefExtra<T>={state:'loading'|'unavailable'}|{state:'ready';rows:T[]};

/** Only these recorded facts enter the preview/print tree. Never spread a DB row. */
function facts(snapshot:Json,preparedAt:string):BriefCourseFacts {
 const row=snapshot&&typeof snapshot==='object'&&!Array.isArray(snapshot)?snapshot:{};
 const text=(key:string)=>typeof row[key]==='string'&&row[key].trim()?row[key] as string:null;
 const freshness=courseFreshness(text('verified_at'),new Date(preparedAt));
 const checkedAt=freshness==='unverified'?null:text('verified_at');
 return {name:text('name'),programCode:text('program_code'),campus:text('campus'),text:text('text'),url:safeHref(text('url')),sourceUrl:safeHref(text('source_url')),
  sourceYear:typeof row.source_year==='number'&&Number.isInteger(row.source_year)&&row.source_year>=2000&&row.source_year<=2100?row.source_year:null,checkedAt,
  sourceNote:freshness==='unverified'?'Verification not confirmed. Check the provider.':`Source checked ${briefDate(checkedAt?new Date(checkedAt).toISOString().slice(0,10):null)}.${freshness==='stale'?' More than 90 days ago; details may have changed.':' Confirm current requirements before applying.'}`};
}
export function buildBriefCourses(data:CoursePreparation,applicationId:string,schoolId:number,preparedAt:string):BriefCourse[] {
 const byId=new Map(data.courses.map(course=>[course.id,course]));
 const saved=new Set(data.savedCourseIds);
 const grouped=new Map<string,typeof data.checks>();
 for(const check of data.checks){
  if(check.application_id!==applicationId||!PREPARATION_KEYS.includes(check.item_key))throw new Error('Course preparation is unavailable');
  const previous=grouped.get(check.course_id)??[];
  if(previous.some(row=>row.item_key===check.item_key))throw new Error('Course preparation is unavailable');
  grouped.set(check.course_id,[...previous,check]);
 }
 return [...new Set([...data.savedCourseIds,...grouped.keys()])].map(id=>{
  const course=byId.get(id)??null,checks=grouped.get(id)??[];
  const available=!!course&&course.active&&course.school_id===schoolId;
  const titleFacts=course?facts(snapshotForCourse(course,'prerequisites'),preparedAt):facts(checks[0]?.snapshot??null,preparedAt);
  return {key:id,title:titleFacts.name??'Course information unavailable',code:titleFacts.programCode,campus:titleFacts.campus,saved:saved.has(id),available,currentMissing:!course,
   items:PREPARATION_KEYS.filter(key=>saved.has(id)||checks.some(check=>check.item_key===key)).map(key=>{
    const check=checks.find(row=>row.item_key===key);
    const changed=!!check&&(!available||preparationNeedsReview(check,course));
    return {key,label:PREPARATION_LABELS[key],guidance:key==='assumed_knowledge',status:changed?'Needs review' as const:check?.reviewed?'Reviewed' as const:check?'In progress' as const:'Not started' as const,
     current:course?facts(snapshotForCourse(course,key),preparedAt):null,previous:changed?facts(check!.snapshot,preparedAt):null};
   })};
 }).sort((a,b)=>a.title.localeCompare(b.title)||a.key.localeCompare(b.key));
}
export function buildBriefTasks(tasks:TaskDetails[]):BriefPersonalTask[] {
 return [...tasks].sort((a,b)=>Number(a.done)-Number(b.done)||(a.due_date??'9999-99-99').localeCompare(b.due_date??'9999-99-99')||a.id.localeCompare(b.id)).map((task,index)=>({
  key:`task-${index}`,text:task.text,date:task.due_date?(briefDate(task.due_date)==='Not recorded'?'Date not confirmed':briefDate(task.due_date)):'No due date',status:task.done?'Completed':'Open',
 }));
}
