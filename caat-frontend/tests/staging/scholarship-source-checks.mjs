// PROD-143 isolated-stack check: scholarship_source_checks is service-role only,
// and the refresh runner keeps its rules on real rows. Local loopback Supabase only.
// Fetch is stubbed; nothing leaves the machine. Creates synthetic rows and removes them.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';
import { checkLocalPsql, localDatabaseUrl, runLocalPsql } from './local-db.mjs';
import { createSupabaseStore, runRefresh } from '../../scripts/refresh-scholarship-sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error('Local isolated Supabase settings are required.');
assertLocalApiUrl(url);

// Apply the migration on an existing disposable stack that predates it. Fresh
// bootstrap already applies it, so this only runs when the table is missing.
const dbUrl = localDatabaseUrl();
const sql = (query) => checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query]);
if (sql("SELECT to_regclass('public.scholarship_source_checks') IS NULL") === 't') {
  runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261024090000_scholarship_source_checks.sql')]);
  console.log('Applied 20261024090000_scholarship_source_checks.sql to the local stack.');
}
const validated = sql("SELECT convalidated FROM pg_constraint WHERE conname = 'scholarships_last_verified_not_future'");
assert.ok(validated === 't' || validated === 'f', 'future-date CHECK exists');

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anon = createClient(url, anonKey, options);
const admin = createClient(url, serviceKey, options);
const ok = (result) => { assert.ifError(result.error); return result.data; };
const key = randomUUID().slice(0, 8);
// A throwaway signed-in student, removed at the end, so the check needs no shared password.
const email = `source-check-${key}@caat.local.test`;
const password = `${randomUUID()}-Aa1`;
const createdUser = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
const student = createClient(url, anonKey, options);
ok(await student.auth.signInWithPassword({ email, password }));

const base = `https://source-check-${key}.invalid`;
const pageUrl = (path) => `${base}/${path}`;
const OLD = '2026-01-01T00:00:00+00:00';
const fixtures = [
  { name: 'same-a', external_url: `${pageUrl('same')}#award-a` },
  { name: 'same-b', external_url: `${pageUrl('same')}#award-b`, last_verified_at: null },
  { name: 'changes', external_url: pageUrl('changes') },
  { name: 'gone', external_url: pageUrl('gone') },
  { name: 'down', external_url: pageUrl('down') },
].map(({ name, ...f }) => ({
  title: `Source check ${name}`, provider_name: 'Synthetic provider', slug: `source-check-${key}-${name}`,
  external_id: `source-check-${key}-${name}`, is_active: true, last_verified_at: OLD, source_last_synced_at: OLD,
  raw_payload: { extracted: name }, ...f,
}));
const runIds = [];
const html = (main, chrome) => `<html><body><nav>${chrome}</nav><main>${main}</main><footer>${chrome}</footer></body></html>`;
const stub = (pages) => async (target) => {
  const hit = pages[target];
  if (!hit) throw new Error(`unexpected fetch ${target}`);
  if (hit instanceof Error) throw hit;
  return new Response(hit.body ?? '', { status: hit.status, headers: { 'content-type': 'text/html' } });
};
const columns = 'slug,is_active,last_verified_at,source_last_synced_at,raw_payload,title,description';
const rowsBySlug = async () => {
  const rows = ok(await admin.from('scholarships').select(columns).like('external_id', `source-check-${key}-%`));
  assert.equal(rows.length, fixtures.length, 'all synthetic rows are present');
  return Object.fromEntries(rows.map((r) => [r.slug.replace(`source-check-${key}-`, ''), r]));
};
const checksFor = async (runId) => ok(await admin.from('scholarship_source_checks').select('*').eq('run_id', runId));
const refresh = (pages, apply) => runRefresh({ store: createSupabaseStore(admin), fetchImpl: stub(pages), apply, urlPrefix: base, concurrency: 2, timeoutMs: 2000, log: () => {} });

try {
  // Students and visitors get nothing from the new table.
  for (const [who, client] of [['anon', anon], ['authenticated', student]]) {
    assert.ok((await client.from('scholarship_source_checks').select('id').limit(1)).error, `${who} cannot read source checks`);
    const run = ok(await admin.from('scholarship_import_runs').insert({ status: 'started' }).select('id').single());
    runIds.push(run.id);
    assert.ok((await client.from('scholarship_source_checks').insert({ run_id: run.id, url: pageUrl('x'), outcome: 'unchanged' })).error, `${who} cannot write source checks`);
    assert.ok((await client.from('scholarship_source_checks').update({ outcome: 'gone' }).eq('run_id', run.id)).error, `${who} cannot update source checks`);
  }
  assert.equal((await admin.from('scholarships').update({ last_verified_at: '2999-01-01T00:00:00Z' }).eq('slug', 'e2e-test-scholarship')).error?.code, '23514', 'a future last_verified_at is rejected');

  ok(await admin.from('scholarships').insert(fixtures));
  const before = await rowsBySlug();

  // Dry run reads and fetches only.
  const runsBefore = ok(await admin.from('scholarship_import_runs').select('id', { count: 'exact' })).length;
  const dry = await refresh({ [pageUrl('same')]: { status: 200, body: html('Award $5,000', 'v1') }, [pageUrl('changes')]: { status: 200, body: html('Closes 1 March', 'v1') }, [pageUrl('gone')]: { status: 404 }, [pageUrl('down')]: new Error('ECONNRESET') }, false);
  assert.equal(dry.urls, 4, 'fragments collapse to one url');
  assert.deepEqual(dry.counts, { baseline: 2, unchanged: 0, changed: 0, unreachable: 2, gone: 0 });
  assert.equal(ok(await admin.from('scholarship_import_runs').select('id')).length, runsBefore, 'dry run writes no run row');
  assert.equal(ok(await admin.from('scholarship_source_checks').select('id').like('url', `${base}%`)).length, 0, 'dry run writes no checks');
  assert.deepEqual(await rowsBySlug(), before, 'dry run leaves scholarships untouched');

  // Run 1: baselines, first 404 strike, network error. Nothing on scholarships moves.
  const first = await refresh({ [pageUrl('same')]: { status: 200, body: html('Award $5,000', 'v1') }, [pageUrl('changes')]: { status: 200, body: html('Closes 1 March', 'v1') }, [pageUrl('gone')]: { status: 404 }, [pageUrl('down')]: new Error('ECONNRESET') }, true);
  runIds.push(first.runId);
  const firstChecks = await checksFor(first.runId);
  assert.equal(firstChecks.length, 4, 'one check per distinct url');
  assert.deepEqual(Object.fromEntries(firstChecks.map((c) => [c.url, c.outcome])), { [pageUrl('same')]: 'baseline', [pageUrl('changes')]: 'baseline', [pageUrl('gone')]: 'unreachable', [pageUrl('down')]: 'unreachable' });
  assert.deepEqual(await rowsBySlug(), before, 'baseline and unreachable write nothing to scholarships');

  // Run 2: same content under new chrome, a content change, a second 410, a 503.
  const second = await refresh({ [pageUrl('same')]: { status: 200, body: html('Award   $5,000', 'redesigned v2') }, [pageUrl('changes')]: { status: 200, body: html('Closes 2 March', 'v1') }, [pageUrl('gone')]: { status: 410 }, [pageUrl('down')]: { status: 503 } }, true);
  runIds.push(second.runId);
  const checks = Object.fromEntries((await checksFor(second.runId)).map((c) => [c.url, c]));
  assert.deepEqual(Object.fromEntries(Object.entries(checks).map(([u, c]) => [u, c.outcome])), { [pageUrl('same')]: 'unchanged', [pageUrl('changes')]: 'changed', [pageUrl('gone')]: 'gone', [pageUrl('down')]: 'unreachable' });
  const after = await rowsBySlug();
  const at = (u) => Date.parse(checks[u].checked_at);
  for (const slug of ['same-a', 'same-b']) {
    assert.equal(Date.parse(after[slug].last_verified_at), at(pageUrl('same')), `${slug} last_verified_at is the unchanged check's checked_at`);
    assert.equal(after[slug].source_last_synced_at, before[slug].source_last_synced_at, `${slug} import date untouched`);
  }
  assert.ok(Date.parse(after['same-a'].last_verified_at) <= Date.now(), 'verification date is not in the future');
  assert.equal(after.changes.last_verified_at, before.changes.last_verified_at, 'changed page does not advance verification');
  assert.equal(Date.parse(after.changes.source_last_synced_at), at(pageUrl('changes')), 'changed sets source_last_synced_at');
  assert.equal(after.gone.is_active, false, 'two not-found strikes deactivate');
  assert.equal(after.gone.raw_payload.extracted, 'gone', 'raw_payload keeps extracted fields');
  assert.equal(after.gone.raw_payload.source_check.http_status, 410, 'raw_payload records why');
  assert.equal(after.gone.last_verified_at, before.gone.last_verified_at, 'gone does not verify');
  assert.deepEqual(after.down, before.down, 'unreachable leaves the row alone');
  for (const slug of Object.keys(before)) {
    assert.equal(after[slug].title, before[slug].title, 'extracted fields untouched');
    assert.equal(after[slug].description, before[slug].description, 'extracted fields untouched');
  }
  const run = ok(await admin.from('scholarship_import_runs').select('*').eq('id', second.runId).single());
  assert.equal(run.status, 'succeeded');
  assert.equal(run.records_seen, 4);
  assert.equal(run.records_updated, 4, 'two verified, one synced, one deactivated');
  assert.deepEqual(run.check_counts, { baseline: 0, unchanged: 1, changed: 1, unreachable: 1, gone: 1 });

  // Run 3: the changed page is still compared against the accepted hash, so it stays changed.
  const third = await refresh({ [pageUrl('same')]: { status: 200, body: html('Award $5,000', 'v3') }, [pageUrl('changes')]: { status: 200, body: html('Closes 2 March', 'v1') }, [pageUrl('down')]: { status: 503 } }, true);
  runIds.push(third.runId);
  assert.equal(third.urls, 3, 'inactive (gone) rows are no longer checked');
  assert.equal(third.counts.changed, 1, 'a changed page cannot drift back to unchanged without re-extraction');
  assert.equal((await rowsBySlug()).changes.last_verified_at, before.changes.last_verified_at);

  console.log(`Scholarship source checks passed: service-role-only table, future-date CHECK (${validated === 't' ? 'validated' : 'NOT VALID'}), dry run writes nothing, baseline/unchanged/changed/unreachable/gone rules on real rows.`);
} finally {
  if (runIds.length) ok(await admin.from('scholarship_import_runs').delete().in('id', runIds));
  ok(await admin.from('scholarships').delete().like('external_id', `source-check-${key}-%`));
  await student.auth.signOut();
  ok(await admin.auth.admin.deleteUser(createdUser.id));
}
