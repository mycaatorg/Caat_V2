import type { CourseOffering } from '@/types/courses';
import type { PreparationCheck, PreparationKey } from '@/types/course-preparation';
export const PREPARATION_LABELS: Record<PreparationKey,string> = {
 prerequisites:'Review prerequisites', assumed_knowledge:'Review assumed knowledge', application_route:'Review how to apply',
};
export const PREPARATION_KEYS = Object.keys(PREPARATION_LABELS) as PreparationKey[];
export function snapshotForCourse(course:CourseOffering,key:PreparationKey) {
 return {name:course.name,program_code:course.program_code,campus:course.campus,school_id:course.school_id,active:course.active,
  text:course[key],url:key==='prerequisites'?course.prerequisites_url:key==='application_route'?course.application_url:null,
  source_url:course.source_url,source_year:course.source_year,verified_at:course.verified_at};
}
export function preparationNeedsReview(check:Pick<PreparationCheck,'item_key'|'snapshot'>,course:CourseOffering|null):boolean {
 if(!course||!check.snapshot||typeof check.snapshot!=='object'||Array.isArray(check.snapshot)) return true;
 const current=snapshotForCourse(course,check.item_key);
 return Object.entries(current).some(([key,value])=> (check.snapshot as Record<string,unknown>)[key]!==value);
}
