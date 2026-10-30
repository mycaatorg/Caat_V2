import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createMockSupabase,type QueryContext} from './mock-supabase';
const state=vi.hoisted(()=>({client:null as unknown as ReturnType<typeof createMockSupabase>}));
vi.mock('@/lib/supabase/client',()=>({supabase:new Proxy({}, {get:(_,key)=>state.client[key as keyof typeof state.client]})}));
import {fetchUserScholarships,deleteUserScholarship} from '@/app/(main)/scholarships/user-scholarships-api';
const offset=(ctx:QueryContext)=>Number(ctx.calls.find(c=>c.method==='range')?.args[0]??0);
beforeEach(()=>{state.client=createMockSupabase({user:{id:'student'},resolver:()=>({data:[],error:null})});});
describe('personal scholarship persistence',()=>{
 it('rejects unauthenticated reads without pretending the collection is empty',async()=>{
  state.client=createMockSupabase({user:null});await expect(fetchUserScholarships()).rejects.toThrow('Not authenticated');
  expect(state.client.from).not.toHaveBeenCalled();
 });
 it('reads all capped pages in stable owner order until empty',async()=>{
  const all=Array.from({length:5},(_,i)=>({id:`s${i}`}));
  state.client=createMockSupabase({user:{id:'student'},resolver:ctx=>({data:all.slice(offset(ctx),offset(ctx)+2),error:null})});
  expect(await fetchUserScholarships()).toEqual(all);
  expect(state.client.queries.map(offset)).toEqual([0,2,4,5]);
  for(const query of state.client.queries){
   expect(query.table).toBe('user_scholarships');
   expect(query.calls.filter(c=>c.method==='eq').map(c=>c.args)).toEqual([['user_id','student']]);
   expect(query.calls.filter(c=>c.method==='order').map(c=>c.args)).toEqual([['created_at',{ascending:false}],['id',{ascending:true}]]);
  }
 });
 it('rejects partial results if any later page fails',async()=>{
  state.client=createMockSupabase({user:{id:'student'},resolver:ctx=>offset(ctx)?{data:null,error:{message:'outage'}}:{data:[{id:'first'}],error:null}});
  await expect(fetchUserScholarships()).rejects.toThrow();
 });
 it('rejects deletion if no owned row was affected',async()=>{
  await expect(deleteUserScholarship('missing')).rejects.toThrow('Scholarship not found');
 });
 it('confirms a returned deletion and keeps id/owner filters',async()=>{
  state.client=createMockSupabase({user:{id:'student'},resolver:()=>({data:[{id:'s1'}],error:null})});
  await expect(deleteUserScholarship('s1')).resolves.toBeUndefined();
  expect(state.client.queries[0].calls.filter(c=>c.method==='eq').map(c=>c.args)).toEqual([['id','s1'],['user_id','student']]);
  expect(state.client.queries[0].calls.at(-1)).toEqual({method:'select',args:['id']});
 });
});
