import { beforeEach,describe,expect,it,vi } from 'vitest';
import { createMockSupabase } from './mock-supabase';
const mock=vi.hoisted(()=>({db:null as unknown}));
vi.mock('@/lib/supabase-server',()=>({createSupabaseServer:async()=>mock.db}));
vi.mock('@/lib/rate-limit',()=>({gate:async()=>({ok:true}),ratelimits:new Proxy({},{get:()=>({})})}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import { listOwnedResumeSharesAction, prepareResumeShareAction, readCommunityResumeAction, revokeCommunityResumeAction } from '@/app/(main)/communities/actions/resumes';
import { createPostAction } from '@/app/(main)/communities/actions/posts';
const ID='550e8400-e29b-41d4-a716-446655440001';
const snapshot={title:'Shared',sections:[{label:'Work',html:'<p>Safe</p>'}]};
describe('resume sharing actions',()=>{
 beforeEach(()=>{mock.db=createMockSupabase({user:{id:'owner'}});});
 it('does not read any private draft when viewing a post and sanitizes direct API content',async()=>{
  const db=createMockSupabase({user:{id:'peer'},rpc:()=>({data:{...snapshot,sections:[{label:'Work',html:'<p>Safe</p><img src=x onerror="evil()">'}]}})});mock.db=db;
  const result=await readCommunityResumeAction(ID);
  expect(result.snapshot).toEqual(snapshot);expect(db.from).not.toHaveBeenCalled();
  expect(db.rpc).toHaveBeenCalledWith('read_community_resume',{p_post_id:ID});
 });
 it('distinguishes unavailable from transient read failure without showing an empty resume',async()=>{
  expect((await readCommunityResumeAction(ID)).snapshot).toBeNull();
  mock.db=createMockSupabase({user:{id:'peer'},rpc:()=>({error:{message:'secret internal error'}})});
  const result=await readCommunityResumeAction(ID);expect(result.error).toMatch(/try again/i);expect(JSON.stringify(result)).not.toContain('secret');
 });
 it('requires an authenticated viewer',async()=>{
  const db=createMockSupabase({user:null});mock.db=db;expect((await readCommunityResumeAction(ID)).snapshot).toBeNull();expect(db.rpc).not.toHaveBeenCalled();
 });
 it('prepares only an owned published draft and sanitizes its HTML',async()=>{
  const db=createMockSupabase({user:{id:'owner'},resolver:q=>q.table==='resumes'?{data:{title:'Shared'}}:{data:[{section_key:'custom',label:'Work',mode:'free',content_html:'<p>Safe</p><img src=x onerror="evil()">',structured_data:{secret:'no'}}]}});mock.db=db;
  expect((await prepareResumeShareAction(ID)).snapshot).toEqual(snapshot);
  expect(db.queries[0].calls).toContainEqual({method:'eq',args:['user_id','owner']});
 });
 it('keeps read errors distinct from empty data during preparation',async()=>{
  mock.db=createMockSupabase({user:{id:'owner'},resolver:()=>({error:{message:'failed'}})});
  expect((await prepareResumeShareAction(ID)).error).toBeTruthy();
 });
 it('requires explicit preview before creating a resume attachment',async()=>{
  const db=createMockSupabase({user:{id:'owner'}});mock.db=db;
  const result=await createPostAction({content:'Post',topic_tag:'ADVICE',resume_id:ID});
  expect(result.error).toMatch(/preview/i);expect(db.queries.some(q=>q.op==='insert')).toBe(false);
 });
 it('uses one atomic publication RPC with the frozen sanitized copy',async()=>{
  const db=createMockSupabase({user:{id:'owner'},resolver:q=>q.table==='resumes'?{data:{id:ID}}:{data:[]},rpc:name=>name==='create_community_resume_post'?{data:{id:ID,user_id:'owner',content:'Post',topic_tag:'ADVICE',resume_link:ID,created_at:'now'}}:{data:[]}});mock.db=db;
  const result=await createPostAction({content:'Post',topic_tag:'ADVICE',resume_id:ID,resume_share:{post_id:ID,snapshot}});
  expect(result.error).toBeNull();expect(db.rpc).toHaveBeenCalledWith('create_community_resume_post',expect.objectContaining({p_post_id:ID,p_snapshot:snapshot}));
  expect(db.queries.some(q=>q.op==='insert')).toBe(false);
 });
 it('lists only the caller’s shared-copy metadata with bounded stable pagination',async()=>{
  const db=createMockSupabase({user:{id:'owner'},resolver:()=>({data:[{post_id:ID,title:'Copy',created_at:'now'}]})});mock.db=db;
  const result=await listOwnedResumeSharesAction(0);expect(result.rows[0].title).toBe('Copy');
  expect(db.queries[0].calls).toContainEqual({method:'eq',args:['user_id','owner']});
  expect(db.queries[0].calls).toContainEqual({method:'range',args:[0,20]});
 });
 it('revokes only the callers copy and surfaces failed deletes',async()=>{
  const db=createMockSupabase({user:{id:'owner'},resolver:()=>({error:{message:'internal'}})});mock.db=db;
  expect((await revokeCommunityResumeAction(ID)).error).toBeTruthy();
  expect(db.queries[0].calls).toContainEqual({method:'eq',args:['user_id','owner']});
 });
});
