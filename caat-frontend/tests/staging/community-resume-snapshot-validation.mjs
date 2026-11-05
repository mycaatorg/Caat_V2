import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';

const url=process.env.SUPABASE_URL;assertLocalApiUrl(url);
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const owner=createClient(url,process.env.SUPABASE_ANON_KEY,opts);
const ok=r=>{assert.ifError(r.error);return r.data;};
const user=ok(await owner.auth.signInWithPassword({email:'e2e.student@caat.local.test',password:process.env.E2E_TEST_PASSWORD})).user;
const resume=randomUUID(),ids=[];
const valid={title:'Synthetic resume',sections:[{label:'Work',html:'<p>Published copy</p>'}]};
const publish=(id,snapshot)=>owner.rpc('create_community_resume_post',{p_post_id:id,p_post:{content:'Snapshot validation fixture',topic_tag:'ADVICE',resume_link:resume},p_snapshot:snapshot});
const absent=async id=>{for(const [table,key] of [['community_posts','id'],['community_resume_shares','post_id'],['community_resume_publications','id']])assert.deepEqual(ok(await admin.from(table).select(key).eq(key,id)),[]);};
function sized(length){
 const result={title:'x',sections:Array.from({length:5},()=>({label:'',html:''}))};
 let remaining=length-JSON.stringify(result).length;
 for(const section of result.sections){const size=Math.min(20000,remaining);section.html='a'.repeat(size);remaining-=size;}
 assert.equal(remaining,0);assert.equal(JSON.stringify(result).length,length);return result;
}
try{
 ok(await owner.from('resumes').insert({id:resume,user_id:user.id,title:'Private validation draft'}));
 const bad=[
  ['snapshot array',[]],
  ['missing title',{sections:valid.sections}],
  ['null title',{...valid,title:null}],
  ['missing sections',{title:'x'}],
  ['sections object',{title:'x',sections:{}}],
  ['no sections',{title:'x',sections:[]}],
  ['section string',{...valid,sections:['bad']}],
  ['section null',{...valid,sections:[null]}],
  ['missing label',{...valid,sections:[{html:'x'}]}],
  ['missing html',{...valid,sections:[{label:'x'}]}],
  ['nonstring html',{...valid,sections:[{label:'x',html:17}]}],
  ['unknown section field',{...valid,sections:[{label:'x',html:'x',private_note:'never publish'}]}],
  ['unknown top-level field',{...valid,private_note:'never publish'}],
  ['empty title',{...valid,title:' \t\u00a0\ufeff'}],
  ['long title',{...valid,title:'a'.repeat(201)}],
  ['UTF-16 title',{...valid,title:'😀'.repeat(101)}],
  ['long label',{...valid,sections:[{label:'a'.repeat(101),html:'x'}]}],
  ['UTF-16 label',{...valid,sections:[{label:'😀'.repeat(51),html:'x'}]}],
  ['long html',{...valid,sections:[{label:'x',html:'a'.repeat(20001)}]}],
  ['UTF-16 html',{...valid,sections:[{label:'x',html:'😀'.repeat(10001)}]}],
  ['too many sections',{...valid,sections:Array.from({length:21},()=>({label:'',html:''}))}],
  ['oversize serialized DTO',sized(100001)],
  ['escaped serialized DTO',{title:'x',sections:Array.from({length:5},()=>({label:'',html:'"'.repeat(10000)}))}],
 ];
 for(const [label,snapshot] of bad){
  const id=randomUUID();ids.push(id);
  const result=await publish(id,snapshot);assert.equal(result.error?.code,'23514',label);
  await absent(id);
 }
 // Rejection must not consume the caller's idempotency key.
 ok(await publish(ids[0],valid));ok(await publish(ids[0],valid));
 assert.deepEqual(ok(await owner.rpc('read_community_resume',{p_post_id:ids[0]})),valid);
 const accepted=[
  {title:'😀'.repeat(100),sections:[{label:'😀'.repeat(50),html:'😀'.repeat(10000)}]},
  {title:'Quoted content',sections:[{label:'',html:'"'.repeat(20000)}]},
  {title:' \u00a0Title\ufeff ',sections:Array.from({length:20},()=>({label:'',html:''}))},
  sized(100000),
 ];
 for(const snapshot of accepted){const id=randomUUID();ids.push(id);ok(await publish(id,snapshot));assert.deepEqual(ok(await owner.rpc('read_community_resume',{p_post_id:id})),snapshot);}
 console.log('PASS resume DTO shape, Unicode bounds, serialized size and atomic corrected retries');
}finally{
 if(ids.length){await admin.from('community_posts').delete().in('id',ids);await admin.from('community_resume_publications').delete().in('id',ids);}
 await admin.from('resumes').delete().eq('id',resume);
}
