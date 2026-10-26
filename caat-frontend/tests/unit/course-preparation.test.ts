import { describe, it, expect } from 'vitest';
import { snapshotForCourse, preparationNeedsReview } from '@/lib/course-preparation-model';
import type { CourseOffering } from '@/types/courses';
const course = {id:'c',name:'Computing',program_code:'123',campus:'City',school_id:1,active:true,prerequisites:'Mathematics',prerequisites_url:'https://example.edu/entry',assumed_knowledge:null,application_route:'Apply direct',application_url:'https://example.edu/apply',source_url:'https://example.edu/course',source_year:2026,verified_at:'2026-10-01T00:00:00Z'} as CourseOffering;
const snapshot = {name:'Computing',program_code:'123',campus:'City',school_id:1,active:true,text:'Mathematics',url:'https://example.edu/entry',source_url:'https://example.edu/course',source_year:2026,verified_at:'2026-10-01T00:00:00Z'};
describe('course preparation source review',()=>{
 it('captures exactly the recorded facts without inventing missing requirements',()=>{
  expect(snapshotForCourse(course,'prerequisites')).toEqual(snapshot);
  expect(snapshotForCourse(course,'assumed_knowledge').text).toBeNull();
  expect(snapshotForCourse(course,'assumed_knowledge').url).toBeNull();
 });
 it('requires review for changed text, source metadata and availability',()=>{
  const check={item_key:'prerequisites' as const,snapshot};
  expect(preparationNeedsReview(check,course)).toBe(false);
  for(const patch of [{prerequisites:null},{prerequisites:'Physics'},{source_year:2027},{verified_at:null},{active:false},{school_id:2},{source_url:'https://new.edu/entry'}]) expect(preparationNeedsReview(check,{...course,...patch})).toBe(true);
  expect(preparationNeedsReview(check,null)).toBe(true);
 });
 it('does not invalidate a prerequisite check when only unrelated guidance changes',()=>{
  expect(preparationNeedsReview({item_key:'prerequisites',snapshot},{...course,assumed_knowledge:'Chemistry'})).toBe(false);
 });
 it('compares values independent of JSON property order',()=>{
  expect(preparationNeedsReview({item_key:'prerequisites',snapshot:Object.fromEntries(Object.entries(snapshot).reverse())},course)).toBe(false);
 });
});
