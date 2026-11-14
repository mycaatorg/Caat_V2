import { readFileSync } from 'node:fs';
import safety from '../../../.github/scripts/assert-isolated-e2e.js';
import { parseLocalDatabaseUrl } from './safety.mjs';

// Only these three status values are needed; never export them to app processes.
function readStatus(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|DB_URL|ANON_KEY)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

// Node test-runner only. Keep database credentials out of GITHUB_ENV and the app.
export function schoolNoteFaultDatabase(env = process.env, read = readFileSync) {
  safety.assertIsolatedE2E(env);
  let status;
  if (env.CAAT_ISOLATED_STATUS_FILE) {
    try { status = readStatus(read(env.CAAT_ISOLATED_STATUS_FILE, 'utf8')); }
    catch { throw Error('Could not read the disposable Supabase status file.'); }
  } else {
    status = { API_URL: env.NEXT_PUBLIC_SUPABASE_URL,
      ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, DB_URL: env.SUPABASE_DB_URL };
  }
  if (status.API_URL !== env.NEXT_PUBLIC_SUPABASE_URL || !status.ANON_KEY
    || status.ANON_KEY !== env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw Error('Local note-fault API settings must match the isolated browser.');
  }
  const api = new URL(status.API_URL);
  for (const url of [api, new URL(env.PLAYWRIGHT_BASE_URL)]) {
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw Error('Note fault requires plain loopback app and API origins.');
    }
  }
  const db = parseLocalDatabaseUrl(status.DB_URL);
  if (db.hostname !== api.hostname || db.port !== (api.port === '55431' ? '55432' : '54322')
    || db.username !== 'postgres' || !db.password || db.pathname !== '/postgres' || db.search || db.hash) {
    throw Error('Note fault requires the matching disposable Postgres database.');
  }
  return db;
}
