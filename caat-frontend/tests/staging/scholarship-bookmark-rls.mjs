// PROD-150: saved-scholarship status changes on the isolated local stack only.
import assert from 'node:assert/strict';
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

const TABLE = 'user_bookmarked_scholarships';
const SCHOLARSHIP_ID = 'e2000000-0000-4000-8000-000000000002';
const owner = await login('e2e.student@caat.local.test');
const peer = await login('e2e.peer@caat.local.test');
const prior = ok(await admin.from(TABLE).select('*').in('user_id', [owner.id, peer.id]).eq('scholarship_id', SCHOLARSHIP_ID));
const persisted = async (userId) => ok(await admin.from(TABLE).select('status').eq('user_id', userId).eq('scholarship_id', SCHOLARSHIP_ID).maybeSingle())?.status;

try {
  ok(await admin.from(TABLE).delete().in('user_id', [owner.id, peer.id]).eq('scholarship_id', SCHOLARSHIP_ID));
  ok(await owner.client.from(TABLE).insert({ user_id: owner.id, scholarship_id: SCHOLARSHIP_ID, status: 'interested' }));

  const updated = ok(await owner.client.from(TABLE).update({ status: 'applied' }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP_ID).select('status'));
  assert.deepEqual(updated, [{ status: 'applied' }], 'owner can change the status of their own saved scholarship');
  const upserted = ok(await owner.client.from(TABLE).upsert({ user_id: owner.id, scholarship_id: SCHOLARSHIP_ID, status: 'awarded' }, { onConflict: 'user_id,scholarship_id' }).select('status'));
  assert.deepEqual(upserted, [{ status: 'awarded' }], 'owner can re-status an existing save through the upsert the app uses');
  assert.equal(await persisted(owner.id), 'awarded', 'owner status change persisted');

  const peerUpdate = await peer.client.from(TABLE).update({ status: 'not_selected' }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP_ID).select('status');
  assert.equal(peerUpdate.error, null, 'peer update of another student row leaks no error');
  assert.deepEqual(peerUpdate.data, [], 'peer update of another student row matches zero rows');
  const peerUpsert = await peer.client.from(TABLE).upsert({ user_id: owner.id, scholarship_id: SCHOLARSHIP_ID, status: 'not_selected' }, { onConflict: 'user_id,scholarship_id' });
  assert.equal(peerUpsert.error?.code, '42501', 'peer cannot rewrite another student row through an upsert');
  assert.equal(await persisted(owner.id), 'awarded', 'peer attempts did not change the owner row');

  const transfer = await owner.client.from(TABLE).update({ user_id: peer.id }).eq('user_id', owner.id).eq('scholarship_id', SCHOLARSHIP_ID);
  assert.equal(transfer.error?.code, '42501', 'owner cannot hand their row to another student');
  assert.equal(await persisted(peer.id), undefined, 'no row was moved to the peer');

  const anonUpdate = await anon.from(TABLE).update({ status: 'not_selected' }).eq('scholarship_id', SCHOLARSHIP_ID).select('status');
  assert.equal(anonUpdate.error?.code, '42501', 'anonymous visitors cannot update saved scholarships');
  assert.equal((await anon.from(TABLE).select('status')).error?.code, '42501', 'anonymous visitors cannot read saved scholarships');
  assert.equal(await persisted(owner.id), 'awarded', 'anonymous attempt did not change the owner row');

  // TRUNCATE, TRIGGER, REFERENCES (and MAINTAIN on PostgreSQL 17) are not reachable
  // through the API, so check the grants and a real TRUNCATE as each client role.
  const privileges = checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT r || ':' || string_agg(p, ',' ORDER BY p)
    FROM unnest(ARRAY['anon', 'authenticated']) AS r,
         unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES']
                || CASE WHEN current_setting('server_version_num')::int >= 170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) AS p
    WHERE has_table_privilege(r, 'public.${TABLE}', p)
    GROUP BY r ORDER BY r`]);
  assert.equal(privileges, 'authenticated:DELETE,INSERT,SELECT,UPDATE', 'only authenticated keeps exactly SELECT/INSERT/UPDATE/DELETE');
  for (const role of ['anon', 'authenticated']) {
    assert.throws(
      () => checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `BEGIN; SET LOCAL ROLE ${role}; TRUNCATE public.${TABLE}; ROLLBACK;`]),
      /permission denied/,
      `${role} cannot TRUNCATE saved scholarships`,
    );
  }
  assert.equal(await persisted(owner.id), 'awarded', 'TRUNCATE attempts left the owner row in place');
  console.log('Scholarship bookmark RLS passed: owner status changes, peer and anonymous updates denied, TRUNCATE/TRIGGER/REFERENCES revoked.');
} finally {
  ok(await admin.from(TABLE).delete().in('user_id', [owner.id, peer.id]).eq('scholarship_id', SCHOLARSHIP_ID));
  if (prior.length) ok(await admin.from(TABLE).insert(prior));
}
