// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {button,click,deferred,flush,mountComponent,unmountAll} from './dom-helpers';
import {briefHub} from './application-brief-fixture';
const io=vi.hoisted(()=>({read:vi.fn(),courses:vi.fn(),tasks:vi.fn(),auth:{user:{id:'owner'} as {id:string}|null,loading:false}}));
vi.mock('@/app/(main)/applications/[id]/api',()=>({fetchApplicationHub:io.read}));
vi.mock('@/lib/course-preparation',()=>({fetchCoursePreparation:io.courses}));
vi.mock('@/lib/application-tasks',()=>({fetchApplicationTasks:io.tasks}));
vi.mock('@/components/providers/AuthContext',()=>({useAuth:()=>io.auth}));
import ApplicationBriefClient from '@/app/(main)/applications/[id]/brief/client';
const preview=()=>document.querySelector('[data-application-brief-preview]')!;
const portal=()=>document.querySelector('[data-print-application]');
beforeEach(()=>{vi.clearAllMocks();io.auth={user:{id:'owner'},loading:false};io.read.mockResolvedValue(briefHub());io.courses.mockResolvedValue({courses:[],checks:[],savedCourseIds:[]});io.tasks.mockResolvedValue([{id:'task',text:'Personal preparation',due_date:null,done:false,priority:2}]);vi.spyOn(window,'print').mockImplementation(()=>{});});
afterEach(()=>{unmountAll();vi.restoreAllMocks();});
it('previews the same notes choice that the print portal uses, without including notes by default',async()=>{
 await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();expect(preview().textContent).toContain('Example University');expect(portal()?.textContent).not.toContain('Private application notes');
 await click(document.querySelector('input[type=checkbox]')!);expect(preview().textContent).toContain('Private application notes');expect(portal()?.textContent).toContain('Private application notes');
 await click(button('Print / Save PDF'));expect(window.print).toHaveBeenCalledTimes(1);
 await click(document.querySelector('input[type=checkbox]')!);expect(preview().textContent).not.toContain('Private application notes');expect(portal()?.textContent).not.toContain('Private application notes');
});
it('does not create a print portal on failure and recovers on retry',async()=>{
 io.read.mockRejectedValueOnce(new Error('private backend'));await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();expect(portal()).toBeNull();expect(document.body.textContent).not.toContain('private backend');
 await click(button('Retry brief'));await flush();expect(portal()).not.toBeNull();expect(button('Print / Save PDF').disabled).toBe(false);
});
it.each(['account','application'])('discards an older %s response and removes the portal on sign-out',async(kind)=>{
 const pending=deferred<ReturnType<typeof briefHub>>();io.read.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(briefHub({schoolName:'New school'}));
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try{
  await act(async()=>root.render(<ApplicationBriefClient applicationId="app"/>));expect(portal()).toBeNull();
  if(kind==='account')io.auth.user={id:'new-owner'};
  const id=kind==='application'?'new-app':'app';await act(async()=>root.render(<ApplicationBriefClient applicationId={id}/>));await flush();
  await act(async()=>pending.resolve(briefHub()));expect(portal()?.textContent).toContain('New school');expect(portal()?.textContent).not.toContain('Example University');
  io.auth.user=null;await act(async()=>root.render(<ApplicationBriefClient applicationId={id}/>));expect(portal()).toBeNull();expect(document.body.textContent).not.toContain('New school');
 }finally{act(()=>root.unmount());c.remove();}
});

import { scholarshipBriefHub } from './application-brief-fixture';
const scholarshipChoice=()=>document.querySelector<HTMLInputElement>('input[name="includeScholarships"]')!;
it('includes scholarship checklists only on explicit selection in both preview and print',async()=>{
 io.read.mockResolvedValue(scholarshipBriefHub());await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();
 expect(preview().textContent).not.toContain('Attached award');await click(scholarshipChoice());
 expect(preview().textContent).toContain('Attached award');expect(portal()?.textContent).toContain('Attached award');expect(portal()?.textContent).not.toContain('Other application award');
 expect(portal()?.textContent).not.toContain('Private application notes');await click(scholarshipChoice());expect(portal()?.textContent).not.toContain('Attached award');
});
it.each(['savedScholarshipsUnavailable','prepChecksUnavailable'] as const)('blocks requested incomplete checklists for %s and lets the student exclude them',async key=>{
 io.read.mockResolvedValue(scholarshipBriefHub({[key]:true}));await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();await click(scholarshipChoice());
 expect(document.querySelector('[role=alert]')?.textContent).toContain('Could not load the attached scholarship checklists');
 expect(button('Print / Save PDF').disabled).toBe(true);expect(portal()).toBeNull();expect(preview().textContent).not.toContain('Attached award');
 await click(scholarshipChoice());expect(button('Print / Save PDF').disabled).toBe(false);expect(portal()).not.toBeNull();
});
it('refreshes unavailable optional data without printing stale snapshots, then keeps the requested choice',async()=>{
 const pending=deferred<ReturnType<typeof briefHub>>();io.read.mockResolvedValueOnce(scholarshipBriefHub({prepChecksUnavailable:true})).mockReturnValueOnce(pending.promise);
 await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();await click(scholarshipChoice());await click(button('Refresh brief'));
 expect(portal()).toBeNull();expect(document.querySelector('[data-application-brief-preview]')).toBeNull();
 await act(async()=>pending.resolve(scholarshipBriefHub()));expect((scholarshipChoice() as HTMLInputElement).checked).toBe(true);expect(portal()?.textContent).toContain('Attached award');expect(button('Print / Save PDF').disabled).toBe(false);
});
it.each(['account','application'])('resets scholarship and notes choices on an %s change',async kind=>{
 io.read.mockResolvedValue(scholarshipBriefHub());const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try {
  await act(async()=>root.render(<ApplicationBriefClient applicationId="app"/>));await flush();await click(scholarshipChoice());await click(c.querySelector<HTMLInputElement>('input[type=checkbox]')!);
  expect(portal()?.textContent).toContain('Attached award');expect(portal()?.textContent).toContain('Private application notes');
  if(kind==='account')io.auth.user={id:'other-owner'};
  await act(async()=>root.render(<ApplicationBriefClient applicationId={kind==='application'?'new-app':'app'}/>));await flush();
  expect((scholarshipChoice() as HTMLInputElement).checked).toBe(false);expect(portal()?.textContent).not.toContain('Attached award');expect(portal()?.textContent).not.toContain('Private application notes');
 }finally{act(()=>root.unmount());c.remove();}
});
const extraChoice=(kind:'Courses'|'Tasks')=>document.querySelector<HTMLInputElement>(`input[name="include${kind}"]`)!;
it('keeps course and personal task details and reads off until explicitly selected',async()=>{
 await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();
 expect(extraChoice('Courses').checked).toBe(false);expect(extraChoice('Tasks').checked).toBe(false);expect(io.courses).not.toHaveBeenCalled();expect(io.tasks).not.toHaveBeenCalled();
 await click(extraChoice('Tasks'));await flush();expect(preview().textContent).toContain('Personal preparation');expect(portal()?.textContent).toBe(preview().textContent);
 expect(io.tasks).toHaveBeenCalledWith('app');expect(io.courses).not.toHaveBeenCalled();
 await click(extraChoice('Courses'));await flush();expect(io.courses).toHaveBeenCalledWith('app',7);expect(portal()?.textContent).toContain('No course preparation recorded');
 await click(extraChoice('Tasks'));expect(portal()?.textContent).not.toContain('Personal preparation');expect(extraChoice('Courses').checked).toBe(true);
});
it.each(['Courses','Tasks'] as const)('blocks printing while selected %s loads, ignores deselected late results and refetches on reselection',async kind=>{
 const pending=deferred<unknown>(),reader=kind==='Courses'?io.courses:io.tasks;
 reader.mockReturnValueOnce(pending.promise);await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();await click(extraChoice(kind));
 expect(button('Print / Save PDF').disabled).toBe(true);expect(portal()).toBeNull();
 await click(extraChoice(kind));expect(button('Print / Save PDF').disabled).toBe(false);expect(portal()).not.toBeNull();
 await act(async()=>pending.resolve(kind==='Courses'?{courses:[],checks:[],savedCourseIds:[]}:[{id:'old',text:'Old deselected task',due_date:null,done:false,priority:2}]));
 expect(portal()?.textContent).not.toContain('Old deselected task');
 const next=deferred<unknown>();reader.mockReturnValueOnce(next.promise);await click(extraChoice(kind));
 expect(portal()).toBeNull();expect(button('Print / Save PDF').disabled).toBe(true);expect(reader).toHaveBeenCalledTimes(2);
 await act(async()=>next.resolve(kind==='Courses'?{courses:[],checks:[],savedCourseIds:[]}:[]));expect(portal()).not.toBeNull();
});
it.each(['Courses','Tasks'] as const)('does not print failed selected %s, and refreshes without using old optional data',async kind=>{
 const reader=kind==='Courses'?io.courses:io.tasks;reader.mockRejectedValueOnce(new Error('SECRET database error'));
 await mountComponent(<ApplicationBriefClient applicationId="app"/>);await flush();await click(extraChoice(kind));await flush();
 expect(portal()).toBeNull();expect(button('Print / Save PDF').disabled).toBe(true);expect(document.body.textContent).not.toContain('SECRET');
 const pending=deferred<unknown>();reader.mockReturnValueOnce(pending.promise);await click(button('Refresh brief'));await flush();
 expect(extraChoice(kind).checked).toBe(true);expect(portal()).toBeNull();
 await act(async()=>pending.resolve(kind==='Courses'?{courses:[],checks:[],savedCourseIds:[]}:[]));expect(button('Print / Save PDF').disabled).toBe(false);
});
it.each(['account','application'])('resets private extras and ignores their old requests on %s change',async kind=>{
 const pending=deferred<unknown>();io.tasks.mockReturnValueOnce(pending.promise);
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c);
 try {
  await act(async()=>root.render(<ApplicationBriefClient applicationId="app"/>));await flush();await click(extraChoice('Tasks'));await click(extraChoice('Courses'));await flush();
  if(kind==='account')io.auth.user={id:'new-owner'};
  await act(async()=>root.render(<ApplicationBriefClient applicationId={kind==='application'?'new-app':'app'}/>));await flush();
  expect(extraChoice('Tasks').checked).toBe(false);expect(extraChoice('Courses').checked).toBe(false);
  await act(async()=>pending.resolve([{id:'old',text:'PRIVATE old account',due_date:null,done:false,priority:2}]));expect(portal()?.textContent).not.toContain('PRIVATE old account');
 }finally{act(()=>root.unmount());c.remove();}
});
