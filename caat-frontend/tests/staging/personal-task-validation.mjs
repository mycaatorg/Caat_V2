// PROD-172: exercise the real RPC boundary using disposable owner-only rows.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY,password=process.env.E2E_TEST_PASSWORD;
assertLocalApiUrl(url);
const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=client(),peer=client(),anon=client();
const ok=r=>{assert.ifError(r.error);return r.data;};
const user=ok(await owner.auth.signInWithPassword({email:'e2e.student@caat.local.test',password})).user;
ok(await peer.auth.signInWithPassword({email:'e2e.peer@caat.local.test',password}));
const task=ok(await owner.from('user_todos').insert({user_id:user.id,text:'Original',due_date:'2026-11-01',done:true,priority:1}).select().single());
const read=async()=>ok(await owner.from('user_todos').select('text,due_date,done,priority').eq('id',task.id).single());
const rpc=(who,text,original='Original',date='2026-11-01')=>who.rpc('edit_personal_task',{p_id:task.id,p_original_text:original,p_original_due_date:date,p_text:text,p_due_date:null});
try{
 for(const text of [null,'\t\n\u00a0\ufeff','x'.repeat(1001),'😀'.repeat(501)]){
  assert.equal((await rpc(owner,text)).error?.code,'22023','invalid edit must be rejected');
  assert.deepEqual(await read(),{text:'Original',due_date:'2026-11-01',done:true,priority:1});
 }
 assert.deepEqual(ok(await rpc(peer,'Other student')),[],'peer cannot edit owner task');
 assert.ok((await rpc(anon,'Anonymous')).error,'anonymous cannot invoke edit');
 assert.deepEqual(ok(await rpc(owner,'New text','stale original')),[],'stale original cannot overwrite');
 const trimmed='Trimmed task';
 assert.equal(ok(await rpc(owner,'\t\n\u00a0\ufeff '+trimmed+'\u2003\u2029'))[0].text,trimmed);
 const emoji='😀'.repeat(500);
 assert.equal(ok(await rpc(owner,emoji,trimmed,null))[0].text,emoji,'1000 UTF-16 units accepted');
 assert.deepEqual(await read(),{text:emoji,due_date:null,done:true,priority:1});
 console.log('Personal task RPC validation, whitespace/UTF-16 parity, CAS and owner isolation PASS.');
}finally{
 ok(await owner.from('user_todos').delete().eq('id',task.id).eq('user_id',user.id));
 await Promise.all([owner.auth.signOut(),peer.auth.signOut()]);
}
