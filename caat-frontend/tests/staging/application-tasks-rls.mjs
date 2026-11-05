// PROD-264: disposable local fixtures only; never overwrite existing work.
import assert from 'node:assert/strict';
import { randomUUID, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {checkLocalPsql,localDatabaseUrl} from './local-db.mjs';
import { assertLocalApiUrl } from './safety.mjs';
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_ANON_KEY, password=process.env.E2E_TEST_PASSWORD;
assertLocalApiUrl(url);
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const client=()=>createClient(url,key,opts);
const owner=client(),peer=client(),anon=client(),admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const ok=r=>{assert.ifError(r.error);return r.data;};
const ownerId=ok(await owner.auth.signInWithPassword({email:'e2e.student@caat.local.test',password})).user.id;
const peerId=ok(await peer.auth.signInWithPassword({email:'e2e.peer@caat.local.test',password})).user.id;
const schoolId=randomInt(1500000000,2000000000),tasks=[],apps=[];
let schoolCreated=false, disposableUser;
const newId=()=>{const id=randomUUID();tasks.push(id);return id;};
const create=(who,id,application,text='Personal task',date='2026-11-10')=>who.rpc('create_application_task',{p_task_id:id,p_application_id:application,p_text:text,p_due_date:date});
const taskRows=async id=>ok(await admin.from('user_todos').select('*').eq('id',id));
const links=async id=>ok(await admin.from('application_task_links').select('task_id,application_id,user_id').eq('task_id',id));
try {
  ok(await admin.from('schools').insert({id:schoolId,name:`Synthetic application task ${randomUUID()}`,country:'Australia',institution_type:'university'}));schoolCreated=true;
  for(const [who,userId] of [[owner,ownerId],[peer,peerId]])apps.push(ok(await who.from('user_school_applications').insert({user_id:userId,school_id:schoolId}).select('id').single()).id);
  const [app,peerApp]=apps;
  const taskId=newId();
  const created=ok(await create(owner,taskId,app,'\t\u00a0 My preparation \ufeff'));
  assert.deepEqual(created,[{id:taskId,text:'My preparation',due_date:'2026-11-10',done:false,priority:2}]);
  assert.deepEqual(await links(taskId),[{task_id:taskId,application_id:app,user_id:ownerId}]);
  assert.deepEqual(ok(await create(owner,taskId,app,'My preparation')),created,'identical delivery retry returns the same task');
  assert.ok((await create(owner,taskId,app,'Different retry')).error,'changed retry cannot overwrite');
  assert.equal((await taskRows(taskId))[0].text,'My preparation');

  for(let round=0;round<30;round++){
    const concurrentId=newId();
    const concurrent=await Promise.all(Array.from({length:8},()=>create(owner,concurrentId,app)));
    for(const result of concurrent)assert.deepEqual(ok(result),[{id:concurrentId,text:'Personal task',due_date:'2026-11-10',done:false,priority:2}]);
    assert.equal((await taskRows(concurrentId)).length,1,'concurrent duplicate creates one task');
    assert.equal((await links(concurrentId)).length,1,'concurrent duplicate creates one link');
  }

  const mixedId=newId();
  const mixed=await Promise.all(Array.from({length:8},(_,i)=>create(owner,mixedId,app,i%2?'Payload B':'Payload A')));
  const winners=mixed.filter(r=>!r.error),losers=mixed.filter(r=>r.error);
  assert.equal(winners.length,4);assert.equal(losers.length,4);
  for(const result of winners)assert.deepEqual(ok(result),winners[0].data);
  for(const result of losers)assert.equal(result.error.code,'PT409','changed concurrent payload cannot overwrite');
  assert.equal((await taskRows(mixedId))[0].text,winners[0].data[0].text);
  assert.equal((await links(mixedId)).length,1);
  const contestedId=newId();
  const contested=await Promise.all([create(owner,contestedId,app),create(peer,contestedId,peerApp)]);
  assert.equal(contested.filter(r=>!r.error).length,1,'different owners sharing an ID have only one winner');
  assert.equal(contested.filter(r=>r.error).length,1);
  const winnerIndex=contested.findIndex(r=>!r.error),winnerOwner=winnerIndex===0?ownerId:peerId,winnerApp=winnerIndex===0?app:peerApp;
  assert.equal((await taskRows(contestedId))[0].user_id,winnerOwner);
  assert.deepEqual(await links(contestedId),[{task_id:contestedId,application_id:winnerApp,user_id:winnerOwner}]);

  assert.deepEqual(ok(await peer.from('application_task_links').select('*').eq('task_id',taskId)),[]);
  assert.deepEqual(ok(await peer.from('application_task_links').delete().eq('task_id',taskId).select('task_id')),[]);
  assert.ok((await anon.from('application_task_links').select('*')).error);
  assert.ok((await owner.from('application_task_links').update({application_id:peerApp}).eq('task_id',taskId)).error,'links cannot be repointed');

  for(const [who,application] of [[owner,peerApp],[peer,app],[anon,app]]) {
    const id=newId();assert.ok((await create(who,id,application)).error,'foreign/anonymous creation refused');
    assert.deepEqual(await taskRows(id),[],'failed link creation leaves no orphan task');
  }
  const peerTask=newId(),ownTask=newId();
  ok(await peer.from('user_todos').insert({id:peerTask,user_id:peerId,text:'Peer task'}));
  ok(await owner.from('user_todos').insert({id:ownTask,user_id:ownerId,text:'Existing task'}));
  for(const [task,application,user] of [[peerTask,app,ownerId],[ownTask,peerApp,ownerId],[ownTask,app,peerId]])
    assert.ok((await owner.from('application_task_links').insert({task_id:task,application_id:application,user_id:user})).error,'cross-owner link refused');
  ok(await owner.from('application_task_links').insert({task_id:ownTask,application_id:app,user_id:ownerId}));
  assert.ok((await owner.from('application_task_links').insert({task_id:ownTask,application_id:app,user_id:ownerId})).error,'one link per task');
  assert.deepEqual(ok(await owner.from('application_task_links').delete().eq('task_id',ownTask).eq('application_id',app).select('task_id')),[{task_id:ownTask}]);
  assert.equal((await taskRows(ownTask)).length,1,'unlink preserves task');

  for(const text of [null,'\t\n\u00a0\ufeff','x'.repeat(1001),'😀'.repeat(501)]) {
    const id=newId();assert.equal((await create(owner,id,app,text)).error?.code,'22023');assert.deepEqual(await taskRows(id),[]);
  }
  const boundaryId=newId();assert.equal(ok(await create(owner,boundaryId,app,'😀'.repeat(500),null))[0].text.length,1000);
  const dateId=newId();assert.ok((await create(owner,dateId,app,'Invalid date','2026-02-30')).error);assert.deepEqual(await taskRows(dateId),[]);
  ok(await owner.from('user_todos').delete().eq('id',boundaryId));assert.deepEqual(await links(boundaryId),[],'task deletion removes its link');
  ok(await owner.from('user_school_applications').delete().eq('id',app));
  assert.deepEqual(await links(taskId),[],'application deletion removes links');
  assert.equal((await taskRows(taskId)).length,1,'application deletion preserves personal work');
  const privileges=checkLocalPsql(localDatabaseUrl(),['-At','-c',`select has_table_privilege('authenticated','public.application_task_links','SELECT'),has_table_privilege('authenticated','public.application_task_links','DELETE'),has_table_privilege('authenticated','public.application_task_links','UPDATE'),has_column_privilege('authenticated','public.application_task_links','created_at','INSERT'),has_function_privilege('anon','public.create_application_task(uuid,uuid,text,date)','EXECUTE');`]);
  assert.equal(privileges,'t|t|f|f|f','least-privilege grants');
  disposableUser=ok(await admin.auth.admin.createUser({email:`task-delete-${randomUUID()}@caat.local.test`,password:randomUUID(),email_confirm:true})).user.id;
  const disposableTask=newId(),disposableApp=randomUUID();apps.push(disposableApp);
  ok(await admin.from('user_school_applications').insert({id:disposableApp,user_id:disposableUser,school_id:schoolId}));
  ok(await admin.from('user_todos').insert({id:disposableTask,user_id:disposableUser,text:'Disposable account task'}));
  ok(await admin.from('application_task_links').insert({task_id:disposableTask,application_id:disposableApp,user_id:disposableUser}));
  ok(await admin.auth.admin.deleteUser(disposableUser));disposableUser=undefined;
  assert.deepEqual(await links(disposableTask),[],'account deletion removes links');
  assert.deepEqual(await taskRows(disposableTask),[],'account deletion removes personal tasks');
  console.log('Application tasks: atomic/idempotent creation, validation, ownership, immutable links and non-destructive unlink/application deletion PASS.');
} finally {
  if(disposableUser)ok(await admin.auth.admin.deleteUser(disposableUser));
  if(tasks.length)ok(await admin.from('user_todos').delete().in('id',tasks));
  if(apps.length)ok(await admin.from('user_school_applications').delete().in('id',apps));
  if(schoolCreated)ok(await admin.from('schools').delete().eq('id',schoolId));
  await Promise.all([owner.auth.signOut(),peer.auth.signOut()]);
}
