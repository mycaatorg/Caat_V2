// PROD-78 (documents slice): linking a library document to an application, on
// the isolated local stack only. Synthetic users and rows; restores prior state.
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

const LINKS = 'application_evidence_links';
const APPS = 'user_school_applications';
const DOCS = 'documents';
const SCHOOL = 900001;
const OTHER_SCHOOL = 900078;
const RUN = randomUUID().slice(0, 8);
const owner = await login('e2e.student@caat.local.test');
const peer = await login('e2e.peer@caat.local.test');
const users = [owner.id, peer.id];
const priorApps = ok(await admin.from(APPS).select('*').in('user_id', users).in('school_id', [SCHOOL, OTHER_SCHOOL]));
const priorLinks = ok(await admin.from(LINKS).select('*').in('user_id', users));
const docPath = (userId, name) => `${userId}/prod78-rls-${RUN}/${name}`;
const newDoc = async (who, name) => ok(await who.client.from(DOCS).insert({
  user_id: who.id, file_name: name, storage_path: docPath(who.id, name), category: 'transcripts', mime_type: 'application/pdf', file_size: 64,
}).select('id').single());
const linksFor = async (userId) => ok(await admin.from(LINKS).select('id, application_id, document_id, tailored_title, tailored_body, tailored_at').eq('user_id', userId));
const docExists = async (id) => ok(await admin.from(DOCS).select('id').eq('id', id)).length === 1;
let disposableId = null;

async function cleanup() {
  ok(await admin.from(LINKS).delete().in('user_id', users));
  ok(await admin.from(APPS).delete().in('user_id', users).in('school_id', [SCHOOL, OTHER_SCHOOL]));
  ok(await admin.from(DOCS).delete().in('user_id', users).like('storage_path', `%/prod78-rls-${RUN}/%`));
}

try {
  await cleanup();
  ok(await admin.from('schools').upsert({ id: OTHER_SCHOOL, name: 'Synthetic PROD-78 RLS University', country: 'Australia', institution_type: 'university' }));

  const appA = ok(await owner.client.from(APPS).insert({ user_id: owner.id, school_id: SCHOOL, status: 'researching' }).select('id').single());
  const appB = ok(await owner.client.from(APPS).insert({ user_id: owner.id, school_id: OTHER_SCHOOL, status: 'researching' }).select('id').single());
  const peerApp = ok(await peer.client.from(APPS).insert({ user_id: peer.id, school_id: SCHOOL, status: 'researching' }).select('id').single());
  const doc = await newDoc(owner, 'portfolio.pdf');
  const otherDoc = await newDoc(owner, 'reference.pdf');
  const peerDoc = await newDoc(peer, 'peer.pdf');

  // Owner links a library document to their own application.
  const link = ok(await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', document_id: doc.id }).select('id, kind, document_id, evidence_item_id, tailored_title, tailored_body, tailored_at').single());
  assert.deepEqual({ ...link, id: undefined }, { id: undefined, kind: 'document', document_id: doc.id, evidence_item_id: null, tailored_title: null, tailored_body: null, tailored_at: null }, 'owner links a document, following the library');
  assert.equal((await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', document_id: doc.id })).error?.code, '23505', 'the same document links once per application');
  ok(await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appB.id, kind: 'document', document_id: doc.id }));
  assert.equal((await linksFor(owner.id)).length, 2, 'one document can be linked to several applications');

  // Shape and ownership are enforced by the database.
  assert.equal((await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', document_id: otherDoc.id, tailored_title: 'pre-tailored' })).error?.code, '42501', 'a new link cannot arrive tailored');
  assert.equal((await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', document_id: peerDoc.id })).error?.code, '23503', "owner cannot link the peer's document");
  assert.equal((await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: peerApp.id, kind: 'document', document_id: otherDoc.id })).error?.code, '23503', "owner cannot link to the peer's application");
  assert.equal((await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', document_id: null })).error?.code, '23514', 'a link needs exactly one source');
  assert.equal((await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'activity', document_id: otherDoc.id })).error?.code, '23514', 'only document links exist in this slice');
  assert.equal((await owner.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', evidence_item_id: randomUUID() })).error?.code, '42501', 'evidence items cannot be linked yet');

  // Tailoring writes only the link's tailored_* columns.
  const tailoredAt = new Date().toISOString();
  const tailored = ok(await owner.client.from(LINKS).update({ tailored_title: 'Supplementary portfolio', tailored_body: 'Submit with the arts form', tailored_at: tailoredAt }).eq('id', link.id).eq('user_id', owner.id).select('tailored_title, tailored_body'));
  assert.deepEqual(tailored, [{ tailored_title: 'Supplementary portfolio', tailored_body: 'Submit with the arts form' }], 'owner tailors the link');
  const skewed = ok(await owner.client.from(LINKS).update({ tailored_at: '1900-01-01T00:00:00.000Z' }).eq('id', link.id).select('tailored_at').single());
  assert.ok(Date.parse(skewed.tailored_at) > Date.parse('2020-01-01'), 'tailoring uses a server revision even when the client clock is wrong');
  assert.ok(ok(await owner.client.from(LINKS).update({ tailored_at: null }).eq('id', link.id).select('tailored_at').single()).tailored_at, 'server retains a revision while tailored text exists');
  assert.equal((await owner.client.from(LINKS).update({ tailored_title: ' ' }).eq('id', link.id).select('id')).error?.code, '23514', 'a blank tailored title is refused');
  assert.equal((await owner.client.from(LINKS).update({ application_id: appB.id }).eq('id', link.id).select('id')).error?.code, '42501', 'a link cannot be re-pointed to another application');
  assert.equal((await owner.client.from(LINKS).update({ document_id: otherDoc.id }).eq('id', link.id).select('id')).error?.code, '42501', 'a link cannot be re-pointed to another document');
  assert.equal((await owner.client.from(LINKS).update({ user_id: peer.id }).eq('id', link.id).select('id')).error?.code, '42501', 'a link cannot be handed to another student');
  assert.equal(ok(await admin.from(DOCS).select('file_name').eq('id', doc.id).single()).file_name, 'portfolio.pdf', 'tailoring never touched the document');

  // Peer and anonymous visitors cannot read, link, tailor or unlink.
  assert.deepEqual(ok(await peer.client.from(LINKS).select('id').eq('user_id', owner.id)), [], 'peer cannot read owner links');
  assert.equal((await peer.client.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', document_id: otherDoc.id })).error?.code, '42501', 'peer cannot link for the owner');
  assert.equal((await peer.client.from(LINKS).insert({ user_id: peer.id, application_id: appA.id, kind: 'document', document_id: peerDoc.id })).error?.code, '23503', "peer cannot link into the owner's application");
  assert.equal((await peer.client.from(LINKS).insert({ user_id: peer.id, application_id: peerApp.id, kind: 'document', document_id: otherDoc.id })).error?.code, '23503', "peer cannot link the owner's document");
  assert.deepEqual(ok(await peer.client.from(LINKS).update({ tailored_title: 'hijack', tailored_at: new Date().toISOString() }).eq('id', link.id).select('id')), [], 'peer cannot tailor owner links');
  assert.deepEqual(ok(await peer.client.from(LINKS).delete().eq('id', link.id).select('id')), [], 'peer cannot unlink owner links');
  assert.equal((await anon.from(LINKS).select('id')).error?.code, '42501', 'anonymous visitors cannot read links');
  assert.equal((await anon.from(LINKS).insert({ user_id: owner.id, application_id: appA.id, kind: 'document', document_id: otherDoc.id })).error?.code, '42501', 'anonymous visitors cannot link');
  const afterPeer = (await linksFor(owner.id)).find((l) => l.id === link.id);
  assert.equal(afterPeer.tailored_title, 'Supplementary portfolio', 'cross-user attempts left the tailoring unchanged');

  const privileges = checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT r || ':' || string_agg(p, ',' ORDER BY p)
    FROM unnest(ARRAY['anon', 'authenticated']) AS r,
         unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES']
                || CASE WHEN current_setting('server_version_num')::int >= 170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END) AS p
    WHERE has_table_privilege(r, 'public.${LINKS}', p)
    GROUP BY r ORDER BY r`]);
  assert.equal(privileges, 'authenticated:DELETE,SELECT', 'table-wide, authenticated keeps only SELECT and DELETE; anon keeps nothing');
  const columns = checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
    SELECT p || ':' || string_agg(attname, ',' ORDER BY attname)
    FROM pg_attribute, unnest(ARRAY['INSERT', 'UPDATE']) AS p
    WHERE attrelid = 'public.${LINKS}'::regclass AND attnum > 0 AND NOT attisdropped
      AND has_column_privilege('authenticated', 'public.${LINKS}', attname, p)
    GROUP BY p ORDER BY p`]);
  assert.equal(columns, 'INSERT:application_id,document_id,kind,user_id\nUPDATE:source_uploaded_at,tailored_at,tailored_body,tailored_title', 'clients insert the link and update only its tailored_* columns');

  // A still-linked document cannot be deleted; unlinking never deletes it.
  assert.equal((await owner.client.from(DOCS).delete().eq('id', doc.id).eq('user_id', owner.id)).error?.code, '23503', 'deleting a still-linked document is refused');
  assert.ok(await docExists(doc.id), 'the refused delete left the document');
  assert.deepEqual(ok(await owner.client.from(LINKS).delete().eq('id', link.id).eq('user_id', owner.id).select('id')), [{ id: link.id }], 'owner unlinks');
  assert.ok(await docExists(doc.id), 'unlinking kept the document');

  // Deleting an application removes its links, never the document.
  assert.equal((await linksFor(owner.id)).length, 1, 'the other application keeps its link');
  ok(await owner.client.from(APPS).delete().eq('id', appB.id).eq('user_id', owner.id));
  assert.deepEqual(await linksFor(owner.id), [], 'deleting the application removes its links');
  assert.ok(await docExists(doc.id), 'deleting the application kept the document');
  ok(await owner.client.from(DOCS).delete().eq('id', doc.id).eq('user_id', owner.id));
  assert.ok(!(await docExists(doc.id)), 'an unlinked document deletes normally');

  // Account deletion still works with linked documents.
  const email = `e2e.prod78.${RUN}@caat.local.test`;
  const created = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  disposableId = created.user.id;
  const disposable = await login(email);
  const dApp = ok(await disposable.client.from(APPS).insert({ user_id: disposable.id, school_id: SCHOOL, status: 'researching' }).select('id').single());
  const dDoc = await newDoc(disposable, 'mine.pdf');
  ok(await disposable.client.from(LINKS).insert({ user_id: disposable.id, application_id: dApp.id, kind: 'document', document_id: dDoc.id }));
  ok(await disposable.client.rpc('delete_own_account'));
  disposableId = null;
  for (const table of [APPS, DOCS, LINKS]) {
    assert.deepEqual(ok(await admin.from(table).select('user_id').eq('user_id', disposable.id)), [], `account deletion removes ${table}`);
  }
  assert.equal(ok(await admin.auth.admin.listUsers({ perPage: 1000 })).users.some((u) => u.id === disposable.id), false, 'account deletion removes the auth user');
  console.log('Evidence link RLS passed: owner link/tailor/unlink, peer and anonymous denied, no re-pointing, tailored_* only updates, cascade on application delete, linked documents protected, account deletion intact.');
} finally {
  if (disposableId) {
    await admin.from(LINKS).delete().eq('user_id', disposableId);
    await admin.from(APPS).delete().eq('user_id', disposableId);
    await admin.from(DOCS).delete().eq('user_id', disposableId);
    await admin.auth.admin.deleteUser(disposableId);
  }
  await cleanup();
  ok(await admin.from('schools').delete().eq('id', OTHER_SCHOOL));
  if (priorApps.length) ok(await admin.from(APPS).upsert(priorApps));
  if (priorLinks.length) ok(await admin.from(LINKS).insert(priorLinks));
}
