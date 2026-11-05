// @vitest-environment jsdom
import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({auth:{user:{id:'owner'} as {id:string}|null,loading:false},read:vi.fn(),available:vi.fn(),create:vi.fn(),link:vi.fn(),unlink:vi.fn(),toggle:vi.fn()}));
vi.mock('@/components/providers/AuthContext',()=>({useAuth:()=>io.auth}));
vi.mock('@/lib/supabase/client',()=>({supabase:{}}));
vi.mock('@/lib/application-tasks',()=>({fetchApplicationTasks:io.read,fetchAvailableApplicationTasks:io.available,createApplicationTask:io.create,linkApplicationTask:io.link,unlinkApplicationTask:io.unlink}));
vi.mock('@/components/dashboard/api',()=>({toggleTodo:io.toggle}));
vi.mock('@/components/today/task-editor',()=>({TaskEditor:({task,disabled,onSaved}:{task:{id:string;text:string};disabled:boolean;onSaved:()=>void})=><button disabled={disabled} onClick={onSaved}>Edit {task.text}</button>}));
vi.mock('next/link',()=>({default:({href,children,...props}:React.PropsWithChildren<{href:string}>)=><a href={href} {...props}>{children}</a>}));
import {ApplicationPersonalTasks} from '@/components/applications/application-personal-tasks';
const task=(id='one')=>({id,text:`Task ${id}`,due_date:null,done:false,priority:2});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};}
beforeEach(()=>{vi.resetAllMocks();io.auth={user:{id:'owner'},loading:false};io.read.mockResolvedValue([task()]);io.available.mockResolvedValue([]);io.create.mockResolvedValue(task('new'));io.link.mockResolvedValue(undefined);io.unlink.mockResolvedValue(undefined);io.toggle.mockResolvedValue(undefined);});
afterEach(cleanup);
const mount=()=>render(<ApplicationPersonalTasks applicationId="app"/>);
const loaded=()=>screen.findByRole('checkbox',{name:'Mark Task one done'});
it('shows personal work separately from official requirements and preserves completed tasks',async()=>{
 io.read.mockResolvedValue([task(),{...task('done'),done:true}]);mount();await loaded();
 expect(screen.getByText(/not official entry requirements/i)).toBeTruthy();
 expect(screen.getByRole('checkbox',{name:'Reopen Task done'})).toBeTruthy();
 expect(screen.getByRole('link',{name:'View tasks in Today'}).getAttribute('href')).toBe('/today?view=todos');
});
it('preserves a failed create draft and retries with the same request ID',async()=>{
 io.create.mockRejectedValueOnce(new Error('private backend details'));mount();await loaded();
 fireEvent.click(screen.getByRole('button',{name:'Add personal task'}));
 fireEvent.change(screen.getByLabelText('New personal task'),{target:{value:'Call admissions'}});
 fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 await screen.findByRole('alert');expect((screen.getByLabelText('New personal task') as HTMLTextAreaElement).value).toBe('Call admissions');
 expect(screen.queryByText(/private backend details/)).toBeNull();
 const requestId=io.create.mock.calls[0][1];
 io.read.mockResolvedValue([task(),{...task('new'),text:'Call admissions'}]);
 fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 await screen.findByRole('checkbox',{name:'Mark Call admissions done'});
 expect(io.create.mock.calls[1]).toEqual(['app',requestId,{text:'Call admissions',due_date:null}]);
 expect(screen.queryByLabelText('New personal task')).toBeNull();
});
it('validates an empty draft before sending it',async()=>{
 mount();await loaded();fireEvent.click(screen.getByRole('button',{name:'Add personal task'}));
 fireEvent.change(screen.getByLabelText('New personal task'),{target:{value:'   '}});fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('1,000'));
 expect(io.create).not.toHaveBeenCalled();
});
it('keeps failed completion unchecked and recovers through refresh',async()=>{
 io.toggle.mockRejectedValueOnce(new Error('private failure'));mount();const checkbox=await loaded();fireEvent.click(checkbox);
 await screen.findByRole('alert');expect((checkbox as HTMLInputElement).checked).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Refresh tasks'}));await waitFor(()=>expect((screen.getByRole('checkbox',{name:'Mark Task one done'}) as HTMLInputElement).disabled).toBe(false));
 io.read.mockResolvedValue([{...task(),done:true}]);fireEvent.click(screen.getByRole('checkbox',{name:'Mark Task one done'}));
 await screen.findByRole('checkbox',{name:'Reopen Task one'});expect(io.toggle).toHaveBeenLastCalledWith('one',true);
});
it('searches and pages existing tasks before linking without copying them',async()=>{
 io.available.mockResolvedValue(Array.from({length:25},(_,i)=>task(`candidate-${String(i).padStart(2,'0')}`)));mount();await loaded();
 fireEvent.click(screen.getByRole('button',{name:'Link existing task'}));await screen.findByRole('button',{name:'Link Task candidate-00'});
 expect(screen.queryByRole('button',{name:'Link Task candidate-24'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Next available tasks'}));expect(screen.getByRole('button',{name:'Link Task candidate-24'})).toBeTruthy();
 fireEvent.change(screen.getByLabelText('Search unlinked tasks'),{target:{value:'candidate-24'}});
 io.read.mockResolvedValue([task(),task('candidate-24')]);fireEvent.click(screen.getByRole('button',{name:'Link Task candidate-24'}));
 await screen.findByRole('checkbox',{name:'Mark Task candidate-24 done'});expect(io.link).toHaveBeenCalledWith('app','candidate-24');expect(io.create).not.toHaveBeenCalled();
});
it('unlinks only the application association and announces the preserved task',async()=>{
 mount();await loaded();io.read.mockResolvedValue([]);fireEvent.click(screen.getByRole('button',{name:'Unlink Task one'}));
 await waitFor(()=>expect(screen.queryByRole('checkbox')).toBeNull());expect(io.unlink).toHaveBeenCalledWith('app','one');
 expect(screen.getByRole('status').textContent).toContain('still available in Today');
});
it('recovers a source read without exposing backend details',async()=>{
 io.read.mockRejectedValueOnce(new Error('private read detail'));mount();await screen.findByRole('alert');expect(screen.queryByText(/private read detail/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Refresh tasks'}));await loaded();
});
it.each(['account','application'])('ignores an old %s read and clears the prior draft',async(kind)=>{
 const old=deferred<ReturnType<typeof task>[]>();io.read.mockReturnValueOnce(old.promise).mockResolvedValueOnce([task('new-owner')]);const view=mount();
 if(kind==='account')io.auth.user={id:'new-owner'};
 view.rerender(<ApplicationPersonalTasks applicationId={kind==='application'?'new-app':'app'}/>);
 await screen.findByRole('checkbox',{name:'Mark Task new-owner done'});
 await act(async()=>old.resolve([task('old-owner')]));expect(screen.queryByText('Task old-owner')).toBeNull();
 io.auth.user=null;view.rerender(<ApplicationPersonalTasks applicationId="app"/>);expect(screen.queryByRole('checkbox')).toBeNull();
});
it('does not let an old account write refresh or announce into the new account',async()=>{
 const pending=deferred<ReturnType<typeof task>>();io.create.mockReturnValueOnce(pending.promise);const view=mount();await loaded();
 fireEvent.click(screen.getByRole('button',{name:'Add personal task'}));fireEvent.change(screen.getByLabelText('New personal task'),{target:{value:'Old account draft'}});fireEvent.click(screen.getByRole('button',{name:'Save task'}));
 io.auth.user={id:'new-owner'};io.read.mockResolvedValue([task('new-owner')]);view.rerender(<ApplicationPersonalTasks applicationId="new-app"/>);await screen.findByRole('checkbox',{name:'Mark Task new-owner done'});
 const reads=io.read.mock.calls.length;await act(async()=>pending.resolve(task('old-owner')));expect(io.read).toHaveBeenCalledTimes(reads);expect(screen.queryByText(/Old account draft/)).toBeNull();
});
it('bounds task rows while retaining search access to the tail',async()=>{
 io.read.mockResolvedValue(Array.from({length:55},(_,i)=>task(String(i).padStart(2,'0'))));mount();await screen.findByRole('checkbox',{name:'Mark Task 00 done'});
 expect(screen.getAllByRole('checkbox')).toHaveLength(20);fireEvent.change(screen.getByLabelText('Search application tasks'),{target:{value:'Task 54'}});
 expect(screen.getByRole('checkbox',{name:'Mark Task 54 done'})).toBeTruthy();
});
