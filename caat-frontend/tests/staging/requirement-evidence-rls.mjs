// PROD-161: synthetic users, loopback only. Exercise real FK/RLS/grants/cascades.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';
const url = process.env.SUPABASE_URL;
assertLocalApiUrl(url);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
const anon = createClient(url, process.env.SUPABASE_ANON_KEY, opts);
const ok = r => { assert.ifError(r.error); return r.data; };
const users = [], run = randomUUID(), table = 'requirement_evidence_links';
const scholarship = 'e2000000-0000-4000-8000-0000000000a1';
async function user(name) {
 const email = `e2e.requirements.${name}.${run}@caat.local.test`;
 const { user } = ok(await admin.auth.admin.createUser({ email, password: process.env.E2E_TEST_PASSWORD, email_confirm: true }));
 users.push(user.id);
 const client = createClient(url, process.env.SUPABASE_ANON_KEY, opts);
 ok(await client.auth.signInWithPassword({email,password:process.env.E2E_TEST_PASSWORD}));
 return {id:user.id,client};
}
try {
 ok(await admin.from('schools').upsert({id:900161,name:'Synthetic requirement evidence university',country:'Australia',institution_type:'university'}));
 const owner=await user('owner'),peer=await user('peer');
 const app=async(who,school)=>ok(await who.client.from('user_school_applications').insert({user_id:who.id,school_id:school,status:'researching'}).select('id').single());
 const a=await app(owner,900001),b=await app(owner,900161),p=await app(peer,900001);
 for(const who of [owner,peer]) ok(await who.client.from('user_bookmarked_scholarships').insert({user_id:who.id,scholarship_id:scholarship,school_id:900001,status:'interested'}));
 const evidence=async(who,appId)=>{
  const item=ok(await who.client.from('evidence_items').insert({user_id:who.id,kind:'award',title:'Community award'}).select('id').single());
  return ok(await who.client.from('application_evidence_links').insert({user_id:who.id,application_id:appId,kind:'item',evidence_item_id:item.id}).select('id').single());
 };
 const source=await evidence(owner,a.id),elsewhere=await evidence(owner,b.id),foreign=await evidence(peer,p.id);
 const draft=async(who)=>ok(await who.client.from('essay_drafts').insert({user_id:who.id,prompt_id:randomUUID(),prompt_slug:'synthetic',label:'Saved draft',content:'Draft body'}).select('id').single());
 const d=await draft(owner),pd=await draft(peer);
 const values={user_id:owner.id,application_id:a.id,school_id:900001,scholarship_id:scholarship,item_key:'essay',requirement_label:'Essay required',evidence_link_id:source.id};
 const add=(patch={},client=owner.client)=>client.from(table).insert({...values,...patch}).select('*');
 const [link]=ok(await add());
 assert.equal((await add()).error?.code,'23505');
 for(const patch of [{evidence_link_id:elsewhere.id},{evidence_link_id:foreign.id},{application_id:p.id},{school_id:900161},{evidence_link_id:null,essay_draft_id:pd.id}]) assert.equal((await add({item_key:'deadline',...patch})).error?.code,'23503','same owner/application/attachment is enforced');
 for(const patch of [{item_key:'invalid'},{requirement_label:' '},{evidence_link_id:null},{essay_draft_id:d.id}]) assert.equal((await add(patch)).error?.code,'23514');
 assert.equal((await add({},peer.client)).error?.code,'42501');
 assert.equal((await anon.from(table).select('id')).error?.code,'42501');
 assert.deepEqual(ok(await peer.client.from(table).select('id').eq('id',link.id)),[]);
 assert.deepEqual(ok(await peer.client.from(table).delete().eq('id',link.id).select('id')),[]);
 assert.equal((await owner.client.from(table).update({item_key:'deadline'}).eq('id',link.id)).error?.code,'42501');
 assert.equal((await add({id:randomUUID(),item_key:'deadline'})).error?.code,'42501');
 const [draftLink]=ok(await add({evidence_link_id:null,essay_draft_id:d.id}));
 ok(await owner.client.from('essay_drafts').delete().eq('id',d.id));
 assert.deepEqual(ok(await owner.client.from(table).select('id').eq('id',draftLink.id)),[]);
 // Current application tailoring is referenced, not copied or changed.
 ok(await owner.client.from('application_evidence_links').update({tailored_title:'Specific award'}).eq('id',source.id));
 assert.equal(ok(await owner.client.from(table).select('id')).length,1);
 assert.deepEqual(ok(await owner.client.from('user_scholarship_prep_checks').select('*')),[],'linking never ticks');
 ok(await owner.client.from('user_scholarship_prep_checks').insert({user_id:owner.id,scholarship_id:scholarship,item_key:'essay'}));
 // Moving the bookmark cleans old associations, preserves the application work and ticks.
 ok(await owner.client.from('user_bookmarked_scholarships').update({school_id:900161}).eq('user_id',owner.id).eq('scholarship_id',scholarship));
 assert.deepEqual(ok(await owner.client.from(table).select('id')),[]);
 assert.equal(ok(await owner.client.from('application_evidence_links').select('id').eq('id',source.id)).length,1);
 assert.equal(ok(await owner.client.from('user_scholarship_prep_checks').select('*')).length,1);
 assert.equal((await add()).error?.code,'23503','stale tabs cannot link after move');
 ok(await owner.client.from('user_bookmarked_scholarships').update({school_id:900001}).eq('user_id',owner.id).eq('scholarship_id',scholarship));
 ok(await add());
 ok(await owner.client.from('application_evidence_links').delete().eq('id',source.id));
 assert.deepEqual(ok(await owner.client.from(table).select('id')),[],'unlink source removes only associations');
 const next=await evidence(owner,a.id);
 ok(await add({evidence_link_id:next.id}));
 ok(await owner.client.from('user_school_applications').delete().eq('id',a.id));
 assert.deepEqual(ok(await owner.client.from(table).select('id')),[],'application deletion still works');
 const replacement=await app(owner,900001),last=await evidence(owner,replacement.id);
 ok(await owner.client.from('user_bookmarked_scholarships').update({school_id:900001}).eq('user_id',owner.id).eq('scholarship_id',scholarship));
 ok(await add({application_id:replacement.id,evidence_link_id:last.id}));
 ok(await owner.client.rpc('delete_own_account'));
 users.splice(users.indexOf(owner.id),1);
 assert.deepEqual(ok(await admin.from(table).select('id').eq('user_id',owner.id)),[]);
 console.log('Requirement evidence RLS passed: owned sources, application boundaries, narrow grants, duplicate/invalid writes, moves, stale tabs, source/application/account deletion, unchanged manual ticks.');
} finally {
 for(const id of users){
  await admin.from('user_bookmarked_scholarships').delete().eq('user_id',id);
  await admin.from('application_evidence_links').delete().eq('user_id',id);
  await admin.from('evidence_items').delete().eq('user_id',id);
  await admin.from('user_school_applications').delete().eq('user_id',id);
  ok(await admin.auth.admin.deleteUser(id));
 }
}
