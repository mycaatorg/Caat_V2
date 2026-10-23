// PROD-77: attaching saved scholarships to applications, and preparation ticks,
// on the isolated local stack only. Synthetic users and rows; restores prior state.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { checkLocalPsql, localDatabaseUrl } from './local-db.mjs';
import { assertLocalApiUrl } from './safety.mjs';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;
if (!url || !anonKey || !serviceKey || !password) throw new Error('Local isolated Supabase settings are required.');
assertLocalApiUrl(url);
const dbUrl = localDatabaseUrl();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, anonKey, options);
const admin = createClient(url, serviceKey, options);
const ok = (result) => { assert.ifError(result.error); return result.data; };
async function login(email) {
  const client = createClient(url, anonKey, options);
  const data = ok(await client.auth.signInWithPassword({ email, password }));
  return { client, id: data.user.id };
}

const BOOKMARKS = 'user_bookmarked_scholarships';
const APPS = 'user_school_applications';
const TICKS = 'user_scholarship_prep_checks';
const SCHOLARSHIP = 'e2000000-0000-4000-8000-0000000000a1';
const OTHER_SCHOLARSHIP = 'e2000000-0000-4000-8000-000000000002';
const SCHOOL = 900001;
const OTHER_SCHOOL = 900077;
const owner = await login('e2e.student@caat.local.test');
const peer = await login('e2e.peer@caat.local.test');
const users = [owner.id, peer.id];
const scholarships = [SCHOLARSHIP, OTHER_SCHOLARSHIP];
const priorBookmarks = ok(await admin.from(BOOKMARKS).select('*').in('user_id', users).in('scholarship_id', scholarships));
const priorApps = ok(await admin.from(APPS).select('*').in('user_id', users).in('school_id', [SCHOOL, OTHER_SCHOOL]));
const bookmark = async (userId, scholarshipId = SCHOLARSHIP) =>
  ok(await admin.from(BOOKMARKS).select('status, school_id').eq('user_id', userId).eq('scholarship_id', scholarshipId).maybeSingle());
const ticksFor = async (userId) => ok(await admin.from(TICKS).select('item_key').eq('user_id', userId).eq('scholarship_id', SCHOLARSHIP)).map((r) => r.item_key).sort();
let disposableId = null;

async function cleanup() {
  ok(await admin.from(BOOKMARKS).delete().in('user_id', users).in('scholarship_id', scholarships));
  ok(await admin.from(APPS).delete().in('user_id', users).in('school_id', [SCHOOL, OTHER_SCHOOL]));
}

try {
  await cleanup();
  ok(await admin.from('schools').upsert({ id: OTHER_SCHOOL, name: 'Synthetic PROD-77 RLS University', country: 'Australia', institution_type: 'university' }));

  // Owner saves the scholarship (no attachment yet) and has no application.
  ok(await owner.client.from(BOOKMARKS).insert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, status: 'interested' }));
  const noApp = await owner.client.from(BOOKMARKS).update({ school_id: SCHOOL }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP).select('school_id');
  assert.equal(noApp.error?.code, '42501', 'owner cannot attach to a university without their own application');
  assert.equal((await bookmark(owner.id)).school_id, null, 'denied attach left the bookmark unattached');
  const insertAttached = await owner.client.from(BOOKMARKS).insert({ user_id: owner.id, scholarship_id: OTHER_SCHOLARSHIP, status: 'interested', school_id: OTHER_SCHOOL });
  assert.equal(insertAttached.error?.code, '42501', 'owner cannot save a scholarship already attached to a university without an application');

  // With an application the owner can attach, re-status while attached, detach and re-attach.
  const app = ok(await owner.client.from(APPS).insert({ user_id: owner.id, school_id: SCHOOL, status: 'researching' }).select('id').single());
  const attached = ok(await owner.client.from(BOOKMARKS).update({ school_id: SCHOOL }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP).select('scholarship_id, school_id'));
  assert.deepEqual(attached, [{ scholarship_id: SCHOLARSHIP, school_id: SCHOOL }], 'owner attaches to their own application university');
  const restatus = ok(await owner.client.from(BOOKMARKS).upsert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, status: 'applied' }, { onConflict: 'user_id,scholarship_id' }).select('status, school_id'));
  assert.deepEqual(restatus, [{ status: 'applied', school_id: SCHOOL }], 'status upsert keeps the attachment');
  const elsewhere = await owner.client.from(BOOKMARKS).update({ school_id: OTHER_SCHOOL }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP).select('school_id');
  assert.equal(elsewhere.error?.code, '42501', 'owner cannot move it to a university without an application');
  const detached = ok(await owner.client.from(BOOKMARKS).update({ school_id: null }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP).select('school_id'));
  assert.deepEqual(detached, [{ school_id: null }], 'owner detaches');
  ok(await owner.client.from(BOOKMARKS).update({ school_id: SCHOOL }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP).select('school_id'));

  // Peer cannot touch the owner's bookmark, nor borrow the owner's application.
  const peerUpdate = await peer.client.from(BOOKMARKS).update({ school_id: null }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP).select('school_id');
  assert.equal(peerUpdate.error, null, 'peer update leaks no error');
  assert.deepEqual(peerUpdate.data, [], 'peer update of the owner bookmark matches zero rows');
  ok(await peer.client.from(BOOKMARKS).insert({ user_id: peer.id, scholarship_id: SCHOLARSHIP, status: 'interested' }));
  const borrow = await peer.client.from(BOOKMARKS).update({ school_id: SCHOOL }).eq('user_id', peer.id).eq('scholarship_id', SCHOLARSHIP).select('school_id');
  assert.equal(borrow.error?.code, '42501', "peer cannot attach to a university through the owner's application");
  assert.equal((await bookmark(owner.id)).school_id, SCHOOL, 'peer attempts left the owner attachment in place');

  // Ticks: owner-only, keys only, tied to a saved scholarship.
  ok(await owner.client.from(TICKS).insert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, item_key: 'official-link' }));
  ok(await owner.client.from(TICKS).insert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, item_key: 'rule:0123456789abcdef' }));
  assert.deepEqual(await ticksFor(owner.id), ['official-link', 'rule:0123456789abcdef'], 'owner ticks persist');
  assert.equal(ok(await owner.client.from(TICKS).select('item_key').eq('scholarship_id', SCHOLARSHIP)).length, 2, 'owner reads own ticks');
  assert.equal(ok(await owner.client.from(TICKS).update({ checked_at: new Date().toISOString() }).eq('user_id', owner.id).eq('item_key', 'official-link').select('item_key')).length, 1, 'owner can update own tick');
  assert.equal((await owner.client.from(TICKS).insert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, item_key: 'Not a key' })).error?.code, '23514', 'tick keys must match the checklist key format');
  assert.equal((await owner.client.from(TICKS).insert({ user_id: owner.id, scholarship_id: OTHER_SCHOLARSHIP, item_key: 'essay' })).error?.code, '23503', 'ticks need a saved scholarship');
  assert.deepEqual(ok(await peer.client.from(TICKS).select('item_key').eq('user_id', owner.id)), [], 'peer cannot read owner ticks');
  assert.equal((await peer.client.from(TICKS).insert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, item_key: 'essay' })).error?.code, '42501', 'peer cannot tick for the owner');
  assert.deepEqual(ok(await peer.client.from(TICKS).update({ item_key: 'essay' }).eq('user_id', owner.id).select('item_key')), [], 'peer cannot change owner ticks');
  assert.deepEqual(ok(await peer.client.from(TICKS).delete().eq('user_id', owner.id).select('item_key')), [], 'peer cannot remove owner ticks');
  assert.equal((await owner.client.from(TICKS).update({ user_id: peer.id }).eq('user_id', owner.id).eq('item_key', 'official-link')).error?.code, '42501', 'owner cannot hand a tick to another student');
  assert.equal((await anon.from(TICKS).select('item_key')).error?.code, '42501', 'anonymous visitors cannot read ticks');
  assert.equal((await anon.from(TICKS).insert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, item_key: 'essay' })).error?.code, '42501', 'anonymous visitors cannot tick');
  assert.deepEqual(await ticksFor(owner.id), ['official-link', 'rule:0123456789abcdef'], 'cross-user attempts left owner ticks unchanged');

  const privileges = checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT r || ':' || string_agg(p, ',' ORDER BY p)
    FROM unnest(ARRAY['anon', 'authenticated']) AS r,
         unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES']
                || CASE WHEN current_setting('server_version_num')::int >= 170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) AS p
    WHERE has_table_privilege(r, 'public.${TICKS}', p)
    GROUP BY r ORDER BY r`]);
  assert.equal(privileges, 'authenticated:DELETE,INSERT,SELECT,UPDATE', 'only authenticated keeps SELECT/INSERT/UPDATE/DELETE on ticks');

  // Deleting the application detaches (never deletes) the bookmark and keeps its ticks.
  ok(await owner.client.from(APPS).delete().eq('id', app.id).eq('user_id', owner.id));
  assert.deepEqual(await bookmark(owner.id), { status: 'applied', school_id: null }, 'application delete detaches the saved scholarship');
  assert.deepEqual(await ticksFor(owner.id), ['official-link', 'rule:0123456789abcdef'], 'detaching keeps preparation ticks');
  assert.equal((await bookmark(peer.id)).status, 'interested', "the owner's application delete left the peer bookmark alone");
  ok(await owner.client.from(BOOKMARKS).upsert({ user_id: owner.id, scholarship_id: SCHOLARSHIP, status: 'awarded' }, { onConflict: 'user_id,scholarship_id' }).select('status'));
  assert.equal((await bookmark(owner.id)).status, 'awarded', 'status changes still work after the application is gone');
  const recreated = ok(await owner.client.from(APPS).insert({ user_id: owner.id, school_id: SCHOOL, status: 'researching' }).select('id').single());
  assert.equal((await bookmark(owner.id)).school_id, null, 'recreating the application does not silently re-attach');

  // Changing an application's university also detaches what was attached to the old one.
  ok(await owner.client.from(BOOKMARKS).update({ school_id: SCHOOL }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP).select('school_id'));
  ok(await owner.client.from(APPS).update({ school_id: OTHER_SCHOOL }).eq('id', recreated.id).eq('user_id', owner.id));
  assert.equal((await bookmark(owner.id)).school_id, null, 'moving the application to another university detaches');

  // Removing the saved scholarship removes its ticks.
  ok(await owner.client.from(BOOKMARKS).delete().eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP));
  assert.deepEqual(await ticksFor(owner.id), [], 'removing the saved scholarship removes its ticks');

  // Account deletion still cascades through applications, bookmarks and ticks.
  const email = `e2e.prod77.${randomUUID().slice(0, 8)}@caat.local.test`;
  const created = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  disposableId = created.user.id;
  const disposable = await login(email);
  ok(await disposable.client.from(APPS).insert({ user_id: disposable.id, school_id: SCHOOL, status: 'researching' }));
  ok(await disposable.client.from(BOOKMARKS).insert({ user_id: disposable.id, scholarship_id: SCHOLARSHIP, status: 'interested' }));
  ok(await disposable.client.from(BOOKMARKS).update({ school_id: SCHOOL }).eq('user_id', disposable.id).eq('scholarship_id', SCHOLARSHIP).select('school_id'));
  ok(await disposable.client.from(TICKS).insert({ user_id: disposable.id, scholarship_id: SCHOLARSHIP, item_key: 'essay' }));
  ok(await admin.auth.admin.deleteUser(disposableId));
  disposableId = null;
  for (const table of [APPS, BOOKMARKS, TICKS]) {
    assert.deepEqual(ok(await admin.from(table).select('user_id').eq('user_id', disposable.id)), [], `account deletion removes ${table}`);
  }
  console.log('Scholarship attachment RLS passed: attach only to own applications, peer and anonymous access denied, owner-only ticks, detach on application delete or move, cascades on unsave and account deletion.');
} finally {
  if (disposableId) await admin.auth.admin.deleteUser(disposableId);
  await cleanup();
  ok(await admin.from('schools').delete().eq('id', OTHER_SCHOOL));
  if (priorApps.length) ok(await admin.from(APPS).insert(priorApps));
  if (priorBookmarks.length) ok(await admin.from(BOOKMARKS).insert(priorBookmarks));
}
