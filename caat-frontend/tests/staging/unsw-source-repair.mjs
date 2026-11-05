// PROD-244: apply the actual data migration only to disposable loopback fixtures.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';
import { localDatabaseUrl, checkLocalPsql } from './local-db.mjs';

assertLocalApiUrl(process.env.SUPABASE_URL);
const db = localDatabaseUrl();
const here = dirname(fileURLToPath(import.meta.url));
const migration = join(here, '../../supabase/migrations/20261106020000_unsw_source_repair.sql');
readFileSync(migration); // Missing implementation fails before any fixture writes.
const { repairs, duplicate } = JSON.parse(readFileSync(join(here, 'fixtures/unsw-source-repair.json'), 'utf8'));
assert.equal(repairs.length, 17);
const sql = query => checkLocalPsql(db, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query]);
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const sourceId = duplicate.source_id;
const unrelatedId = randomUUID();
const ids = [...repairs.map(r => r.id), duplicate.id, duplicate.canonical_id, unrelatedId];
const idList = ids.map(quote).join(',');
assert.equal(sql(`SELECT count(*) FROM public.scholarships WHERE id IN (${idList})`), '0', 'refuse to overwrite pre-existing fixture IDs');
const sourceExists = sql(`SELECT count(*) FROM public.scholarship_sources WHERE id=${quote(sourceId)}`) === '1';
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const created = await admin.auth.admin.createUser({ email: `unsw-repair-${randomUUID()}@caat.local.test`, password: `${randomUUID()}-Aa1`, email_confirm: true });
assert.ifError(created.error);
const userId = created.data.user.id;
const temp = mkdtempSync(join(tmpdir(), 'caat-unsw-repair-'));
let inserted = false;
let failure;
const OLD = '2026-05-01T00:00:00Z';
const rows = [
  ...repairs.map(r => ({ id: r.id, title: r.title, external_id: r.external_id, external_url: r.old_url })),
  { id: duplicate.id, title: duplicate.title, external_id: duplicate.external_id, external_url: duplicate.old_url, description: duplicate.description },
  { id: duplicate.canonical_id, title: duplicate.canonical_title, external_id: duplicate.canonical_external_id, external_url: duplicate.canonical_url },
  { id: unrelatedId, title: 'Unrelated provider fixture', external_id: `unrelated-${unrelatedId}`, external_url: 'https://unrelated.invalid/source' },
].map(r => ({ provider_name: 'Synthetic UNSW fixture', description: 'Protected recorded description', amount_value: 100000, amount_currency: 'AUD', deadline_at: OLD, source_last_synced_at: OLD, last_verified_at: OLD, raw_payload: { retain: 'original evidence' }, source_id: sourceId, slug: `prod244-${r.id}`, ...r }));
const snapshot = () => JSON.parse(sql(`SELECT json_agg(s ORDER BY id) FROM (SELECT * FROM public.scholarships WHERE id IN (${idList})) s`));
const saves = () => JSON.parse(sql(`SELECT json_agg(b ORDER BY scholarship_id) FROM (SELECT * FROM public.user_bookmarked_scholarships WHERE user_id=${quote(userId)}) b`));
const apply = () => checkLocalPsql(db, ['-v', 'ON_ERROR_STOP=1', '-f', migration]);
const without = (row, keys) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));

try {
  apply();
  assert.equal(sql(`SELECT count(*) FROM public.scholarships WHERE id IN (${idList})`), '0', 'absent production IDs are a no-op');
  const fixtureSql = `BEGIN;
    INSERT INTO public.scholarship_sources(id,slug,name,source_type) VALUES (${quote(sourceId)},'prod244-unsw','Synthetic UNSW','official_site') ON CONFLICT(id) DO NOTHING;
    INSERT INTO public.scholarships(id,source_id,external_id,external_url,slug,title,provider_name,description,amount_value,amount_currency,deadline_at,source_last_synced_at,last_verified_at,raw_payload)
    SELECT id,source_id,external_id,external_url,slug,title,provider_name,description,amount_value,amount_currency,deadline_at,source_last_synced_at,last_verified_at,raw_payload
    FROM jsonb_populate_recordset(NULL::public.scholarships,${quote(JSON.stringify(rows))}::jsonb);
    INSERT INTO public.user_bookmarked_scholarships(user_id,scholarship_id,status)
    SELECT ${quote(userId)}::uuid,id,'applied' FROM public.scholarships WHERE id IN (${idList});
    COMMIT;`;
  const fixtureFile = join(temp, 'fixtures.sql');
  writeFileSync(fixtureFile, fixtureSql, { mode: 0o600 });
  checkLocalPsql(db, ['-v', 'ON_ERROR_STOP=1', '-f', fixtureFile]);
  inserted = true;
  const before = snapshot(), bookmarksBefore = saves();
  apply();
  const after = snapshot();
  assert.equal(after.length, before.length, 'no record deleted or inserted');
  for (const original of before) {
    const updated = after.find(r => r.id === original.id);
    const repair = repairs.find(r => r.id === original.id);
    if (repair) {
      assert.equal(updated.external_url, repair.new_url);
      assert.deepEqual(without(updated, ['external_url','raw_payload','updated_at']), without(original, ['external_url','raw_payload','updated_at']), 'all award facts, IDs and freshness dates preserved');
      assert.equal(updated.raw_payload.retain, 'original evidence');
    } else if (original.id === duplicate.id) {
      assert.equal(updated.title, duplicate.canonical_title);
      assert.equal(updated.external_url, duplicate.canonical_url);
      assert.equal(updated.is_active, false);
      assert.equal(updated.raw_payload.catalogue_repair.canonical_id, duplicate.canonical_id);
      assert.equal(updated.raw_payload.retain, 'original evidence');
      assert.deepEqual(without(updated, ['title','external_url','is_active','raw_payload','updated_at']), without(original, ['title','external_url','is_active','raw_payload','updated_at']));
    } else assert.deepEqual(updated, original, 'canonical and unrelated records untouched');
  }
  assert.deepEqual(saves(), bookmarksBefore, 'every saved row and status survives');
  apply();
  assert.deepEqual(snapshot(), after, 'replay changes neither data nor timestamps');

  // A late target drifting must prevent an earlier valid target from changing.
  const first = repairs[0], last = repairs.at(-1);
  sql(`UPDATE public.scholarships SET external_url=${quote(first.old_url)} WHERE id=${quote(first.id)}; UPDATE public.scholarships SET external_id='unexpected-drift' WHERE id=${quote(last.id)};`);
  const drift = snapshot();
  assert.throws(apply, /PROD-244.*drift/i);
  assert.deepEqual(snapshot(), drift, 'identity failure is atomic');
  sql(`UPDATE public.scholarships SET external_id=${quote(last.external_id)} WHERE id=${quote(last.id)}; UPDATE public.scholarships SET is_active=false WHERE id=${quote(duplicate.canonical_id)};`);
  const missingCanonical = snapshot();
  assert.throws(apply, /PROD-244.*canonical/i);
  assert.deepEqual(snapshot(), missingCanonical, 'inactive canonical cannot permit archive or partial link changes');
  sql(`UPDATE public.scholarships SET is_active=true WHERE id=${quote(duplicate.canonical_id)}; UPDATE public.scholarships SET external_url='https://unreviewed.invalid/new' WHERE id=${quote(last.id)};`);
  const changedUrl = snapshot();
  assert.throws(apply, /PROD-244.*drift/i);
  assert.deepEqual(snapshot(), changedUrl, 'unreviewed URL is not overwritten');
  assert.deepEqual(saves(), bookmarksBefore, 'failures preserve saved data');
  sql(`UPDATE public.scholarships SET external_url=${quote(last.new_url)} WHERE id=${quote(last.id)}; UPDATE public.scholarships SET external_url=NULL WHERE id=${quote(duplicate.id)};`);
  const nullUrl = snapshot();
  assert.throws(apply, /PROD-244.*drift/i);
  assert.deepEqual(snapshot(), nullUrl, 'SQL null state cannot bypass the duplicate guard');
  sql(`UPDATE public.scholarships SET external_url=${quote(duplicate.canonical_url)} WHERE id=${quote(duplicate.id)}; DELETE FROM public.scholarships WHERE id=${quote(duplicate.canonical_id)};`);
  const absentCanonical = snapshot(), remainingSaves = saves();
  assert.throws(apply, /PROD-244.*canonical/i);
  assert.deepEqual(snapshot(), absentCanonical, 'missing canonical cannot permit partial changes');
  assert.deepEqual(saves(), remainingSaves);
  // Restore the synthetic canonical, then simulate one missing repair target.
  const canonicalFixture = before.find(row => row.id === duplicate.canonical_id);
  sql(`INSERT INTO public.scholarships SELECT * FROM jsonb_populate_record(NULL::public.scholarships,${quote(JSON.stringify(canonicalFixture))}::jsonb); DELETE FROM public.scholarships WHERE id=${quote(last.id)};`);
  const partialTargets = snapshot(), partialSaves = saves();
  assert.throws(apply, /PROD-244.*partial target set/i);
  assert.deepEqual(snapshot(), partialTargets, 'a missing target prevents all remaining link changes');
  assert.deepEqual(saves(), partialSaves, 'partial target failure preserves all remaining saves');
  console.log('PROD-244: 17 exact URL repairs, guarded duplicate archive, all protected facts/saves, idempotency and atomic drift failures passed.');
} catch (error) { failure = error; } finally {
  const errors = failure ? [failure] : [];
  const cleanup = async action => { try { await action(); } catch (error) { errors.push(error); } };
  await cleanup(() => { if (inserted) sql(`DELETE FROM public.scholarships WHERE id IN (${idList});`); });
  await cleanup(() => { if (!sourceExists) sql(`DELETE FROM public.scholarship_sources WHERE id=${quote(sourceId)} AND slug='prod244-unsw';`); });
  await cleanup(async () => { const removed = await admin.auth.admin.deleteUser(userId);
  assert.ifError(removed.error); });
  await cleanup(() => rmSync(temp, { recursive: true, force: true }));
  if (errors.length) throw new AggregateError(errors, 'PROD-244 check or cleanup failed');
}
