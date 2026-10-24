// PROD-153: real database contracts, only on the isolated local stack.
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
const users = [], run = randomUUID();
async function user(name) {
  const email = `e2e.items.${name}.${run}@caat.local.test`;
  const { user } = ok(await admin.auth.admin.createUser({ email, password: process.env.E2E_TEST_PASSWORD, email_confirm: true }));
  users.push(user.id);
  const client = createClient(url, process.env.SUPABASE_ANON_KEY, opts);
  ok(await client.auth.signInWithPassword({ email, password: process.env.E2E_TEST_PASSWORD }));
  return { id: user.id, client };
}
try {
  const owner = await user('owner'), peer = await user('peer');
  const items = owner.client.from('evidence_items');
  const create = (who, patch={}) => who.client.from('evidence_items').insert({ user_id: who.id, kind: 'activity', title: 'Debate captain', ...patch }).select('*').single();
  const source = ok(await create(owner, { origin_key: 'activity:debate', description: 'Led weekly practice' }));
  assert.ok(source.revision);
  assert.equal((await create(owner, { origin_key: 'activity:debate' })).error?.code, '23505');
  const peerSource = ok(await create(peer, { origin_key: 'activity:debate' }));
  for (const patch of [{title:' '},{kind:'invented'},{description:'x'.repeat(10001)},{start_date:'2026-10-24',end_date:'2026-10-23'},{is_current:true,end_date:'2026-10-24'}]) assert.equal((await create(owner,patch)).error?.code, '23514', 'invalid input refused');
  assert.equal((await create(owner,{revision:randomUUID()})).error?.code,'42501');
  assert.equal((await create(peer,{user_id:owner.id})).error?.code,'42501');
  assert.deepEqual(ok(await peer.client.from('evidence_items').select('*').eq('id',source.id)),[]);
  assert.deepEqual(ok(await peer.client.from('evidence_items').update({title:'Stolen'}).eq('id',source.id).select('id')),[]);
  assert.deepEqual(ok(await peer.client.from('evidence_items').delete().eq('id',source.id).select('id')),[]);
  assert.equal((await anon.from('evidence_items').select('id')).error?.code,'42501');
  for(const patch of [{user_id:peer.id},{origin_key:'changed'},{revision:randomUUID()}]) assert.equal((await items.update(patch).eq('id',source.id)).error?.code,'42501');
  const unchanged=ok(await items.update({title:source.title}).eq('id',source.id).select('*').single());
  assert.equal(unchanged.revision,source.revision,'no-op does not announce source change');
  const edited=ok(await items.update({title:'Debate team captain'}).eq('id',source.id).eq('revision',source.revision).select('*').single());
  assert.notEqual(edited.revision,source.revision);
  assert.deepEqual(ok(await items.update({title:'Stale edit'}).eq('id',source.id).eq('revision',source.revision).select('id')),[]);
  const app = ok(await owner.client.from('user_school_applications').insert({user_id:owner.id,school_id:900001,status:'researching'}).select('id').single());
  const peerApp = ok(await peer.client.from('user_school_applications').insert({user_id:peer.id,school_id:900001,status:'researching'}).select('id').single());
  const addLink=(who,itemId,appId)=>who.client.from('application_evidence_links').insert({user_id:who.id,application_id:appId,kind:'item',evidence_item_id:itemId}).select('*').single();
  const link=ok(await addLink(owner,source.id,app.id));
  assert.equal((await addLink(owner,source.id,app.id)).error?.code,'23505');
  assert.equal((await addLink(owner,peerSource.id,app.id)).error?.code,'23503');
  assert.equal((await addLink(owner,source.id,peerApp.id)).error?.code,'23503');
  const links=owner.client.from('application_evidence_links');
  const tailored=ok(await links.update({tailored_title:'Application title',tailored_body:'Snapshot',source_revision:edited.revision}).eq('id',link.id).eq('revision',link.revision).select('*').single());
  assert.notEqual(tailored.revision,link.revision);
  ok(await links.update({tailored_body:'x'.repeat(10500)}).eq('id',link.id));
  ok(await links.update({tailored_body:'Snapshot'}).eq('id',link.id));
  assert.deepEqual(ok(await links.update({tailored_title:'Lost update'}).eq('id',link.id).eq('revision',link.revision).select('id')),[]);
  const newer=ok(await items.update({description:'Updated source'}).eq('id',source.id).select('*').single());
  const kept=ok(await links.select('*').eq('id',link.id).single());
  assert.equal(kept.tailored_body,'Snapshot');
  assert.equal(kept.source_revision,edited.revision);
  assert.notEqual(newer.revision,kept.source_revision);
  assert.equal((await links.update({evidence_item_id:peerSource.id}).eq('id',link.id)).error?.code,'42501');
  assert.equal((await items.delete().eq('id',source.id)).error?.code,'23503');
  ok(await links.delete().eq('id',link.id));
  assert.equal(ok(await items.select('id').eq('id',source.id)).length,1,'unlink preserves source');
  ok(await addLink(owner,source.id,app.id));
  ok(await owner.client.rpc('delete_own_account'));
  users.splice(users.indexOf(owner.id),1);
  for(const table of ['evidence_items','application_evidence_links']) assert.deepEqual(ok(await admin.from(table).select('id').eq('user_id',owner.id)),[]);
  console.log('Evidence items RLS passed: ownership, validation, imports, immutable identities, revisions, stale writes, linked deletion and account cleanup.');
} finally {
  for(const id of users) {
    await admin.from('application_evidence_links').delete().eq('user_id',id);
    await admin.from('evidence_items').delete().eq('user_id',id);
    await admin.from('user_school_applications').delete().eq('user_id',id);
    ok(await admin.auth.admin.deleteUser(id));
  }
}
