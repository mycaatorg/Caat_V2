// @vitest-environment jsdom
import React, {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mountComponent,unmountAll,button,click,queryAll,deferred} from './dom-helpers';
import {snapshotForCourse} from '@/lib/course-preparation-model';
import type {CourseOffering} from '@/types/courses';
import type {PreparationCheck} from '@/types/course-preparation';
const state=vi.hoisted(()=>({fetch:vi.fn(),save:vi.fn()}));
vi.mock('@/lib/course-preparation',()=>({fetchCoursePreparation:state.fetch,saveCoursePreparation:state.save}));
vi.mock('@/components/applications/course-preparation-work',()=>({CoursePreparationWork:()=>null}));
import {CoursePreparationCard} from '@/components/applications/course-preparation-card';
const course={id:'c',name:'Computing',program_code:'123',campus:null,school_id:1,active:true,prerequisites:'Maths',prerequisites_url:null,assumed_knowledge:null,application_route:null,application_url:null,source_url:'https://example.edu',source_year:2026,verified_at:null} as CourseOffering;
let check:PreparationCheck;
beforeEach(()=>{check={id:'check',user_id:'u',application_id:'a',school_id:1,course_id:'c',item_key:'prerequisites',snapshot:snapshotForCourse(course,'prerequisites'),reviewed:true,revision:'r',created_at:'',updated_at:''};state.fetch.mockReset().mockResolvedValue({checks:[check],courses:[course],savedCourseIds:["c"]});state.save.mockReset();});
afterEach(unmountAll);
it('requires explicit acknowledgement before a changed check can be marked reviewed',async()=>{
 const current={...course,prerequisites:'Physics'};state.fetch.mockResolvedValue({checks:[check],courses:[current],savedCourseIds:current.active?["c"]:[]});
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 expect(c.textContent).toContain('Needs review');expect(c.textContent).toContain('Maths');expect(c.textContent).toContain('Physics');
 expect(queryAll('button','Mark reviewed',c)).toHaveLength(0);
 state.save.mockImplementation(async()=>{check={...check,reviewed:false,snapshot:snapshotForCourse(current,'prerequisites'),revision:'r2'};state.fetch.mockResolvedValue({checks:[check],courses:[current],savedCourseIds:current.active?["c"]:[]});return check;});
 await click(button('Use current information',c));
 expect(state.save.mock.calls[0][0].action).toBe('acknowledge');expect(c.textContent).not.toContain('Needs review');expect(button('Mark reviewed',c).disabled).toBe(false);
});
it('retains unsaved preparation and disables completion when the course is inactive',async()=>{
 const current={...course,active:false};state.fetch.mockResolvedValue({checks:[check],courses:[current],savedCourseIds:current.active?["c"]:[]});
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 expect(c.textContent).toContain('No longer saved');expect(c.textContent).toContain('unavailable');expect(queryAll('button','Use current information',c)).toHaveLength(0);
});
it('shows a retryable load failure rather than empty or successful preparation',async()=>{
 state.fetch.mockRejectedValueOnce(new Error('offline'));
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 expect(c.querySelector('[role="alert"]')).not.toBeNull();await click(button('Refresh preparation',c));expect(c.textContent).toContain('Reviewed');
});
it('keeps reviewed state when reopening fails and asks the student to refresh',async()=>{
 state.save.mockRejectedValue(new Error('Changed elsewhere. Refresh.'));
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 await click(button('Reopen check',c));expect(c.textContent).toContain('Reviewed');expect(c.querySelector('[role="alert"]')?.textContent).toContain('Refresh');
});

it('ignores an older load that completes after a newer focus refresh',async()=>{
 const old=deferred<{checks:PreparationCheck[];courses:CourseOffering[];savedCourseIds:string[]}>();
 state.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce({checks:[check],courses:[{...course,prerequisites:'Physics'}],savedCourseIds:['c']});
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 await act(async()=>window.dispatchEvent(new Event('focus')));
 expect(c.textContent).toContain('Needs review');
 await act(async()=>old.resolve({checks:[check],courses:[course],savedCourseIds:['c']}));
 expect(c.textContent).toContain('Needs review');expect(c.textContent).toContain('Physics');
});
it('shows both course identities for campus/program-only changes before acknowledgement',async()=>{
 const previous={...course,campus:'City campus'},current={...course,campus:'Regional campus',program_code:'456'};
 check={...check,snapshot:snapshotForCourse(previous,'prerequisites')};
 state.fetch.mockResolvedValue({checks:[check],courses:[current],savedCourseIds:['c']});
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 expect(c.textContent).toContain('City campus');expect(c.textContent).toContain('Regional campus');expect(c.textContent).toContain('123');expect(c.textContent).toContain('456');
 expect(c.querySelector('[role="group"]')?.getAttribute('aria-label')).toContain('456');
 expect(c.querySelector('[role="group"]')?.getAttribute('aria-label')).toContain('Regional campus');
 expect(button('Use current information',c)).toBeDefined();
});

it('keeps keyboard focus on the next action and announces the refreshed status',async()=>{
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 const opener=button('Reopen check',c);opener.focus();
 state.save.mockImplementation(async()=>{check={...check,reviewed:false};state.fetch.mockResolvedValue({checks:[check],courses:[course],savedCourseIds:['c']});return check;});
 await click(opener);expect(document.activeElement).toBe(button('Mark reviewed',c));expect(c.querySelector('[aria-live="polite"]')?.textContent).toContain('In progress');
 state.save.mockImplementation(async()=>{check={...check,reviewed:true};state.fetch.mockResolvedValue({checks:[check],courses:[course],savedCourseIds:['c']});return check;});
 await click(button('Mark reviewed',c));expect(document.activeElement).toBe(button('Reopen check',c));expect(c.querySelector('[aria-live="polite"]')?.textContent).toContain('Reviewed');
});
it('focuses the changed-source row action after acknowledgement',async()=>{
 const current={...course,prerequisites:'Physics'};state.fetch.mockResolvedValue({checks:[check],courses:[current],savedCourseIds:['c']});
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);state.save.mockImplementation(async()=>{check={...check,reviewed:false,snapshot:snapshotForCourse(current,'prerequisites')};state.fetch.mockResolvedValue({checks:[check],courses:[current],savedCourseIds:['c']});return check;});
 await click(button('Use current information',c));expect(document.activeElement).toBe(button('Mark reviewed',c));expect(c.querySelector('[aria-live="polite"]')?.textContent).toContain('In progress');
});
it('keeps failed-write focus on the row and never announces a successful status',async()=>{
 state.save.mockRejectedValue(new Error('Could not confirm. Refresh.'));const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);
 const row=c.querySelector('[role="group"]');await click(button('Reopen check',c));expect(document.activeElement).toBe(row);expect(c.querySelector('[role="alert"]')?.textContent).toContain('Could not confirm');expect(c.querySelector('[aria-live="polite"]')?.textContent).not.toContain('In progress');
});
it('falls back to the preparation section when the acted-on row disappears',async()=>{
 const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);state.save.mockImplementation(async()=>{state.fetch.mockResolvedValue({checks:[],courses:[],savedCourseIds:[]});return check;});
 await click(button('Reopen check',c));expect(document.activeElement).toBe(c.querySelector('section'));expect(c.querySelector('[aria-live="polite"]')?.textContent).toContain('no longer shown');
});
it('does not steal focus if the user moves elsewhere during a write',async()=>{
 const pending=deferred<PreparationCheck>();state.save.mockReturnValue(pending.promise);const c=await mountComponent(<CoursePreparationCard applicationId="a" schoolId={1}/>);const elsewhere=document.createElement('button');elsewhere.textContent='Elsewhere';document.body.append(elsewhere);
 await click(button('Reopen check',c));elsewhere.focus();await act(async()=>pending.resolve(check));expect(document.activeElement).toBe(elsewhere);
});
