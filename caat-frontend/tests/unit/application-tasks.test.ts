import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createMockSupabase,type QueryContext} from './mock-supabase';
const state=vi.hoisted(()=>({client:null as ReturnType<typeof createMockSupabase>|null}));
vi.mock('@/lib/supabase/client',()=>({supabase:{from:(t:string)=>state.client!.from(t),rpc:(name:string,args:Record<string,unknown>)=>state.client!.rpc(name,args),auth:{getUser:()=>state.client!.auth.getUser()}}}));
import {fetchApplicationTasks,fetchAvailableApplicationTasks,createApplicationTask,linkApplicationTask,unlinkApplicationTask} from '@/lib/application-tasks';
import {accountExportCollections} from '@/lib/account-export-collections';
const task=(id:string)=>({id,text:`Task ${id}`,due_date:null,done:false,priority:2});
const page=(ctx:QueryContext,rows:unknown[],cap=50)=>{const [from,to]=(ctx.calls.find(c=>c.method==='range')?.args??[0,199]) as number[];return {data:rows.slice(from,Math.min(to+1,from+cap)),error:null};};
const eqs=(ctx:QueryContext)=>ctx.calls.filter(c=>c.method==='eq').map(c=>c.args);
beforeEach(()=>{state.client=createMockSupabase({user:{id:'owner'}});});
describe('application personal task data',()=>{
 it('exports owner-scoped task associations',()=>{
  expect(accountExportCollections).toContainEqual({table:'application_task_links',owner:'user_id',order:['task_id']});
 });
 it('reads all linked tasks under a lower cap, scoped to the owner and application',async()=>{
  const tasks=Array.from({length:55},(_,i)=>task(`t${i}`));
  state.client=createMockSupabase({user:{id:'owner'},resolver:ctx=>ctx.table==='user_school_applications'?{data:{id:'app'},error:null}:page(ctx,ctx.table==='application_task_links'?tasks.map(t=>({task_id:t.id})):tasks)});
  expect(await fetchApplicationTasks('app')).toEqual(tasks);
  for(const q of state.client.queries){expect(eqs(q)).toContainEqual(['user_id','owner']);if(q.table==='application_task_links')expect(eqs(q)).toContainEqual(['application_id','app']);}
  expect(state.client.queries.filter(q=>q.table==='application_task_links').map(q=>q.calls.find(c=>c.method==='range')?.args[0])).toEqual([0,50,55]);
 });
 it('refuses an unavailable application instead of showing an empty task list',async()=>{
  await expect(fetchApplicationTasks('missing')).rejects.toThrow('Could not load');
  expect(state.client!.queries.map(q=>q.table)).toEqual(['user_school_applications']);
 });
 it.each(['application_task_links','user_todos'])('discards partial data when a late %s page fails',async(table)=>{
  state.client=createMockSupabase({user:{id:'owner'},resolver:ctx=>{
   if(ctx.table==='user_school_applications')return {data:{id:'app'},error:null};
   const from=ctx.calls.find(c=>c.method==='range')?.args[0];
   if(ctx.table===table&&from===1)return {data:null,error:{message:'private details'}};
   return page(ctx,ctx.table==='application_task_links'?[{task_id:'a'},{task_id:'b'}]:[task('a'),task('b')],1);
  }});
  await expect(fetchApplicationTasks('app')).rejects.toThrow('Could not load');
 });
 it('fails closed when a linked task disappears between reads',async()=>{
  state.client=createMockSupabase({user:{id:'owner'},resolver:ctx=>ctx.table==='user_school_applications'?{data:{id:'app'},error:null}:page(ctx,ctx.table==='application_task_links'?[{task_id:'gone'}]:[])});
  await expect(fetchApplicationTasks('app')).rejects.toThrow('Could not load');
 });
 it('offers complete unlinked personal tasks and excludes links to any application',async()=>{
  const tasks=Array.from({length:55},(_,i)=>task(`t${i}`));
  state.client=createMockSupabase({user:{id:'owner'},resolver:ctx=>page(ctx,ctx.table==='user_todos'?tasks:[{task_id:'t54'}])});
  expect(await fetchAvailableApplicationTasks()).toEqual(tasks.slice(0,54));
  for(const q of state.client.queries)expect(eqs(q)).toContainEqual(['user_id','owner']);
 });
 it('uses the stable request ID and existing validation for atomic creation',async()=>{
  state.client=createMockSupabase({user:{id:'owner'},rpc:()=>({data:[task('request')],error:null})});
  await expect(createApplicationTask('app','request',{text:'  Task request  ',due_date:null})).resolves.toEqual(task('request'));
  expect(state.client.rpc).toHaveBeenCalledWith('create_application_task',{p_task_id:'request',p_application_id:'app',p_text:'Task request',p_due_date:null});
  await expect(createApplicationTask('app','request',{text:'  ',due_date:null})).rejects.toThrow('1,000');
  expect(state.client.rpc).toHaveBeenCalledTimes(1);
 });
 it('never returns a false success or raw backend error on create',async()=>{
  state.client=createMockSupabase({user:{id:'owner'},rpc:()=>({data:[],error:null})});
  await expect(createApplicationTask('app','id',{text:'Task',due_date:null})).rejects.toThrow('Could not confirm');
  state.client=createMockSupabase({user:{id:'owner'},rpc:()=>({data:null,error:{message:'private database details'}})});
  await expect(createApplicationTask('app','id',{text:'Task',due_date:null})).rejects.toThrow('Could not confirm');
 });
 it('links only owner-supplied fields and confirms the written task',async()=>{
  state.client=createMockSupabase({user:{id:'owner'},resolver:()=>({data:{task_id:'task'},error:null})});
  await linkApplicationTask('app','task');
  expect(state.client.queries[0].calls.find(c=>c.method==='insert')?.args).toEqual([{user_id:'owner',application_id:'app',task_id:'task'}]);
 });
 it('treats a duplicate link as success only after confirming the same owned application',async()=>{
  state.client=createMockSupabase({user:{id:'owner'},resolver:ctx=>ctx.op==='insert'?{data:null,error:{message:'duplicate',code:'23505'}}:{data:{task_id:'task'},error:null}});
  await linkApplicationTask('app','task');
  expect(eqs(state.client.queries[1])).toEqual([['user_id','owner'],['application_id','app'],['task_id','task']]);
  state.client=createMockSupabase({user:{id:'owner'},resolver:ctx=>ctx.op==='insert'?{data:null,error:{message:'duplicate',code:'23505'}}:{data:null,error:null}});
  await expect(linkApplicationTask('other-app','task')).rejects.toThrow('Refresh');
 });
 it('unlinks only the expected application and rejects a zero-row write',async()=>{
  state.client=createMockSupabase({user:{id:'owner'},resolver:()=>({data:{task_id:'task'},error:null})});
  await unlinkApplicationTask('app','task');
  expect(state.client.queries[0].table).toBe('application_task_links');
  expect(eqs(state.client.queries[0])).toEqual([['user_id','owner'],['application_id','app'],['task_id','task']]);
  state.client=createMockSupabase({user:{id:'owner'},resolver:()=>({data:null,error:null})});
  await expect(unlinkApplicationTask('app','task')).rejects.toThrow('Refresh');
 });
 it('makes no table or RPC call when signed out',async()=>{
  state.client=createMockSupabase({});
  await expect(fetchApplicationTasks('app')).rejects.toThrow('sign in');
  await expect(createApplicationTask('app','id',{text:'Task',due_date:null})).rejects.toThrow('sign in');
  await expect(linkApplicationTask('app','task')).rejects.toThrow('sign in');
  await expect(unlinkApplicationTask('app','task')).rejects.toThrow('sign in');
  expect(state.client.from).not.toHaveBeenCalled();expect(state.client.rpc).not.toHaveBeenCalled();
 });
});
