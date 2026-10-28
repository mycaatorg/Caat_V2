import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';
const url=process.env.SUPABASE_URL; assertLocalApiUrl(url);
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const ok=r=>{assert.ifError(r.error);return r.data;};
const users=[]; let group;
async function account(){
 const email=`e2e-write-boundary-${randomUUID()}@caat.local.test`,password=randomBytes(24).toString('hex');
 const id=ok(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;users.push(id);
 ok(await admin.from('profiles').insert({id,first_name:'Synthetic',last_name:'Boundary'}));
 const client=createClient(url,process.env.SUPABASE_ANON_KEY,opts);ok(await client.auth.signInWithPassword({email,password}));return {id,client};
}
const payload={content:'Synthetic boundary fixture',topic_tag:'ADVICE'};
const insert=(owner,extra={})=>owner.client.from('community_posts').insert({...payload,user_id:owner.id,...extra}).select('*');
const count=async id=>{const r=await admin.from('community_posts').select('id',{count:'exact',head:true}).eq('user_id',id);ok(r);return r.count;};
const clear=async id=>ok(await admin.from('community_posts').delete().eq('user_id',id));
const rejected=(r,reason)=>assert.equal(r.error?.code,'23514',reason);
async function seed(owner,n,extra={}){for(let s=0;s<n;s+=500)ok(await admin.from('community_posts').insert(Array.from({length:Math.min(500,n-s)},()=>({...payload,user_id:owner.id,...extra}))));}
try{
 const owner=await account(),peer=await account();
 rejected(await owner.client.from('community_posts').insert(Array.from({length:101},()=>({...payload,user_id:owner.id}))),'101-row bulk must fail atomically');
 assert.equal(await count(owner.id),0);console.log('PASS bulk cap and rollback');
 for(const item of [
  {score_card:{unexpected:'invalid'}},{score_card:[]},{score_card:{exam:'SAT',score:null}},{score_card:{exam:'unknown',score:'1'}},
  {score_card:{exam:'SAT',score:'😀'.repeat(26)}},{result_card:{outcome:'accepted',university_name:'😀'.repeat(101)}},
  {result_card:{outcome:'accepted',university_name:' \uFEFF '}},{result_card:{outcome:'accepted',university_name:'School',program:null}},
  {poll_options:{}},{poll_options:[{id:'a',text:'Only one'}]},
  {poll_options:[{id:'a',text:'😀'.repeat(61)},{id:'b',text:'B'}]}, {poll_options:[{id:'a',text:12},{id:'b',text:'B'}]},
 ])rejected(await insert(owner,item),'invalid attachment');
 const [valid]=ok(await insert(owner,{
  score_card:{exam:'SAT',score:`\uFEFF${'😀'.repeat(25)}\u00A0`,discarded:'extra'},
  result_card:{outcome:'accepted',university_name:'😀'.repeat(100),program:'  Engineering  ',discarded:'extra'},
  poll_options:[{id:'😀'.repeat(32),text:'😀'.repeat(60),discarded:'extra'},{id:'b',text:' B '}],created_at:'2000-01-01T00:00:00Z',
 }));
 assert.equal(valid.score_card.score,'😀'.repeat(25));assert.equal(valid.score_card.discarded,undefined);
 assert.equal(valid.result_card.program,'Engineering');assert.equal(valid.poll_options[1].text,'B');
 assert.ok(Date.parse(valid.created_at)>Date.now()-60000,'cannot backdate insert');
 rejected(await owner.client.from('community_posts').update({created_at:'2000-01-01'}).eq('id',valid.id),'cannot backdate update');
 rejected(await owner.client.from('community_posts').update({user_id:peer.id}).eq('id',valid.id),'cannot transfer author');
 rejected(await owner.client.from('community_posts').update({score_card:{exam:'SAT',score:''}}).eq('id',valid.id),'changed attachments validated');
 assert.deepEqual(ok(await peer.client.from('community_posts').update({content:'Peer mutation'}).eq('id',valid.id).select('id')),[]);
 ok(await owner.client.from('community_posts').update({content:'Owner edit',created_at:valid.created_at}).eq('id',valid.id));
 // Trusted maintenance can retain legacy fields without blocking owner edits.
 ok(await admin.from('community_posts').update({score_card:{legacy:true}}).eq('id',valid.id));
 ok(await owner.client.from('community_posts').update({content:'Legacy text edit'}).eq('id',valid.id));
 ok(await admin.from('community_posts').update({is_hidden:true}).eq('id',valid.id));
 await clear(owner.id);console.log('PASS shape bounds, Unicode, identity and legacy edits');
 group=randomUUID();ok(await peer.client.from('community_groups').insert({id:group,creator_id:peer.id,name:'Boundary private group',slug:`boundary-${group}`,is_private:true}));
 await seed(owner,99,{group_id:group,is_hidden:true});
 assert.deepEqual(ok(await owner.client.from('community_posts').select('id').eq('user_id',owner.id)),[],'inaccessible rows invisible to owner');
 const race=await Promise.all([insert(owner),insert(owner)]);
 assert.equal(race.filter(r=>!r.error).length,1);assert.equal(race.find(r=>r.error)?.error.code,'23514');assert.equal(await count(owner.id),100);
 ok(await owner.client.from('community_posts').update({content:'Edit at cap'}).eq('id',race.find(r=>!r.error).data[0].id));
 await clear(owner.id);console.log('PASS concurrent REST daily cap counts inaccessible posts; edits allowed');
 const resume=randomUUID();ok(await owner.client.from('resumes').insert({id:resume,user_id:owner.id,title:'Synthetic private draft'}));
 const snapshot={title:'Synthetic copy',sections:[{label:'Work',html:'<p>Fixture</p>'}]};
 const publish=id=>owner.client.rpc('create_community_resume_post',{p_post_id:id,p_post:{...payload,resume_link:resume},p_snapshot:snapshot});
 const existing=randomUUID();ok(await publish(existing));await seed(owner,98);
 const contested=randomUUID(),mixed=await Promise.all([insert(owner),publish(contested)]);
 assert.equal(mixed.filter(r=>!r.error).length,1);assert.equal(mixed.find(r=>r.error)?.error.code,'23514');assert.equal(await count(owner.id),100);
 assert.equal(ok(await publish(existing)).id,existing,'retry succeeds at cap');
 const absent=async id=>{for(const [t,f] of [['community_posts','id'],['community_resume_publications','id'],['community_resume_shares','post_id']])assert.deepEqual(ok(await admin.from(t).select(f).eq(f,id)),[]);};
 if(mixed[1].error)await absent(contested);
 const denied=randomUUID();rejected(await publish(denied),'new RPC denied at cap');await absent(denied);
 await clear(owner.id);console.log('PASS mixed REST/RPC cap, retry and publication rollback');
 await seed(owner,4999,{created_at:'2000-01-01T00:00:00Z'});
 const lifetime=await Promise.all([insert(owner),insert(owner)]);
 assert.equal(lifetime.filter(r=>!r.error).length,1);assert.equal(lifetime.find(r=>r.error)?.error.code,'23514');assert.equal(await count(owner.id),5000);
 console.log('PASS concurrent lifetime cap independent of daily cap');
}finally{
 for(const id of users){await clear(id);ok(await admin.auth.admin.deleteUser(id));}
 if(group)ok(await admin.from('community_groups').delete().eq('id',group));
 console.log('Disposable boundary accounts and fixtures removed.');
}
