// PROD-101: deleting a user through Supabase Auth (dashboard / admin API) must
// succeed when the user has community posts. Disposable local users only.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';

const apiUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;
if (!apiUrl || !anonKey || !serviceKey || !password) throw new Error('Local Supabase test settings are required.');
assertLocalApiUrl(apiUrl);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(apiUrl, serviceKey, options);
const tag = randomUUID().replaceAll('-', '').slice(0, 12);
const email = `e2e-admin-delete-${tag}@caat.local.test`;
const postId = randomUUID();
let userId = null;

try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  userId = created.data.user.id;
  assert.ifError((await admin.from('profiles').upsert({ id: userId, email, first_name: 'E2E', last_name: 'Admin delete' })).error);
  const session = await createClient(apiUrl, anonKey, options).auth.signInWithPassword({ email, password });
  assert.ifError(session.error);
  const student = createClient(apiUrl, anonKey, {
    ...options, global: { headers: { Authorization: `Bearer ${session.data.session.access_token}` } },
  });
  assert.ifError((await student.from('community_posts').insert({
    id: postId, user_id: userId, content: `E2E admin delete post ${tag}`, topic_tag: 'ADVICE',
  })).error);

  const deleted = await admin.auth.admin.deleteUser(userId);
  assert.ifError(deleted.error, 'Supabase Auth deletes a user who has community posts');
  userId = null;
  const leftover = await admin.from('community_posts').select('id').eq('id', postId);
  assert.ifError(leftover.error);
  assert.equal(leftover.data.length, 0, 'the deleted user\'s post is gone');
  console.log('Admin user deletion passed: 2 checks using a disposable local user.');
} finally {
  if (userId) {
    await admin.from('community_posts').delete().eq('id', postId);
    await admin.auth.admin.deleteUser(userId);
  }
}
