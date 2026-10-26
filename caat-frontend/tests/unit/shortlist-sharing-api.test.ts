import {readSharedShortlist} from '@/lib/shared-shortlist-reader';
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {createMockSupabase} from './mock-supabase';
const io=vi.hoisted(()=>({user:"owner" as string|null,client:null as unknown,publicClient:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({supabase:new Proxy({},{get:(_,key)=>Reflect.get(io.client as object,key)})}));
vi.mock('@/lib/current-user',()=>({getClientUserId:async()=> io.user}));
vi.mock('@supabase/supabase-js',()=>({createClient:io.publicClient}));
import {createShare,previewShare,removeShare,loadShares,loadShareCandidates} from '@/lib/shortlist-sharing';
beforeEach(()=>{io.user='owner';vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://test.example');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-test-key');io.client=createMockSupabase({});io.publicClient.mockReturnValue(io.client);});
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();vi.unstubAllEnvs();});
it('fails a logical preview conflict without retrying or returning success',async()=>{
 const c=createMockSupabase({rpc:()=>({error:{message:'changed',code:'PT409'}})});io.client=c;
 await expect(previewShare([{kind:'school',id:'1'}])).rejects.toThrow(/changed/i);expect(c.rpc).toHaveBeenCalledTimes(1);
});
it('does not claim a created link on an empty RPC result',async()=>{
 await expect(createShare([],[], 'a'.repeat(64))).rejects.toThrow(/confirm/i);
});
it('uses a dedicated sessionless reader and treats revoked links as unavailable',async()=>{
 io.publicClient.mockReturnValue(createMockSupabase({rpc:()=>({data:null})}));
 expect(await readSharedShortlist('a'.repeat(64))).toBeNull();
 expect(io.publicClient).toHaveBeenCalledWith(expect.anything(),expect.anything(),expect.objectContaining({auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:expect.objectContaining({fetch:expect.any(Function)})}));
});
it('never reads a malformed capability',async()=>{
 expect(await readSharedShortlist('bad')).toBeNull();expect(io.publicClient).not.toHaveBeenCalled();
});
it('bounds a stalled creation and makes ambiguous success explicit',async()=>{
 vi.useFakeTimers();io.client={rpc:()=>({abortSignal:()=>new Promise(()=>{})})};
 const result=createShare([],[],'b'.repeat(64));const assertion=expect(result).rejects.toThrow(/confirm.*Refresh/i);
 await vi.advanceTimersByTimeAsync(12001);await assertion;
});
it('rejects zero-row removal instead of reporting success',async()=>{await expect(removeShare('missing')).rejects.toThrow(/remove/i);});

it('stops signed-out reads before fetching account data',async()=>{io.user=null;await expect(loadShares()).rejects.toThrow(/Sign in/i);await expect(loadShareCandidates()).rejects.toThrow(/Sign in/i);});
