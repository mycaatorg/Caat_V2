// PROD-94: a student must not be able to verify their own documents through
// the API. Runs only against the disposable loopback stack with synthetic
// users; every row it creates is removed.
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
const signIn = createClient(apiUrl, anonKey, options);
const { data: session, error: signInError } = await signIn.auth.signInWithPassword({ email: 'e2e.student@caat.local.test', password });
assert.ifError(signInError);
const student = createClient(apiUrl, anonKey, { ...options, global: { headers: { Authorization: `Bearer ${session.session.access_token}` } } });
const uid = session.user.id;

const tag = randomUUID();
const ids = { a: randomUUID(), b: randomUUID() };
const row = (id, extra = {}) => ({
  id, user_id: uid, file_name: `status-${tag}.pdf`, storage_path: `${uid}/transcripts/status-${tag}-${id}.pdf`,
  category: 'transcripts', mime_type: 'application/pdf', file_size: 10, ...extra,
});
const statusOf = async (id) => (await admin.from('documents').select('status, review_notes').eq('id', id).single()).data;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };

try {
  // A student cannot create a document that claims to be verified.
  const created = await student.from('documents').insert(row(ids.a, { status: 'verified', review_notes: 'Looks good' })).select('status, review_notes').single();
  check(created.error || (created.data.status === 'pending_review' && created.data.review_notes === null), 'insert cannot self-verify');
  if (created.error) assert.fail(`insert of an ordinary document must still work: ${created.error.message}`);
  check((await statusOf(ids.a)).status === 'pending_review', 'stored status is pending review');

  // A student cannot mark their own document verified or write review notes.
  const verify = await student.from('documents').update({ status: 'verified' }).eq('id', ids.a).select('status');
  check(Boolean(verify.error), 'update to verified is refused');
  const notes = await student.from('documents').update({ review_notes: 'approved by me' }).eq('id', ids.a).select('id');
  check(Boolean(notes.error), 'update of review notes is refused');
  check((await statusOf(ids.a)).status === 'pending_review', 'status unchanged after refused writes');

  // A reviewer (service role) can verify, and ask for a resubmission.
  assert.ifError((await admin.from('documents').update({ status: 'resubmit', review_notes: 'Please upload a clearer scan' }).eq('id', ids.a)).error);
  check((await statusOf(ids.a)).status === 'resubmit', 'reviewer sets resubmit');

  // The student's replace flow resets the document to pending review.
  const replaced = await student.from('documents').update({
    file_name: `status-${tag}-v2.pdf`, storage_path: `${uid}/transcripts/status-${tag}-v2.pdf`,
    status: 'pending_review', uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', ids.a).select('status').single();
  assert.ifError(replaced.error);
  check(replaced.data.status === 'pending_review', 'replace resets to pending review');
  check((await statusOf(ids.a)).review_notes === 'Please upload a clearer scan', 'reviewer notes survive a replace');

  // Other student edits keep working.
  const renamed = await student.from('documents').update({ school_id: null, updated_at: new Date().toISOString() }).eq('id', ids.a).select('id');
  check(!renamed.error && renamed.data.length === 1, 'ordinary metadata update still works');

  assert.ifError((await admin.from('documents').update({ status: 'verified' }).eq('id', ids.a)).error);
  check((await statusOf(ids.a)).status === 'verified', 'reviewer verifies');
  console.log(`Document status integrity passed: ${checks} checks.`);
} finally {
  await admin.from('documents').delete().in('id', Object.values(ids));
}
