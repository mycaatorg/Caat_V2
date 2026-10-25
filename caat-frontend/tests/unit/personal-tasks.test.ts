import { beforeEach, expect, it, vi } from 'vitest';
import { createMockSupabase } from './mock-supabase';
const io=vi.hoisted(()=>({client:null as unknown as ReturnType<typeof createMockSupabase>}));
vi.mock('@/lib/supabase/client',()=>({get supabase(){return io.client;}}));
import { editPersonalTask, fetchPersonalTask, TaskConflictError, validatePersonalTask } from '@/lib/personal-tasks';
const row={id:'t1',text:'Old task',due_date:null,done:true,priority:1};
beforeEach(()=>{io.client=createMockSupabase({user:{id:'u1'},resolver:()=>({data:{...row,text:'New task'},error:null})});});
it('updates only text/date for the owner when the original fields still match',async()=>{
 expect(await editPersonalTask(row,{text:' New task ',due_date:'2026-11-01'})).toMatchObject({done:true,priority:1});
 const calls=io.client.queries[0].calls;
 expect(calls).toContainEqual({method:'update',args:[{text:'New task',due_date:'2026-11-01'}]});
 expect(calls.filter(c=>c.method==='eq').map(c=>c.args)).toEqual([['user_id','u1'],['id','t1'],['text','Old task']]);
 expect(calls).toContainEqual({method:'is',args:['due_date',null]});
});
it('matches a non-null original date rather than overwriting another tab',async()=>{
 await editPersonalTask({...row,due_date:'2026-10-01'},{text:'New task',due_date:null});
 expect(io.client.queries[0].calls).toContainEqual({method:'eq',args:['due_date','2026-10-01']});
});
it('rejects deleted or changed rows instead of reporting saved',async()=>{
 io.client=createMockSupabase({user:{id:'u1'},resolver:()=>({data:null,error:null})});
 await expect(editPersonalTask(row,{text:'New task',due_date:null})).rejects.toBeInstanceOf(TaskConflictError);
});
it('loads only the current owners requested task and returns null for a missing row',async()=>{
 io.client=createMockSupabase({user:{id:'u1'},resolver:()=>({data:null,error:null})});
 expect(await fetchPersonalTask('t1')).toBeNull();
 expect(io.client.queries[0].calls.filter(c=>c.method==='eq').map(c=>c.args)).toEqual([['user_id','u1'],['id','t1']]);
});
it('validates real optional dates and bounded nonempty text before writing',async()=>{
 for(const patch of [{text:' ',due_date:null},{text:'x'.repeat(1001),due_date:null},{text:'ok',due_date:'2026-02-30'},{text:'ok',due_date:'2026-2-1'}]) await expect(editPersonalTask(row,patch)).rejects.toThrow();
 expect(io.client.queries).toHaveLength(0);
 expect(validatePersonalTask({text:' x ',due_date:'2028-02-29'})).toEqual({text:'x',due_date:'2028-02-29'});
});
it('does not read or write while signed out or aborted',async()=>{
 io.client=createMockSupabase({user:null});
 await expect(fetchPersonalTask('t1')).rejects.toThrow();
 await expect(editPersonalTask(row,{text:'x',due_date:null})).rejects.toThrow();
 expect(io.client.queries).toHaveLength(0);
 const abort=new AbortController();abort.abort();
 io.client=createMockSupabase({user:{id:'u1'}});
 await expect(editPersonalTask(row,{text:'x',due_date:null},abort.signal)).rejects.toThrow();
 expect(io.client.queries).toHaveLength(0);
});
it('does not expose backend error details',async()=>{
 io.client=createMockSupabase({user:{id:'u1'},resolver:()=>({data:null,error:{message:'private SQL'}})});
 await expect(editPersonalTask(row,{text:'x',due_date:null})).rejects.toThrow('Could not save');
 await expect(fetchPersonalTask('t1')).rejects.toThrow('Could not load');
});
