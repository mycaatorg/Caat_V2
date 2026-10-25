// @vitest-environment jsdom
import React, {act} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {button,change,click,deferred,mountComponent,unmountAll} from './dom-helpers';
const io=vi.hoisted(()=>({edit:vi.fn(),load:vi.fn(),saved:vi.fn()}));
vi.mock('@/lib/personal-tasks',()=>({
 editPersonalTask:io.edit,fetchPersonalTask:io.load,
 TaskConflictError:class extends Error {constructor(){super('This task changed or was removed elsewhere. Reload the saved task before trying again.');}},
 validatePersonalTask:(patch:{text:string;due_date:string|null})=>{if(!patch.text.trim())throw new Error('Write a task');return {...patch,text:patch.text.trim()};},
}));
import {TaskEditor} from '@/components/today/task-editor';
import {TaskConflictError} from '@/lib/personal-tasks';
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
