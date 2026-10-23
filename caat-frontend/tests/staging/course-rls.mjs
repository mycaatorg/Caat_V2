import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;
if (!url || !anonKey || !serviceKey || !password) throw new Error('Local isolated Supabase settings are required.');
assertLocalApiUrl(url);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, anonKey, options);
const admin = createClient(url, serviceKey, options);
const ok = result => { assert.ifError(result.error); return result.data; };
async function login(email) {
  const client = createClient(url, anonKey, options);
  const data = ok(await client.auth.signInWithPassword({ email, password }));
  return { client, id: data.user.id };
}
const owner = await login('e2e.student@caat.local.test');
const peer = await login('e2e.peer@caat.local.test');
const key = `rls-course-${randomUUID()}`;
const ids = [`${key}-one`, `${key}-two`];
const fixture = { institution_key: key, institution_name: 'Synthetic RLS university', name: 'Synthetic RLS course', source_url: 'https://example.invalid/course', uac_code: 'shared-test-code', active: true };
try {
  ok(await admin.from('course_offerings').insert(ids.map((id, i) => ({ ...fixture, id, program_code: String(i) }))));
  assert.equal(ok(await anon.from('course_offerings').select('id').in('id', ids)).length, 2, 'public read keeps shared-UAC offerings distinct');
  assert.ok((await owner.client.from('course_offerings').insert({ ...fixture, id: `${key}-spoof`, program_code: 'spoof' })).error, 'student cannot insert catalogue rows');
  assert.ok((await owner.client.from('course_offerings').update({ name: 'spoof' }).eq('id', ids[0])).error, 'student cannot change catalogue');
  assert.ok((await owner.client.from('course_offerings').delete().eq('id', ids[0])).error, 'student cannot remove catalogue');
  assert.ok((await anon.from('user_course_bookmarks').select('course_id')).error, 'anonymous users cannot read private saves');
  const saved = ok(await owner.client.from('user_course_bookmarks').insert({ user_id: owner.id, course_id: ids[0] }).select('course_id,user_id').single());
  assert.equal(saved.user_id, owner.id, 'owner saves a course');
  ok(await owner.client.from('user_course_bookmarks').upsert({ user_id: owner.id, course_id: ids[0] }, { onConflict: 'user_id,course_id', ignoreDuplicates: true }));
  assert.equal(ok(await owner.client.from('user_course_bookmarks').select('course_id').eq('course_id', ids[0])).length, 1, 'idempotent save stays singular');
  assert.deepEqual(ok(await peer.client.from('user_course_bookmarks').select('course_id').eq('user_id', owner.id)), [], 'peer cannot read owner saves');
  assert.equal((await peer.client.from('user_course_bookmarks').insert({ user_id: owner.id, course_id: ids[1] })).error?.code, '42501', 'peer cannot spoof owner');
  assert.deepEqual(ok(await peer.client.from('user_course_bookmarks').delete().eq('user_id', owner.id).eq('course_id', ids[0]).select('course_id')), [], 'peer cannot remove owner save');
  assert.ok((await owner.client.from('user_course_bookmarks').update({ user_id: peer.id }).eq('course_id', ids[0])).error, 'ownership cannot be transferred');
  ok(await admin.from('course_offerings').update({ active: false }).eq('id', ids[0]));
  const retained = ok(await owner.client.from('user_course_bookmarks').select('course_offerings(id,active)').eq('course_id', ids[0]).single());
  assert.equal(retained.course_offerings.active, false, 'inactive saved offering still resolves');
  assert.equal((await admin.from('course_offerings').delete().eq('id', ids[0])).error?.code, '23503', 'saved offering cannot be hard deleted');
  ok(await peer.client.from('user_course_bookmarks').insert({ user_id: peer.id, course_id: ids[0] }));
  assert.equal(ok(await owner.client.from('user_course_bookmarks').delete().eq('user_id', owner.id).eq('course_id', ids[0]).select('course_id')).length, 1, 'owner can remove own save');
  assert.equal(ok(await peer.client.from('user_course_bookmarks').select('course_id').eq('course_id', ids[0])).length, 1, 'owner removal leaves peer save intact');
  console.log('Course RLS passed: read-only catalogue, distinct shared-UAC offerings, owner saves, denied cross-user access, inactive retention and restricted deletion.');
} finally {
  ok(await admin.from('user_course_bookmarks').delete().in('course_id', ids));
  ok(await admin.from('course_offerings').delete().in('id', ids));
}
