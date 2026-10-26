import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';
const url=process.env.SUPABASE_URL; assertLocalApiUrl(url);
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const anon=createClient(url,process.env.SUPABASE_ANON_KEY,opts);
const ok=r=>{assert.ifError(r.error);return r.data;};
async function login(email){const client=createClient(url,process.env.SUPABASE_ANON_KEY,opts);const data=ok(await client.auth.signInWithPassword({email,password:process.env.E2E_TEST_PASSWORD}));return {id:data.user.id,client};}
const owner=await login('e2e.student@caat.local.test'), peer=await login('e2e.peer@caat.local.test');
const resume=randomUUID(),group=randomUUID(),post=randomUUID(),legacy=randomUUID(),privatePost=randomUUID(),badPost=randomUUID();
const snapshot={title:'Synthetic shared resume',sections:[{label:'Work',html:'<p>Explicit shared copy</p>'}]};
const payload={content:'Synthetic resume share',topic_tag:'ADVICE',resume_link:resume,is_anonymous:false};
const create=(client,id=post,extra={},copy=snapshot)=>client.rpc('create_community_resume_post',{p_post_id:id,p_post:{...payload,...extra},p_snapshot:copy});
const read=async(client,id=post)=>ok(await client.rpc('read_community_resume',{p_post_id:id}));
let disposableUser,disposableClient;
try{
 ok(await owner.client.from('resumes').insert({id:resume,user_id:owner.id,title:'Private current title'}));
 // RED before migration: the narrow atomic function does not yet exist.
 ok(await create(owner.client));
 assert.deepEqual(await read(peer.client),snapshot);
 assert.deepEqual(await read(owner.client),snapshot);
 assert.ok((await anon.rpc('read_community_resume',{p_post_id:post})).error);
 assert.deepEqual(ok(await peer.client.from('resumes').select('id').eq('id',resume)),[]);
 assert.deepEqual(ok(await peer.client.from('community_resume_shares').select('*').eq('post_id',post)),[]);
 assert.ok((await owner.client.from('community_resume_shares').insert({post_id:post,user_id:owner.id,snapshot})).error);
 assert.ok((await owner.client.from('community_resume_shares').update({snapshot}).eq('post_id',post)).error);
 const retries=await Promise.all([create(owner.client),create(owner.client)]);retries.forEach(ok);
 assert.equal(ok(await admin.from('community_resume_shares').select('*').eq('post_id',post)).length,1);
 assert.ok((await create(owner.client,post,{content:'Changed retry'})).error);
 assert.ok((await create(peer.client,badPost)).error); // cannot share someone else's draft
 assert.deepEqual(ok(await admin.from('community_posts').select('id').eq('id',badPost)),[]);
 assert.ok((await create(owner.client,badPost,{}, {title:'invalid',sections:[]})).error);
 assert.deepEqual(ok(await admin.from('community_posts').select('id').eq('id',badPost)),[]);
 ok(await owner.client.from('community_posts').insert({id:legacy,user_id:owner.id,...payload}));
 assert.equal(await read(peer.client,legacy),null); // no legacy backfill
 ok(await owner.client.from('community_groups').insert({id:group,creator_id:owner.id,is_private:true,name:'Resume privacy test',slug:`resume-${group.slice(0,12)}`}));
 ok(await create(owner.client,privatePost,{group_id:group}));
 assert.equal(await read(peer.client,privatePost),null);
 ok(await admin.from('community_group_members').insert({group_id:group,user_id:peer.id,role:'member'}));
 assert.deepEqual(await read(peer.client,privatePost),snapshot);
 ok(await admin.from('community_group_members').delete().eq('group_id',group).eq('user_id',peer.id));
 assert.equal(await read(peer.client,privatePost),null);
 for(const [a,b] of [[owner,peer],[peer,owner]]){
  ok(await a.client.from('community_blocks').insert({blocker_id:a.id,blocked_id:b.id}));
  assert.equal(await read(peer.client),null);
  ok(await a.client.from('community_blocks').delete().eq('blocker_id',a.id).eq('blocked_id',b.id));
 }
 ok(await owner.client.from('community_posts').update({is_hidden:true}).eq('id',post));
 assert.equal(await read(peer.client),null);assert.equal(await read(owner.client),null);
 ok(await owner.client.from('community_posts').update({is_hidden:false}).eq('id',post));
 ok(await owner.client.from('resumes').update({title:'PRIVATE CHANGED DRAFT'}).eq('id',resume));
 assert.deepEqual(await read(peer.client),snapshot);
 ok(await peer.client.from('community_resume_shares').delete().eq('post_id',post));
 assert.deepEqual(await read(peer.client),snapshot);
 ok(await owner.client.from('community_resume_shares').delete().eq('post_id',post));
 assert.equal(await read(peer.client),null);
 assert.ok((await create(owner.client)).error); // replay cannot resurrect revoked shares
 ok(await owner.client.from('community_posts').delete().eq('id',privatePost));
 assert.equal(await read(owner.client,privatePost),null);
 assert.deepEqual(ok(await admin.from('community_resume_shares').select('post_id').eq('post_id',privatePost)),[]);
 // A former private-group member retains a direct owner removal/export path.
 const email=`resume-cleanup-${randomUUID()}@caat.local.test`;
 disposableUser=ok(await admin.auth.admin.createUser({email,password:process.env.E2E_TEST_PASSWORD,email_confirm:true})).user.id;
 ok(await admin.from('profiles').insert({id:disposableUser,first_name:'Synthetic',last_name:'Resume Cleanup'}));
 const temp=await login(email),tempResume=randomUUID(),tempPost=randomUUID(),cascadePost=randomUUID();
 disposableClient=temp.client;
 ok(await temp.client.from('resumes').insert({id:tempResume,user_id:temp.id,title:'Temporary draft'}));
 ok(await admin.from('community_group_members').insert({group_id:group,user_id:temp.id,role:'member'}));
 ok(await create(temp.client,tempPost,{resume_link:tempResume,group_id:group}));
 ok(await admin.from('community_group_members').delete().eq('group_id',group).eq('user_id',temp.id));
 assert.equal(await read(temp.client,tempPost),null);
 assert.equal(ok(await temp.client.from('community_resume_shares').select('post_id').eq('post_id',tempPost)).length,1);
 ok(await temp.client.from('community_resume_shares').delete().eq('post_id',tempPost));
 assert.deepEqual(ok(await admin.from('community_resume_shares').select('post_id').eq('post_id',tempPost)),[]);
 ok(await create(temp.client,cascadePost,{resume_link:tempResume}));
 ok(await temp.client.from('resumes').delete().eq('id',tempResume));
 assert.deepEqual(await read(peer.client,cascadePost),snapshot); // explicitly published copy is independent
 ok(await temp.client.rpc('delete_own_account'));disposableUser=null;disposableClient=null;
 assert.deepEqual(ok(await admin.from('community_resume_shares').select('post_id').eq('post_id',cascadePost)),[]);
 assert.deepEqual(ok(await admin.from('community_posts').select('id').eq('id',cascadePost)),[]);
 console.log('PASS community resume privacy, immutable snapshots, atomicity, retries, revocation and post cascade');
}finally{
 if(disposableClient)await disposableClient.rpc('delete_own_account');
 if(disposableUser)await admin.auth.admin.deleteUser(disposableUser);
 await admin.from('community_posts').delete().in('id',[post,legacy,privatePost,badPost]);
 await admin.from('community_groups').delete().eq('id',group);
 await admin.from('resumes').delete().eq('id',resume);
 await admin.from('community_blocks').delete().eq('blocker_id',owner.id).eq('blocked_id',peer.id);
 await admin.from('community_blocks').delete().eq('blocker_id',peer.id).eq('blocked_id',owner.id);
}
