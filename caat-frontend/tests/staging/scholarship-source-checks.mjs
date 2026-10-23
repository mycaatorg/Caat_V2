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
assert.equal(sql("SELECT convalidated FROM pg_constraint WHERE conname = 'scholarships_last_verified_not_future'"), 't', 'future-date CHECK is validated');
assert.equal(sql("SELECT confdeltype FROM pg_constraint WHERE conname = 'scholarship_source_checks_run_id_fkey'"), 'r', 'runs with checks cannot be deleted');
assert.equal(sql("SELECT p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid WHERE t.tgname = 'trg_scholarships_updated_at'"), 'scholarships_set_updated_at', 'scholarships use the freshness-aware updated_at trigger');

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

const base = `https://source-check-${key}.invalid`;
const pageUrl = (path) => `${base}/${path}`;
const OLD = '2026-01-01T00:00:00+00:00';
const fixtures = [
  { name: 'same-a', external_url: `${pageUrl('same')}#award-a` },
  { name: 'same-b', external_url: `${pageUrl('same')}#award-b`, last_verified_at: null },
  { name: 'changes', external_url: pageUrl('changes') },
  { name: 'gone', external_url: pageUrl('gone') },
  { name: 'down', external_url: pageUrl('down') },
  { name: 'future-probe', external_url: null },
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
const columns = 'slug,is_active,last_verified_at,source_last_synced_at,raw_payload,title,description,updated_at';
const rowsBySlug = async () => {
  const rows = ok(await admin.from('scholarships').select(columns).like('external_id', `source-check-${key}-%`));
  assert.equal(rows.length, fixtures.length, 'all synthetic rows are present');
  return Object.fromEntries(rows.map((r) => [r.slug.replace(`source-check-${key}-`, ''), r]));
};
const checksFor = async (runId) => ok(await admin.from('scholarship_source_checks').select('*').eq('run_id', runId));
const outcomesFor = async (runId) => Object.fromEntries((await checksFor(runId)).map((c) => [c.url.replace(`${base}/`, ''), c.outcome]));
const refresh = async (pages, apply) => {
  const summary = await runRefresh({ store: createSupabaseStore(admin), fetchImpl: stub(pages), apply, urlPrefix: base, concurrency: 2, timeoutMs: 2000, log: () => {} });
  if (apply) runIds.push(summary.runId);
  return summary;
};
const same = (chrome) => ({ status: 200, body: html('Award $5,000', chrome) });

try {
  ok(await student.auth.signInWithPassword({ email, password }));
  ok(await admin.from('scholarships').insert(fixtures));

  // Students and visitors get nothing from the new table.
  const probeRun = ok(await admin.from('scholarship_import_runs').insert({ status: 'started' }).select('id').single());
  runIds.push(probeRun.id);
  for (const [who, client] of [['anon', anon], ['authenticated', student]]) {
    assert.ok((await client.from('scholarship_source_checks').select('id').limit(1)).error, `${who} cannot read source checks`);
    assert.ok((await client.from('scholarship_source_checks').insert({ run_id: probeRun.id, url: pageUrl('x'), outcome: 'unchanged' })).error, `${who} cannot write source checks`);
    assert.ok((await client.from('scholarship_source_checks').update({ outcome: 'gone' }).eq('run_id', probeRun.id)).error, `${who} cannot update source checks`);
  }
  ok(await admin.from('scholarship_import_runs').update({ status: 'failed', finished_at: new Date().toISOString(), error_message: 'RLS probe' }).eq('id', probeRun.id));
  assert.equal((await admin.from('scholarships').update({ last_verified_at: '2999-01-01T00:00:00Z' }).eq('slug', `source-check-${key}-future-probe`)).error?.code, '23514', 'a future last_verified_at is rejected');

  const before = await rowsBySlug();

  // Dry run reads and fetches only.
  const runsBefore = ok(await admin.from('scholarship_import_runs').select('id')).length;
  const firstPages = { [pageUrl('same')]: same('v1'), [pageUrl('changes')]: { status: 200, body: html('Closes 1 March', 'v1') }, [pageUrl('gone')]: { status: 404 }, [pageUrl('down')]: new Error('ECONNRESET') };
  const dry = await refresh(firstPages, false);
  assert.equal(dry.urls, 4, 'fragments collapse to one url');
  assert.deepEqual(dry.counts, { baseline: 2, unchanged: 0, changed: 0, unreachable: 2, gone: 0 });
  assert.equal(ok(await admin.from('scholarship_import_runs').select('id')).length, runsBefore, 'dry run writes no run row');
  assert.equal(ok(await admin.from('scholarship_source_checks').select('id').like('url', `${base}%`)).length, 0, 'dry run writes no checks');
  assert.deepEqual(await rowsBySlug(), before, 'dry run leaves scholarships untouched');

  // Run 1: baselines, first 404 strike, network error. Nothing on scholarships moves.
  const first = await refresh(firstPages, true);
  assert.equal((await checksFor(first.runId)).length, 4, 'one check per distinct url');
  assert.deepEqual(await outcomesFor(first.runId), { same: 'baseline', changes: 'baseline', gone: 'unreachable', down: 'unreachable' });
  assert.deepEqual(await rowsBySlug(), before, 'baseline and unreachable write nothing to scholarships');

  // A second 404 within 24 h is not yet gone.
  const quick = await refresh({ [pageUrl('gone')]: { status: 404 }, [pageUrl('same')]: same('v1'), [pageUrl('changes')]: { status: 200, body: html('Closes 1 March', 'v1') }, [pageUrl('down')]: { status: 503 } }, true);
  assert.equal((await outcomesFor(quick.runId)).gone, 'unreachable', 'two strikes inside 24 h are not gone');
  // Age every stored check of this fixture by 25 h, as if the runs were a day apart.
  for (const id of [first.runId, quick.runId]) {
    for (const check of await checksFor(id)) {
      ok(await admin.from('scholarship_source_checks').update({ checked_at: new Date(Date.parse(check.checked_at) - 25 * 60 * 60 * 1000).toISOString() }).eq('id', check.id));
    }
  }
  const afterQuick = await rowsBySlug();
  for (const slug of ['same-a', 'same-b']) assert.equal(Date.parse(afterQuick[slug].updated_at), Date.parse(before[slug].updated_at), `${slug} updated_at untouched by verification`);

  // Run 2: same content under new chrome, a content change, a second 410 a day later, a 503.
  const second = await refresh({ [pageUrl('same')]: { status: 200, body: html('Award   $5,000', 'redesigned v2') }, [pageUrl('changes')]: { status: 200, body: html('Closes 2 March', 'v1') }, [pageUrl('gone')]: { status: 410 }, [pageUrl('down')]: { status: 503 } }, true);
  assert.deepEqual(await outcomesFor(second.runId), { same: 'unchanged', changes: 'changed', gone: 'gone', down: 'unreachable' });
  const checks = Object.fromEntries((await checksFor(second.runId)).map((c) => [c.url, c]));
  const after = await rowsBySlug();
  for (const slug of ['same-a', 'same-b']) {
    assert.equal(Date.parse(after[slug].last_verified_at), Date.parse(checks[pageUrl('same')].checked_at), `${slug} last_verified_at is the unchanged check's checked_at`);
    assert.equal(after[slug].source_last_synced_at, before[slug].source_last_synced_at, `${slug} import date untouched`);
    assert.equal(Date.parse(after[slug].updated_at), Date.parse(before[slug].updated_at), `${slug} updated_at (sitemap lastModified) unchanged by verification`);
  }
  assert.ok(Date.parse(after['same-a'].last_verified_at) <= Date.now(), 'verification date is not in the future');
  assert.deepEqual(after.changes, afterQuick.changes, 'changed writes nothing to scholarships');
  assert.equal(after.gone.is_active, false, 'two not-found strikes a day apart deactivate');
  assert.equal(after.gone.raw_payload.extracted, 'gone', 'raw_payload keeps extracted fields');
  assert.equal(after.gone.raw_payload.source_check.http_status, 410, 'raw_payload records why');
  assert.equal(after.gone.last_verified_at, before.gone.last_verified_at, 'gone does not verify');
  assert.ok(Date.parse(after.gone.updated_at) > Date.parse(before.gone.updated_at), 'deactivation is a real change and bumps updated_at');
  assert.deepEqual(after.down, before.down, 'unreachable leaves the row alone');
  for (const slug of Object.keys(before)) assert.equal(after[slug].title, before[slug].title, 'extracted fields untouched');
  const run = ok(await admin.from('scholarship_import_runs').select('*').eq('id', second.runId).single());
  assert.equal(run.status, 'succeeded');
  assert.equal(run.records_seen, 4);
  assert.equal(run.records_updated, 3, 'two verified, one deactivated');
  assert.deepEqual(run.check_counts, { baseline: 0, unchanged: 1, changed: 1, unreachable: 1, gone: 1 });

  // Run 3: the changed page is still compared against the accepted hash, so it stays changed.
  const changedPages = { [pageUrl('same')]: same('v3'), [pageUrl('changes')]: { status: 200, body: html('Closes 2 March', 'v1') }, [pageUrl('down')]: { status: 503 } };
  const third = await refresh(changedPages, true);
  assert.equal(third.urls, 3, 'inactive (gone) rows are no longer checked');
  assert.equal(third.counts.changed, 1, 'a changed page cannot drift back to unchanged without a re-import');
  assert.deepEqual((await rowsBySlug()).changes, afterQuick.changes);

  // A re-import (source_last_synced_at after the reference check) re-baselines, then verification resumes.
  ok(await admin.from('scholarships').update({ source_last_synced_at: new Date().toISOString() }).eq('slug', `source-check-${key}-changes`));
  const fourth = await refresh(changedPages, true);
  assert.equal((await outcomesFor(fourth.runId)).changes, 'baseline', 're-import re-baselines');
  const fifth = await refresh(changedPages, true);
  assert.equal((await outcomesFor(fifth.runId)).changes, 'unchanged');
  const fifthCheck = (await checksFor(fifth.runId)).find((c) => c.url === pageUrl('changes'));
  assert.equal(Date.parse((await rowsBySlug()).changes.last_verified_at), Date.parse(fifthCheck.checked_at), 're-baselined page verifies on the next unchanged check');

  console.log('Scholarship source checks passed: service-role-only table, validated future-date CHECK, RESTRICT run FK, updated_at kept on verification, dry run writes nothing, baseline/unchanged/changed/unreachable/gone (24 h gap) and re-baseline rules on real rows.');
} finally {
  // Each cleanup step runs even if an earlier one fails; errors are reported together.
  const failures = [];
  const step = async (what, fn) => { try { const r = await fn(); if (r?.error) throw r.error; } catch (err) { failures.push(`${what}: ${err?.message ?? err}`); } };
  if (runIds.length) {
    await step('delete checks', () => admin.from('scholarship_source_checks').delete().in('run_id', runIds));
    await step('delete runs', () => admin.from('scholarship_import_runs').delete().in('id', runIds));
  }
  await step('delete scholarships', () => admin.from('scholarships').delete().like('external_id', `source-check-${key}-%`));
  await step('sign out', () => student.auth.signOut());
  await step('delete user', () => admin.auth.admin.deleteUser(createdUser.id));
  if (failures.length) {
    process.exitCode = 1;
    console.error(`Cleanup incomplete:\n${failures.join('\n')}`);
  }
}
