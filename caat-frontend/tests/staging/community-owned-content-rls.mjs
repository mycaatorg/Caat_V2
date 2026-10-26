import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalApiUrl} from './safety.mjs';
const url=process.env.SUPABASE_URL;assertLocalApiUrl(url);
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts),anon=createClient(url,process.env.SUPABASE_ANON_KEY,opts);
const ok=r=>{assert.ifError(r.error);return r.data;};
async function login(email){const client=createClient(url,process.env.SUPABASE_ANON_KEY,opts);const data=ok(await client.auth.signInWithPassword({email,password:process.env.E2E_TEST_PASSWORD}));return {client,id:data.user.id};}
const owner=await login('e2e.student@caat.local.test'),peer=await login('e2e.peer@caat.local.test');
const group=randomUUID(),post=randomUUID(),comment=randomUUID(),reply=randomUUID(),peerPost=randomUUID(),resume=randomUUID();
const remove=(client,kind,id)=>client.rpc('remove_owned_community_content',{p_kind:kind,p_id:id});
const list=client=>client.rpc('list_owned_community_content',{p_page:0});
try{
 ok(await peer.client.from('community_groups').insert({id:group,creator_id:peer.id,is_private:true,name:'Private synthetic content',slug:`owned-${group.slice(0,12)}`}));
 ok(await admin.from('community_group_members').insert({group_id:group,user_id:owner.id,role:'member'}));
 ok(await owner.client.from('resumes').insert({id:resume,user_id:owner.id,title:'Private draft'}));
 ok(await owner.client.rpc('create_community_resume_post',{p_post_id:post,p_post:{content:'My own private post',topic_tag:'ADVICE',group_id:group,resume_link:resume},p_snapshot:{title:'Copy',sections:[{label:'Work',html:'<p>Shared work</p>'}]}}));
 ok(await peer.client.from('community_posts').insert({id:peerPost,user_id:peer.id,group_id:group,topic_tag:'ADVICE',content:'PEER PRIVATE CONTENT'}));
 ok(await owner.client.from('community_comments').insert({id:comment,user_id:owner.id,post_id:post,content:'My own private comment'}));
 ok(await peer.client.from('community_comments').insert({id:reply,user_id:peer.id,post_id:post,parent_comment_id:comment,content:'PEER PRIVATE REPLY'}));
 ok(await owner.client.from('community_group_members').delete().eq('group_id',group).eq('user_id',owner.id));
 const before=ok(await admin.from('community_group_members').select('*').eq('group_id',group));
 assert.deepEqual(ok(await owner.client.from('community_posts').select('*').eq('id',post)),[]);
 assert.deepEqual(ok(await owner.client.from('community_comments').select('*').eq('id',reply)),[]);
 const rows=ok(await list(owner.client));assert.ok(rows.some(r=>r.id===post&&r.content==='My own private post'));
 assert.ok(rows.some(r=>r.id===comment));assert.ok(rows.length<=21);
 assert.ok(!JSON.stringify(rows).includes('PEER PRIVATE'));
 rows.forEach(r=>assert.deepEqual(Object.keys(r).sort(),['content','created_at','id','kind','removed']));
 assert.ok((await list(anon)).error);assert.ok((await remove(anon,'post',post)).error);
 assert.equal(ok(await remove(peer.client,'post',post)),false);
 assert.equal(ok(await remove(owner.client,'post',peerPost)),false);
 assert.equal(ok(await remove(owner.client,'post',randomUUID())),false);
 const results=await Promise.all([remove(owner.client,'post',post),remove(owner.client,'post',post)]);results.forEach(r=>assert.equal(ok(r),true));
 assert.equal(ok(await remove(owner.client,'comment',comment)),true);assert.equal(ok(await remove(owner.client,'comment',comment)),true);
 const redacted=ok(await peer.client.from('community_posts').select('*').eq('id',post).single());
 assert.equal(redacted.content,'[Removed by author]');assert.equal(redacted.is_removed,true);assert.equal(redacted.is_anonymous,true);
 for(const key of ['resume_link','result_card','score_card','poll_options','university_id','major_id'])assert.equal(redacted[key],null);
 assert.equal(ok(await peer.client.rpc('read_community_resume',{p_post_id:post})),null);
 assert.equal(ok(await owner.client.from('resumes').select('id').eq('id',resume)).length,1);
 assert.equal(ok(await peer.client.from('community_comments').select('content').eq('id',reply).single()).content,'PEER PRIVATE REPLY');
 const deleted=ok(await peer.client.from('community_comments').select('content,is_deleted').eq('id',comment).single());assert.deepEqual(deleted,{content:'[deleted]',is_deleted:true});
 assert.deepEqual(ok(await owner.client.from('community_posts').select('*').eq('id',post)),[]);
 assert.deepEqual(ok(await owner.client.from('community_groups').select('*').eq('id',group)),[]);
 assert.deepEqual(ok(await owner.client.rpc('get_poll_vote_counts',{post_ids:[post]})),[]);
 assert.deepEqual(ok(await admin.from('community_group_members').select('*').eq('group_id',group)),before);
 // Restored membership does not let a stale edit revive the removed payload.
 ok(await admin.from('community_group_members').insert({group_id:group,user_id:owner.id,role:'member'}));
 assert.ok((await owner.client.from('community_posts').update({content:'STALE',is_removed:false}).eq('id',post)).error);
 assert.ok((await owner.client.from('community_comments').update({content:'STALE',is_deleted:false}).eq('id',comment)).error);
 ok(await admin.from('community_posts').update({is_hidden:true}).eq('id',post));
 assert.ok((await owner.client.rpc('list_owned_community_content',{p_page:-1})).error);
 assert.ok((await remove(owner.client,'anything',post)).error);
 // Account removal must still clean up redacted rows under the new triggers.
 const email=`owned-cleanup-${randomUUID()}@caat.local.test`;
 const tempId=ok(await admin.auth.admin.createUser({email,password:process.env.E2E_TEST_PASSWORD,email_confirm:true})).user.id;
 const temp=await login(email),tempPost=randomUUID(),tempComment=randomUUID();
 try{
  ok(await temp.client.from('community_posts').insert({id:tempPost,user_id:tempId,topic_tag:'ADVICE',content:'Disposable content'}));
  ok(await temp.client.from('community_comments').insert({id:tempComment,user_id:tempId,post_id:tempPost,content:'Disposable comment'}));
  assert.equal(ok(await remove(temp.client,'post',tempPost)),true);assert.equal(ok(await remove(temp.client,'comment',tempComment)),true);
  ok(await temp.client.rpc('delete_own_account'));
  assert.deepEqual(ok(await admin.from('community_posts').select('id').eq('id',tempPost)),[]);
  assert.deepEqual(ok(await admin.from('community_comments').select('id').eq('id',tempComment)),[]);
 }finally{await temp.client.rpc('delete_own_account');}
 console.log('PASS owner-only former-member redaction, privacy, retries, immutable placeholders and peer replies');
}finally{
 await admin.from('community_posts').delete().in('id',[post,peerPost]);
 await admin.from('community_resume_publications').delete().eq('id',post);
 await admin.from('resumes').delete().eq('id',resume);
 await admin.from('community_groups').delete().eq('id',group);
}
