import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createMockSupabase} from './mock-supabase';
const mock=vi.hoisted(()=>({db:null as unknown}));
vi.mock('@/lib/supabase-server',()=>({createSupabaseServer:async()=>mock.db}));
import {listOwnCommunityContentPageAction} from '@/app/(main)/communities/actions/owned-content';
const row={kind:'post',id:'550e8400-e29b-41d4-a716-446655440001',created_at:'2020-01-01T00:00:00.123456+00:00',content:'<p>Mine</p>',removed:false};
const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
const cursor=(direction='older')=>encode({created_at:row.created_at,id:row.id,kind:row.kind,direction});
beforeEach(()=>{mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({data:[]})});});
describe('owner history cursors',()=>{
 it('rejects malformed, oversized, partial, invalid timestamp and invalid direction tokens before querying',async()=>{
  const rpc=vi.fn();mock.db=createMockSupabase({user:{id:'owner'},rpc});
  for(const value of ['bad cursor','a'.repeat(1025),encode({id:row.id}),cursor('sideways'),encode({...row,direction:'older',created_at:'infinity'})]){
   const result=await listOwnCommunityContentPageAction(value);expect(result.invalidCursor).toBe(true);expect(result.rows).toEqual([]);
  }
  expect(rpc).not.toHaveBeenCalled();
 });
 it('preserves microseconds in both RPC arguments and generated cursors, bounds rows and strips extra fields',async()=>{
  const rpc=vi.fn(()=>({data:Array.from({length:21},()=>({...row,group_name:'SECRET'}))}));mock.db=createMockSupabase({user:{id:'owner'},rpc});
  const result=await listOwnCommunityContentPageAction(cursor());
  expect(result.error).toBeNull();expect(result.rows).toHaveLength(20);expect(result.rows[0].content).toBe('Mine');
  expect(rpc).toHaveBeenCalledWith('list_owned_community_content_page',{p_created_at:row.created_at,p_id:row.id,p_kind:'post',p_direction:'older'});
  const next=JSON.parse(Buffer.from(result.next!,'base64url').toString());expect(next.created_at).toBe(row.created_at);expect(next.direction).toBe('older');expect(result.previous).toBeTruthy();expect(JSON.stringify(result)).not.toContain('SECRET');
 });
 it('takes the nearest twenty before reversing newer rows, without showing the sentinel',async()=>{
  mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({data:Array.from({length:21},(_,n)=>({...row,content:`item ${n}`}))})});
  const result=await listOwnCommunityContentPageAction(cursor('newer'));
  expect(result.rows[0].content).toBe('item 19');expect(result.rows[19].content).toBe('item 0');expect(result.previous).toBeTruthy();expect(result.next).toBeTruthy();
 });
 it('has no previous link on newest page and no next link after the oldest item',async()=>{
  mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>({data:[row]})});
  expect(await listOwnCommunityContentPageAction()).toMatchObject({next:null,previous:null,error:null});
  expect(await listOwnCommunityContentPageAction(cursor())).toMatchObject({next:null,error:null});
  expect(await listOwnCommunityContentPageAction(cursor('newer'))).toMatchObject({previous:null,error:null});
 });
 it('handles missing auth, request failures and malformed database rows honestly',async()=>{
  mock.db=createMockSupabase({user:null});expect((await listOwnCommunityContentPageAction()).error).toMatch(/sign in/i);
  for(const response of [{error:{message:'SECRET'}},{data:[{...row,created_at:'bad'}]},{data:Array(22).fill(row)}]){
   mock.db=createMockSupabase({user:{id:'owner'},rpc:()=>response});const result=await listOwnCommunityContentPageAction(cursor());expect(result.error).toMatch(/try again/i);expect(result.invalidCursor).toBe(false);expect(JSON.stringify(result)).not.toContain('SECRET');
  }
 });
});
