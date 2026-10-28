import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalApiUrl} from './safety.mjs';
const url=process.env.SUPABASE_URL;assertLocalApiUrl(url);
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const anon=createClient(url,process.env.SUPABASE_ANON_KEY,opts);
const ok=r=>{assert.ifError(r.error);return r.data;};
const stamp='2020-01-01T00:00:00.123456+00:00';
let ownerId;const post=randomUUID(),newPost=randomUUID();
try{
 const email=`cursor-${randomUUID()}@caat.local.test`;
 ownerId=ok(await admin.auth.admin.createUser({email,password:process.env.E2E_TEST_PASSWORD,email_confirm:true})).user.id;
 const owner=createClient(url,process.env.SUPABASE_ANON_KEY,opts);
 ok(await owner.auth.signInWithPassword({email,password:process.env.E2E_TEST_PASSWORD}));
 const list=(args={})=>owner.rpc('list_owned_community_content_page',args);
 ok(await admin.from('community_posts').insert({id:post,user_id:ownerId,content:'Owner post',topic_tag:'ADVICE',created_at:stamp}));
 const comments=Array.from({length:5025},(_,i)=>({id:i===0?post:randomUUID(),user_id:ownerId,post_id:post,content:`Owner comment ${i}`,created_at:stamp}));
 for(let start=0;start<comments.length;start+=500)ok(await admin.from('community_comments').insert(comments.slice(start,start+500)));
 const expected=[{kind:'post',id:post},...comments.map(c=>({kind:'comment',id:c.id}))].sort((a,b)=>b.id.localeCompare(a.id)||a.kind.localeCompare(b.kind)).map(r=>`${r.kind}:${r.id}`);
 const args=(row,direction='older')=>({p_created_at:row.created_at,p_id:row.id,p_kind:row.kind,p_direction:direction});
 const first=ok(await list());assert.equal(first.length,21);assert.equal(first[0].created_at,stamp);
 first.forEach(row=>assert.deepEqual(Object.keys(row).sort(),['content','created_at','id','kind','removed']));
 ok(await owner.from('community_posts').insert({id:newPost,user_id:ownerId,content:'Inserted while paging',topic_tag:'ADVICE'}));
 const second=ok(await list(args(first[19])));
 const previous=ok(await list(args(second[0],'newer')));
 assert.deepEqual(previous.slice(0,20).map(r=>`${r.kind}:${r.id}`).reverse(),expected.slice(0,20));
 const seen=first.slice(0,20).map(r=>`${r.kind}:${r.id}`);let page=second;
 for(let n=0;;n++){
  assert.ok(n<260,'history traversal terminates');
  seen.push(...page.slice(0,20).map(r=>`${r.kind}:${r.id}`));
  if(page.length<21)break;
  page=ok(await list(args(page[19])));
 }
 assert.deepEqual(seen,expected,'every old item reachable exactly once beyond former 5020 ceiling');
 const anchor=second.find(r=>r.kind==='comment');
 ok(await admin.from('community_comments').delete().eq('id',anchor.id));
 const afterDeleted=ok(await list(args(anchor)));assert.ok(afterDeleted.length>0);assert.ok(!afterDeleted.some(r=>r.id===anchor.id&&r.kind===anchor.kind));
 assert.ok((await list({p_id:post})).error);assert.ok((await list({...args(first[0]),p_kind:'group'})).error);
 assert.ok((await list({p_direction:'sideways'})).error);assert.ok((await anon.rpc('list_owned_community_content_page')).error);
 const peer=createClient(url,process.env.SUPABASE_ANON_KEY,opts);
 ok(await peer.auth.signInWithPassword({email:'e2e.peer@caat.local.test',password:process.env.E2E_TEST_PASSWORD}));
 assert.ok(!JSON.stringify(ok(await peer.rpc('list_owned_community_content_page',args(first[0])))).includes('Owner comment'));
 console.log('PASS cursor history: 5026 items, insertion stability, bidirectional ties, microseconds, deleted anchor, privacy and validation');
}finally{
 if(ownerId)ok(await admin.auth.admin.deleteUser(ownerId));
}
