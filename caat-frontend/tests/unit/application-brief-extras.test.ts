import {expect,it} from 'vitest';
import {buildBriefCourses,buildBriefTasks} from '@/lib/application-brief-extras';
import {snapshotForCourse} from '@/lib/course-preparation-model';
import type {CourseOffering} from '@/types/courses';
import type {PreparationCheck} from '@/types/course-preparation';
const now='2026-11-06T00:00:00Z';
const course={id:'course',name:'Computing',program_code:'123',campus:'City',school_id:7,active:true,prerequisites:'Mathematics',prerequisites_url:'https://example.edu/entry',assumed_knowledge:null,application_route:'Apply direct',application_url:'https://example.edu/apply',source_url:'https://example.edu/course',source_year:2026,verified_at:'2026-10-01T00:00:00Z'} as CourseOffering;
const check=(patch:Partial<PreparationCheck>={}):PreparationCheck=>({id:'check',user_id:'private-owner',application_id:'app',school_id:7,course_id:'course',item_key:'prerequisites',snapshot:snapshotForCourse(course,'prerequisites'),reviewed:true,revision:'private-revision',created_at:now,updated_at:now,...patch});
it('includes every saved-course preparation key without inventing unrecorded requirements',()=>{
 const rows=buildBriefCourses({courses:[course],checks:[],savedCourseIds:['course']},'app',7,now);
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({title:'Computing',saved:true,available:true});
 expect(rows[0].items.map(i=>i.status)).toEqual(['Not started','Not started','Not started']);
 expect(rows[0].items[1]).toMatchObject({label:'Review assumed knowledge',guidance:true,current:{text:null},previous:null});
 expect(rows[0].items[2].current?.url).toBe('https://example.edu/apply');
 expect(rows[0].items[0].current?.sourceNote).toContain('Source checked 1 October 2026.');
});
it('preserves reviewed status only when current facts still match',()=>{
 const rows=buildBriefCourses({courses:[course],checks:[check()],savedCourseIds:['course']},'app',7,now);
 expect(rows[0].items[0]).toMatchObject({status:'Reviewed',previous:null,current:{text:'Mathematics'}});
 const progress=buildBriefCourses({courses:[course],checks:[check({reviewed:false})],savedCourseIds:[]},'app',7,now);
 expect(progress[0].saved).toBe(false);expect(progress[0].items).toHaveLength(1);expect(progress[0].items[0].status).toBe('In progress');
});
it.each([{prerequisites:'Physics'},{active:false},{school_id:8},{verified_at:'2026-11-01T00:00:00Z'}])('separates previous facts from changed current facts for %j',patch=>{
 const rows=buildBriefCourses({courses:[{...course,...patch}],checks:[check()],savedCourseIds:['course']},'app',7,now);
 expect(rows[0].items[0].status).toBe('Needs review');expect(rows[0].items[0].previous?.text).toBe('Mathematics');
 expect(rows[0].items[0].current?.text).toBe(patch.prerequisites??'Mathematics');
});
it('does not lose recorded work when the current course row is absent',()=>{
 const rows=buildBriefCourses({courses:[],checks:[check()],savedCourseIds:[]},'app',7,now);
 expect(rows[0]).toMatchObject({title:'Computing',available:false,currentMissing:true});
 expect(rows[0].items[0]).toMatchObject({status:'Needs review',current:null,previous:{text:'Mathematics'}});
 const missing=buildBriefCourses({courses:[],checks:[],savedCourseIds:['missing']},'app',7,now);
 expect(missing).toHaveLength(1);expect(missing[0].currentMissing).toBe(true);
});
it('allowlists snapshots, rejects unsafe links and labels stale/unverified sources',()=>{
 const saved=check({snapshot:{...snapshotForCourse(course,'prerequisites'),text:'Old',url:'javascript:alert(1)',source_url:'data:text/plain,private',verified_at:'2025-01-01T00:00:00Z',essay_body:'SECRET',storage_path:'PRIVATE'}});
 const rows=buildBriefCourses({courses:[{...course,verified_at:null}],checks:[saved],savedCourseIds:[]},'app',7,now);
 expect(rows[0].items[0].previous).toMatchObject({url:null,sourceUrl:null});
 expect(rows[0].items[0].previous?.sourceNote).toContain('90 days');expect(rows[0].items[0].current?.sourceNote).toContain('not confirmed');
 for(const secret of ['SECRET','PRIVATE','private-owner','private-revision','javascript:','data:text'])expect(JSON.stringify(rows)).not.toContain(secret);
});
it('rejects a foreign application check and duplicate item states instead of printing misleading data',()=>{
 expect(()=>buildBriefCourses({courses:[course],checks:[check({application_id:'foreign'})],savedCourseIds:[]},'app',7,now)).toThrow();
 expect(()=>buildBriefCourses({courses:[course],checks:[check(),check({id:'other'})],savedCourseIds:[]},'app',7,now)).toThrow();
});
it('handles an unusable historic snapshot and excludes unrelated catalogue rows',()=>{
 const rows=buildBriefCourses({courses:[{...course,id:'unrelated'}],checks:[check({snapshot:null})],savedCourseIds:[]},'app',7,now);
 expect(rows).toHaveLength(1);expect(rows[0].currentMissing).toBe(true);expect(rows[0].items[0].previous?.text).toBeNull();
});
it('retains every personal task with safe dates and explicit completion, without private fields',()=>{
 const input=Array.from({length:55},(_,i)=>({id:String(i).padStart(2,'0'),text:`Task ${i} ${'long '.repeat(10)}`,due_date:i===54?null:'2026-11-10',done:i===54,priority:2,user_id:'PRIVATE'}));
 const before=JSON.stringify(input),rows=buildBriefTasks(input);
 expect(rows).toHaveLength(55);expect(rows[54]).toMatchObject({text:input[54].text,date:'No due date',status:'Completed'});
 expect(rows[0]).toMatchObject({date:'10 November 2026',status:'Open'});expect(JSON.stringify(rows)).not.toContain('PRIVATE');expect(JSON.stringify(input)).toBe(before);
 expect(buildBriefTasks([{...input[0],due_date:'2026-02-30'}])[0].date).toBe('Date not confirmed');
});
