import { execFileSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseStatusEnv } from './bootstrap-local-supabase.mjs';
import safety from './assert-isolated-e2e.js';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '../../caat-frontend');
const readOverride = "SELECT cfg FROM (SELECT split_part(setting,'=',2) AS cfg FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) setting WHERE s.setrole=(SELECT oid FROM pg_roles WHERE rolname='authenticator') AND s.setdatabase=(SELECT oid FROM pg_database WHERE datname='postgres') AND setting LIKE 'pgrst.db_max_rows=%') current_override;";
const reload = " NOTIFY pgrst, 'reload config';";

function parsedUrl(value, label) {
  try { return new URL(value); } catch { throw Error(`${label} must be a valid local URL.`); }
}

export function validateLowCap(env, status) {
  safety.assertIsolatedE2E(env);
  const api = parsedUrl(status.API_URL, 'API_URL');
  const app = parsedUrl(env.PLAYWRIGHT_BASE_URL, 'PLAYWRIGHT_BASE_URL');
  for (const [url, label] of [[api, 'API_URL'], [app, 'PLAYWRIGHT_BASE_URL']]) {
    if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw Error(`${label} must be a plain HTTP loopback origin.`);
    }
  }
  if (!['55431', '54321'].includes(api.port) || api.href !== parsedUrl(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL').href) {
    throw Error('API_URL must match the isolated browser API and approved test port.');
  }
  if (!status.ANON_KEY || status.ANON_KEY !== env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw Error('Local public keys must match.');
  const db = parsedUrl(status.DB_URL, 'DB_URL');
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || db.hostname !== api.hostname
    || db.port !== (api.port === '55431' ? '55432' : '54322') || db.username !== 'postgres'
    || !db.password || db.pathname !== '/postgres' || db.search || db.hash) {
    throw Error('DB_URL must be the matching loopback test database and postgres role.');
  }
  return { api, db };
}

function browserEnvironment(env, status) {
  const safe = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'PLAYWRIGHT_BROWSERS_PATH', 'NODE_PATH', 'NO_COLOR']) {
    if (env[key] !== undefined) safe[key] = env[key];
  }
  return { ...safe, CI: '1', CAAT_ISOLATED_E2E: '1',
    E2E_TEST_EMAIL: env.E2E_TEST_EMAIL, E2E_TEST_PASSWORD: env.E2E_TEST_PASSWORD,
    PLAYWRIGHT_BASE_URL: env.PLAYWRIGHT_BASE_URL,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    CAAT_EXPORT_TEST_ROW_CAP: '50', CAAT_TODAY_TEST_ROW_CAP: '50', CAAT_CALENDAR_TEST_ROW_CAP: '50' };
}

export function createSql(status, execute = execFileSync) {
  const db = parsedUrl(status.DB_URL, 'DB_URL');
  // Never put a connection URL/password in argv or inherit PGOPTIONS/PGSERVICE.
  const env = { PATH: process.env.PATH, PGHOST: db.hostname, PGPORT: db.port,
    PGUSER: 'postgres', PGDATABASE: 'postgres', PGPASSWORD: decodeURIComponent(db.password),
    PGCONNECT_TIMEOUT: '5', PGOPTIONS: '-c statement_timeout=5000' };
  return async input => {
    try {
      return execute('psql', ['-X', '--no-password', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
        env, input, encoding: 'utf8', timeout: 10_000, stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch { throw Error('Local row-cap SQL operation failed; private connection details suppressed.'); }
  };
}

export async function runLowCap({ env, status, sql, runBrowser, signal }) {
  validateLowCap(env, status);
  signal?.throwIfAborted();
  const previous = await sql(readOverride);
  if (previous !== '' && !/^\d{1,10}$/.test(previous)) throw Error('Unexpected prior row-cap override; refusing mutation.');
  signal?.throwIfAborted();
  const failures = [];
  // Applying can commit and then lose its response, so restoration starts here.
  try {
    await sql("ALTER ROLE authenticator IN DATABASE postgres SET pgrst.db_max_rows = '50';" + reload);
    signal?.throwIfAborted();
    await runBrowser(browserEnvironment(env, status), signal);
    signal?.throwIfAborted();
  } catch (error) { failures.push(error); }
  finally {
    try {
      const restore = previous === '' ? 'RESET pgrst.db_max_rows' : `SET pgrst.db_max_rows = '${previous}'`;
      await sql(`ALTER ROLE authenticator IN DATABASE postgres ${restore};` + reload);
      if (await sql(readOverride) !== previous) throw Error('Row-cap restoration verification failed.');
    } catch (error) { failures.push(Error(`Row-cap restoration failed: ${error.message}`)); }
  }
  if (failures.length) throw new AggregateError(failures, failures.map(e => e.message).join('; '));
}

export function runChild(command, args, { env, cwd, signal, killGraceMs = 5000 }) {
  signal?.throwIfAborted();
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { env, cwd, stdio: 'inherit', detached: true });
    let stopping;
    const killGroup = sig => {
      if (!child.pid) return;
      try { process.kill(-child.pid, sig); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    };
    const abort = () => {
      if (stopping) return;
      killGroup('SIGTERM');
      // Keep the grace timer even if the parent exits: descendants may survive it.
      stopping = new Promise((done, fail) => setTimeout(() => {
        try { killGroup('SIGKILL'); done(); } catch (error) { fail(error); }
      }, killGraceMs));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.once('error', error => { signal?.removeEventListener('abort', abort); reject(Error(`Browser process could not start (${error.code || 'unknown'}).`)); });
    child.once('close', async (code, childSignal) => {
      signal?.removeEventListener('abort', abort);
      try {
        if (stopping) await stopping;
        // A crashed parent must not leave a server behind while we restore SQL.
        else killGroup('SIGKILL');
        if (signal?.aborted) reject(Error('Browser run interrupted; process group stopped.'));
        else if (code !== 0) reject(Error(`Browser run failed (${childSignal || code}).`));
        else resolveRun();
      } catch { reject(Error('Browser process-group cleanup failed.')); }
    });
  });
}

async function main() {
  if (!process.argv[2]) throw Error('Pass the private local Supabase status file.');
  const status = parseStatusEnv(await readFile(process.argv[2], 'utf8'));
  validateLowCap(process.env, status);
  // A missing build must fail instead of silently rebuilding with different settings.
  await readFile(resolve(frontend, '.next/BUILD_ID'), 'utf8');
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  try {
    console.log('Running three isolated browser journeys under a real 50-row cap.');
    await runLowCap({ env: process.env, status, signal: controller.signal, sql: createSql(status),
      runBrowser: (env, signal) => runChild(process.execPath,
        [resolve(frontend, 'node_modules/@playwright/test/cli.js'), 'test', '--config=playwright.low-cap.config.ts'],
        { cwd: frontend, env, signal }),
    });
    console.log('Low-row-cap journeys passed; prior database-role override restored and verified.');
  } finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
