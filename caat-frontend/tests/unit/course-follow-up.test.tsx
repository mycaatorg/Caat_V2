// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountComponent, unmountAll, button, click, change, link, flush } from './dom-helpers';
import type { HubCourse } from '@/lib/course-data';
const io = vi.hoisted(()=>({add:vi.fn()}));
vi.mock('@/components/dashboard/api',()=>({addTodo:io.add}));
vi.mock('next/link',()=>({default:({href,children,...rest}: React.PropsWithChildren<{href:string}>)=><a href={href} {...rest}>{children}</a>}));
import { CourseFollowUp } from '@/components/courses/course-follow-up';
const course:HubCourse = {id:'cs',name:'Computing',campus:null,application_route:null,application_url:null,source_url:'https://example.edu.au',verified_at:null,active:true,prerequisites:'Maths',prerequisites_url:null,assumed_knowledge:null,source_year:2027};
beforeEach(()=>{io.add.mockReset();io.add.mockResolvedValue({id:'todo1'});});
afterEach(unmountAll);
const dialog = () => document.querySelector('[role="dialog"]');
const field = () => document.querySelector('textarea') as HTMLTextAreaElement;
const date = () => document.querySelector('input[type="date"]') as HTMLInputElement;
const status = () => document.querySelector('[role="status"]');
const alert = () => document.querySelector('[role="alert"]');
async function open(){await mountComponent(<CourseFollowUp course={course} schoolName="Alpha University"/>);await click(button('Plan a follow-up for Computing'));}
it('creates an edited personal task with an optional due date and opens the correct Today view',async()=>{
 await open();
 expect(field().value).toBe('Confirm entry requirements for Computing at Alpha University');
 await change(field(),'  Ask about bridging maths  ');await change(date(),'2026-11-01');
 await click(button('Save to Today'));
 expect(dialog()).toBeNull();
 expect(io.add).toHaveBeenCalledWith('Ask about bridging maths',{due_date:'2026-11-01',priority:2});
 expect(status()?.textContent).toContain('Saved to your personal to-dos');
 expect(link('View on Today').getAttribute('href')).toBe('/today?view=todos');
});
it('retains edited text and date after failure and allows retry without exposing backend details',async()=>{
 io.add.mockRejectedValueOnce(new Error('private SQL backend error'));
 await open();await change(field(),'Call admissions');await change(date(),'2026-11-02');
 await click(button('Save to Today'));
 expect(alert()?.textContent).toContain('Could not confirm');
 expect(alert()?.textContent).not.toContain('SQL');
 expect(field().value).toBe('Call admissions');expect(date().value).toBe('2026-11-02');
 await click(button('Save to Today'));expect(dialog()).toBeNull();
});
it('blocks repeated submissions and closing during a pending save',async()=>{
 let resolve!:(v:unknown)=>void;io.add.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 await open();const save=button('Save to Today');
 await act(async()=>{save.click();save.click();});
 await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(dialog()).not.toBeNull();expect(io.add).toHaveBeenCalledTimes(1);
 expect(button('Cancel').disabled).toBe(true);
 await act(async()=>resolve({id:'todo1'}));
});
it('rejects empty tasks and bounds free text',async()=>{
 await open();expect(field().getAttribute('maxlength')).toBe('1000');
 await change(field(),'   ');await click(button('Save to Today'));
 expect(io.add).not.toHaveBeenCalled();
 expect(dialog()?.textContent).toContain('does not confirm eligibility or submit an application');
});
it('returns focus to the explicit opener even when pointer opening did not focus it',async()=>{
 await mountComponent(<CourseFollowUp course={course} schoolName="Alpha University"/>);
 const opener=button('Plan a follow-up for Computing');
 await click(opener);await click(button('Cancel'));await flush();
 expect(document.activeElement).toBe(opener);
});
