import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';

const urlText = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;
if (!urlText || !anonKey || !serviceKey || !password) throw new Error('Set local SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and E2E_TEST_PASSWORD.');
assertLocalApiUrl(urlText);

const anon = createClient(urlText, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(urlText, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const login = async (email) => {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return { user: data.user, client: createClient(urlText, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } }) };
};
const studentEmail = 'e2e.student@caat.local.test';
const peerEmail = 'e2e.peer@caat.local.test';
const student = await login(studentEmail);
const peer = await login(peerEmail);
const studentClient = student.client;
const peerClient = peer.client;
const studentId = student.user.id;
const runId = randomUUID();
const ids = { essay: randomUUID(), document: randomUUID(), resume: randomUUID(), group: randomUUID() };
const ownedObjectPath = `${studentId}/staging/${runId}.pdf`;
const peerAttemptObjectPath = `${studentId}/staging/${runId}-peer.pdf`;
const pdfText = `%PDF-1.4\n% synthetic local RLS fixture ${runId}\n%%EOF`;
const assertNoError = (result) => { assert.ifError(result.error); return result.data; };

let previousFirstName;
try {
  const ownProfile = assertNoError(await studentClient.from('profiles').select('id,first_name').eq('id', studentId).single());
  assert.equal(ownProfile.id, studentId, 'student can read their own profile');
  previousFirstName = ownProfile.first_name;
  const ownProfileUpdate = assertNoError(await studentClient.from('profiles').update({ first_name: `E2E ${runId.slice(0, 8)}` }).eq('id', studentId).select('id,first_name').single());
  assert.equal(ownProfileUpdate.first_name, `E2E ${runId.slice(0, 8)}`, 'student can update their own profile');
  const hiddenProfile = assertNoError(await peerClient.from('profiles').select('id').eq('id', studentId));
  assert.deepEqual(hiddenProfile, [], 'peer cannot read student profile');
  const hiddenProfileUpdate = assertNoError(await peerClient.from('profiles').update({ first_name: 'Unauthorized RLS probe' }).eq('id', studentId).select('id'));
  assert.deepEqual(hiddenProfileUpdate, [], 'peer cannot update student profile');
  assert.equal(assertNoError(await admin.from('profiles').select('first_name').eq('id', studentId).single()).first_name, ownProfileUpdate.first_name, 'peer update attempt did not change persisted profile');

  const essay = assertNoError(await studentClient.from('essay_drafts').insert({
    id: ids.essay, user_id: studentId, prompt_id: 'e2000000-0000-4000-8000-000000000003',
    prompt_slug: 'e2e-community-reflection', content: `owner draft ${runId}`,
  }).select('id,user_id,content').single());
  assert.equal(essay.user_id, studentId, 'student can create an owned essay draft');
  assert.equal(assertNoError(await studentClient.from('essay_drafts').select('id').eq('id', ids.essay)).length, 1, 'student can read own essay draft');
  assert.deepEqual(assertNoError(await peerClient.from('essay_drafts').select('id').eq('id', ids.essay)), [], 'peer cannot read student essay draft');
  assert.deepEqual(assertNoError(await peerClient.from('essay_drafts').update({ content: 'unauthorized' }).eq('id', ids.essay).select('id')), [], 'peer cannot update student essay draft');
  assert.equal(assertNoError(await admin.from('essay_drafts').select('content').eq('id', ids.essay).single()).content, `owner draft ${runId}`, 'peer update attempt did not alter persisted essay content');
  const rejectedEssay = await peerClient.from('essay_drafts').insert({
    id: randomUUID(), user_id: studentId, prompt_id: 'e2000000-0000-4000-8000-000000000003',
    prompt_slug: 'e2e-community-reflection', content: 'spoofed owner',
  });
  assert.equal(rejectedEssay.error?.code, '42501', 'valid essay payload spoofed as student is rejected by RLS');

  const document = assertNoError(await studentClient.from('documents').insert({
    id: ids.document, user_id: studentId, file_name: 'e2e-proof.pdf', storage_path: `${studentId}/${runId}/e2e-proof.pdf`,
    category: 'transcripts', mime_type: 'application/pdf', file_size: 128,
  }).select('id,user_id,file_name').single());
  assert.equal(document.user_id, studentId, 'student can create an owned document row');
  assert.equal(assertNoError(await studentClient.from('documents').select('id').eq('id', ids.document)).length, 1, 'student can read own document row');
  assert.deepEqual(assertNoError(await peerClient.from('documents').select('id').eq('id', ids.document)), [], 'peer cannot read student document row');
  assert.deepEqual(assertNoError(await peerClient.from('documents').update({ file_name: 'unauthorized.pdf' }).eq('id', ids.document).select('id')), [], 'peer cannot update student document row');
  assert.equal(assertNoError(await admin.from('documents').select('file_name').eq('id', ids.document).single()).file_name, 'e2e-proof.pdf', 'peer update attempt did not alter persisted document');
  const rejectedDocument = await peerClient.from('documents').insert({
    user_id: studentId, file_name: 'spoof.pdf', storage_path: `${studentId}/${runId}/spoof.pdf`, category: 'transcripts',
  });
  assert.equal(rejectedDocument.error?.code, '42501', 'valid document payload spoofed as student is rejected by RLS');

  const ownUpload = assertNoError(await studentClient.storage.from('user-documents').upload(ownedObjectPath, new Blob([pdfText], { type: 'application/pdf' }), { contentType: 'application/pdf' }));
  assert.equal(ownUpload.path, ownedObjectPath, 'student can upload an object under their own prefix');
  const ownDownload = assertNoError(await studentClient.storage.from('user-documents').download(ownedObjectPath));
  assert.match(await ownDownload.text(), /synthetic local RLS fixture/, 'owner download returns the uploaded PDF contents');
  const peerDownload = await peerClient.storage.from('user-documents').download(ownedObjectPath);
  assert.ok(peerDownload.error && !peerDownload.data, 'peer cannot download the existing owner object');
  const peerSignedLink = await peerClient.storage.from('user-documents').createSignedUrl(ownedObjectPath, 60);
  assert.ok(peerSignedLink.error && !peerSignedLink.data?.signedUrl, 'peer cannot sign a link for the existing owner object');
  const peerUpload = await peerClient.storage.from('user-documents').upload(peerAttemptObjectPath, new Blob([pdfText], { type: 'application/pdf' }), { contentType: 'application/pdf' });
  assert.ok(peerUpload.error && !peerUpload.data, 'peer cannot upload into the student-owned storage prefix');

  const resume = assertNoError(await studentClient.from('resumes').insert({ id: ids.resume, user_id: studentId, title: `E2E resume ${runId}` }).select('id,user_id,title').single());
  assert.equal(resume.user_id, studentId, 'student can create an owned resume');
  assert.equal(assertNoError(await studentClient.from('resumes').select('id').eq('id', ids.resume)).length, 1, 'student can read own resume');
  assert.deepEqual(assertNoError(await peerClient.from('resumes').select('id').eq('id', ids.resume)), [], 'peer cannot read student resume');
  assert.deepEqual(assertNoError(await peerClient.from('resumes').update({ title: 'unauthorized' }).eq('id', ids.resume).select('id')), [], 'peer cannot update student resume');
  assert.equal(assertNoError(await admin.from('resumes').select('title').eq('id', ids.resume).single()).title, resume.title, 'peer update attempt did not alter persisted resume');
  const rejectedResume = await peerClient.from('resumes').insert({ user_id: studentId, title: 'Spoofed resume' });
  assert.equal(rejectedResume.error?.code, '42501', 'valid resume payload spoofed as student is rejected by RLS');

  const privateGroup = assertNoError(await studentClient.from('community_groups').insert({
    id: ids.group, slug: `e2e-private-${runId.slice(0, 12)}`, name: `E2E private ${runId.slice(0, 8)}`,
    creator_id: studentId, is_private: true,
  }).select('id,creator_id,is_private,name').single());
  assert.equal(privateGroup.creator_id, studentId, 'student can create a private group');
  assert.equal(assertNoError(await studentClient.from('community_groups').select('id').eq('id', ids.group)).length, 1, 'group creator can read private group');
  assert.deepEqual(assertNoError(await peerClient.from('community_groups').select('id').eq('id', ids.group)), [], 'peer cannot read private group');
  assert.deepEqual(assertNoError(await peerClient.from('community_groups').update({ name: 'unauthorized' }).eq('id', ids.group).select('id')), [], 'peer cannot update private group');
  assert.equal(assertNoError(await admin.from('community_groups').select('name').eq('id', ids.group).single()).name, privateGroup.name, 'peer update attempt did not alter private group');
  const rejectedGroup = await peerClient.from('community_groups').insert({
    slug: `e2e-spoof-${runId.slice(0, 12)}`, name: 'Spoofed group', creator_id: studentId, is_private: true,
  });
  assert.equal(rejectedGroup.error?.code, '42501', 'valid private group spoofed as student is rejected by RLS');

  const persisted = assertNoError(await admin.from('essay_drafts').select('content').eq('id', ids.essay).single());
  assert.equal(persisted.content, `owner draft ${runId}`, 'unauthorized updates did not alter persisted essay data');
  console.log('RLS smoke passed: own profile/essay/document/storage/resume/group access works; peer cross-user reads and writes are denied.');
} finally {
  if (previousFirstName !== undefined) await admin.from('profiles').update({ first_name: previousFirstName }).eq('id', studentId);
  await admin.from('community_groups').delete().eq('id', ids.group);
  await admin.from('essay_drafts').delete().eq('id', ids.essay);
  await admin.from('documents').delete().eq('id', ids.document);
  await admin.from('resumes').delete().eq('id', ids.resume);
  await admin.storage.from('user-documents').remove([ownedObjectPath, peerAttemptObjectPath]);
}
