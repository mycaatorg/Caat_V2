import { supabase } from '@/lib/supabase/client';
import { evidenceUserId } from '@/lib/evidence-items';
import { evidencePages } from '@/lib/evidence-pagination';
import { snapshotForCourse } from '@/lib/course-preparation-model';
import type { CourseOffering } from '@/types/courses';
import type { PreparationCheck, PreparationWork, PreparationAction, PreparationKey } from '@/types/course-preparation';
import type { WorkSource } from '@/lib/requirement-evidence';
export type CoursePreparation = { checks:PreparationCheck[]; courses:CourseOffering[] };
const LOAD_ERROR='Could not load course preparation. Refresh to try again.';
export async function fetchCoursePreparation(applicationId?:string):Promise<CoursePreparation> {
 const userId=await evidenceUserId();
 const checks=await evidencePages((from,to)=>{
  let q=supabase.from('course_preparation_checks').select('*').eq('user_id',userId);
  if(applicationId) q=q.eq('application_id',applicationId);
  return q.order('id').range(from,to);
 },LOAD_ERROR);
 const ids=[...new Set(checks.map(c=>c.course_id))],courses:CourseOffering[]=[];
 for(let i=0;i<ids.length;i+=100) courses.push(...await evidencePages((from,to)=>supabase.from('course_offerings').select('*').in('id',ids.slice(i,i+100)).order('id').range(from,to),LOAD_ERROR));
 return {checks,courses};
}
export async function saveCoursePreparation(input:{applicationId:string;course:CourseOffering;key:PreparationKey;action:PreparationAction;check?:PreparationCheck}):Promise<PreparationCheck> {
 await evidenceUserId();
 const {data,error}=await supabase.rpc('save_course_preparation',{p_application_id:input.applicationId,p_course_id:input.course.id,p_item_key:input.key,p_action:input.action,p_expected_revision:input.check?.revision??null,p_expected_snapshot:snapshotForCourse(input.course,input.key)});
 if(error||data?.length!==1) throw new Error(error?.code==='40001'||error?.code==='23505'?'Preparation or course information changed elsewhere. Refresh and review it before saving again.':'Could not save preparation. Refresh to check this course and application are still available.');
 return data[0];
}
export async function fetchCoursePreparationWork(applicationId:string):Promise<PreparationWork[]> {
 const userId=await evidenceUserId();
 return evidencePages((from,to)=>supabase.from('course_preparation_work').select('*').eq('user_id',userId).eq('application_id',applicationId).order('id').range(from,to),LOAD_ERROR);
}
export async function linkCoursePreparationWork(check:PreparationCheck,source:Pick<WorkSource,'kind'|'id'>):Promise<void> {
 const userId=await evidenceUserId();
 const {error}=await supabase.from('course_preparation_work').insert({user_id:userId,application_id:check.application_id,check_id:check.id,evidence_link_id:source.kind==='evidence'?source.id:null,essay_draft_id:source.kind==='draft'?source.id:null});
 if(error&&error.code!=='23505') throw new Error('Could not link this work. Refresh to check the source is still available in this application.');
}
export async function unlinkCoursePreparationWork(link:PreparationWork):Promise<void> {
 const userId=await evidenceUserId();
 const {data,error}=await supabase.from('course_preparation_work').delete().eq('user_id',userId).eq('id',link.id).select('id');
 if(error||data?.length!==1) throw new Error('This link could not be removed or changed elsewhere. Refresh and try again.');
}
