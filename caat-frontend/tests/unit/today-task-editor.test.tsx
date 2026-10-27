// @vitest-environment jsdom
import React, {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {button,change,click,deferred,mountComponent,unmountAll} from './dom-helpers';
const io=vi.hoisted(()=>({edit:vi.fn(),load:vi.fn(),saved:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({supabase:{}}));
vi.mock('@/lib/personal-tasks',async importOriginal=>({
 ...await importOriginal<typeof import('@/lib/personal-tasks')>(),
 editPersonalTask:io.edit,fetchPersonalTask:io.load,
}));
import {TaskEditor} from '@/components/today/task-editor';
import {TaskAuthError,TaskConflictError} from '@/lib/personal-tasks';
const task={id:'t1',text:'Call admissions',dueDate:'2026-11-01'};
const saved={id:'t1',text:'Call maths faculty',due_date:null,priority:1,done:true};
const text=()=>document.querySelector('textarea') as HTMLTextAreaElement;
const date=()=>document.querySelector('input[type="date"]') as HTMLInputElement;
const dialog=()=>document.querySelector('[role="dialog"]');
beforeEach(()=>{vi.clearAllMocks();io.edit.mockResolvedValue(saved);io.load.mockResolvedValue(saved);});
afterEach(()=>{vi.useRealTimers();unmountAll();});
async function open(){await mountComponent(<TaskEditor task={task} disabled={false} onSaved={io.saved}/>);await click(button('Edit task: Call admissions'));}
it('starts with saved values and sends original fields for a guarded edit',async()=>{
 await open();expect(text().value).toBe(task.text);expect(date().value).toBe(task.dueDate);
 await change(text(),'Call maths faculty');await change(date(),'');await click(button('Save changes'));
 expect(io.edit).toHaveBeenCalledWith({id:'t1',text:task.text,due_date:task.dueDate},{text:'Call maths faculty',due_date:null},expect.any(AbortSignal));
 expect(io.saved).toHaveBeenCalledWith(saved);expect(dialog()).toBeNull();
 await vi.waitFor(()=>expect(document.activeElement).toBe(button('Edit task: Call admissions')));
});
it('keeps the draft after write failure and returns keyboard focus to Save',async()=>{
 io.edit.mockRejectedValueOnce(new Error('private backend'));
 await open();await change(text(),'My edited task');const save=button('Save changes');text().focus();await click(save);
 expect(text().value).toBe('My edited task');expect(document.querySelector('[role="alert"]')?.textContent).toContain('Could not confirm');
 expect(document.body.textContent).not.toContain('private backend');expect(io.saved).not.toHaveBeenCalled();expect(document.activeElement).toBe(save);
});
it('requires explicit reload after conflict, retains failed reload draft, and uses latest values on retry',async()=>{
 io.edit.mockRejectedValueOnce(new TaskConflictError());
 await open();await change(text(),'Local draft');await click(button('Save changes'));
 expect(text().value).toBe('Local draft');expect(document.body.textContent).toContain('changed or was removed');
 io.load.mockRejectedValueOnce(new Error('offline'));await click(button('Reload saved task'));expect(text().value).toBe('Local draft');
 await click(button('Reload saved task'));expect(text().value).toBe(saved.text);expect(date().value).toBe('');
 await change(text(),'Newer task');await click(button('Save changes'));
 expect(io.edit.mock.calls[1][0]).toEqual({id:'t1',text:saved.text,due_date:null});
});
it('reports removed task on reload and prevents saving it',async()=>{
 await open();io.load.mockResolvedValueOnce(null);await click(button('Reload saved task'));
 expect(document.body.textContent).toContain('no longer available');expect(button('Save changes').getAttribute('aria-disabled')).toBe('true');
 await click(button('Save changes'));expect(io.edit).not.toHaveBeenCalled();
});
it('bounds a stalled write and prevents late success from closing the recovered draft',async()=>{
 const pending=deferred<typeof saved>();io.edit.mockReturnValueOnce(pending.promise);
 await open();await change(text(),'Keep this draft');vi.useFakeTimers();const save=button('Save changes');await click(save);await click(save);
 expect(io.edit).toHaveBeenCalledTimes(1);expect(button('Cancel').disabled).toBe(true);
 await act(async()=>{await vi.advanceTimersByTimeAsync(30000);});
 expect(text().value).toBe('Keep this draft');expect(button('Cancel').disabled).toBe(false);expect(io.edit.mock.calls[0][2].aborted).toBe(true);
 await act(async()=>pending.resolve(saved));expect(dialog()).not.toBeNull();expect(io.saved).not.toHaveBeenCalled();
});
it('disables Edit while completion is pending',async()=>{
 await mountComponent(<TaskEditor task={task} disabled onSaved={io.saved}/>);
 expect(button('Edit task: Call admissions').disabled).toBe(true);
});
it('does not treat a partially entered native date as intentionally clearing the due date',async()=>{
 await open();await change(date(),'');
 Object.defineProperty(date(),'validity',{configurable:true,value:{badInput:true}});
 await click(button('Save changes'));
 expect(io.edit).not.toHaveBeenCalled();expect(document.querySelector('[role="alert"]')?.textContent).toContain('Complete the due date');
});

it('allows canceling a slow reload and ignores its response after reopening',async()=>{
 const pending=deferred<typeof saved>();io.load.mockReturnValueOnce(pending.promise);
 await open();await change(text(),'Local draft');await click(button('Reload saved task'));
 expect(button('Cancel').disabled).toBe(false);await click(button('Cancel'));expect(dialog()).toBeNull();
 await click(button('Edit task: Call admissions'));await change(text(),'New session draft');
 await act(async()=>pending.resolve(saved));expect(text().value).toBe('New session draft');
});
it('explains expired authentication and offers sign in while retaining the draft',async()=>{
 io.edit.mockRejectedValueOnce(new TaskAuthError());await open();await change(text(),'Unsaved correction');await click(button('Save changes'));
 expect(document.querySelector('[role="alert"]')?.textContent).toContain('sign in');expect(text().value).toBe('Unsaved correction');
 expect(new URL(document.querySelector('[role="alert"] a')!.getAttribute('href')!, 'https://caat.test').searchParams.get('next')).toBe('/today');
});


it('labels and focuses invalid task text and clears its field error when corrected',async()=>{
 await open();await change(text(),'   ');await click(button('Save changes'));
 expect(text().getAttribute('aria-invalid')).toBe('true');
 expect(document.getElementById(text().getAttribute('aria-describedby')!)?.textContent).toContain('1,000');
 expect(document.activeElement).toBe(text());expect(date().getAttribute('aria-invalid')).not.toBe('true');
 await change(text(),'Corrected task');expect(text().getAttribute('aria-invalid')).not.toBe('true');
 expect(io.edit).not.toHaveBeenCalled();
});
it('associates incomplete date feedback with the date field',async()=>{
 await open();Object.defineProperty(date(),'validity',{configurable:true,value:{badInput:true}});
 await click(button('Save changes'));
 expect(date().getAttribute('aria-invalid')).toBe('true');
 expect(document.getElementById(date().getAttribute('aria-describedby')!)?.textContent).toContain('Complete the due date');
 expect(document.activeElement).toBe(date());
});
it('leaves a missing task draft read-only and copyable until explicit close',async()=>{
 const missing=vi.fn();await mountComponent(<TaskEditor task={task} disabled={false} onSaved={io.saved} onMissing={missing}/>);
 await click(button('Edit task: Call admissions'));await change(text(),'Copy this draft');
 io.load.mockResolvedValueOnce(null);await click(button('Reload saved task'));
 expect(text().value).toBe('Copy this draft');expect(text().disabled).toBe(false);expect(text().readOnly).toBe(true);
 expect(missing).not.toHaveBeenCalled();await click(button('Cancel'));expect(missing).toHaveBeenCalledWith('t1');
});
it('clears confirmed missing state after a successful reload before close',async()=>{
 const missing=vi.fn();await mountComponent(<TaskEditor task={task} disabled={false} onSaved={io.saved} onMissing={missing}/>);
 await click(button('Edit task: Call admissions'));io.load.mockResolvedValueOnce(null);await click(button('Reload saved task'));
 await click(button('Reload saved task'));await click(button('Cancel'));expect(missing).not.toHaveBeenCalled();
});
it('falls back to a stable region when the Edit opener becomes disabled',async()=>{
 function Harness(){const [disabled,setDisabled]=React.useState(false);const fallback=React.useRef<HTMLElement>(null);
 return <><section ref={fallback} tabIndex={-1} aria-label="Your to-dos"/><button onClick={()=>setDisabled(true)}>Pending completion</button><TaskEditor task={task} disabled={disabled} onSaved={io.saved} fallbackFocusRef={fallback}/></>;}
 await mountComponent(<Harness/>);await click(button('Edit task: Call admissions'));await click(button('Pending completion'));await click(button('Cancel'));
 await vi.waitFor(()=>expect(document.activeElement).toBe(document.querySelector('[aria-label="Your to-dos"]')));
});
it('keeps the focused Today return destination on expired authentication',async()=>{
 io.edit.mockRejectedValueOnce(new TaskAuthError());await mountComponent(<TaskEditor task={task} disabled={false} onSaved={io.saved} returnTo="/today?view=todos&page=2"/>);
 await click(button('Edit task: Call admissions'));await click(button('Save changes'));
 expect(new URL(document.querySelector('[role="alert"] a')!.getAttribute('href')!,'https://caat.test').searchParams.get('next')).toBe('/today?view=todos&page=2');
});
