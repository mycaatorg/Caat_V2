const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const env = {
  CAAT_ISOLATED_E2E: '1', PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55431', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon',
  E2E_TEST_EMAIL: 'e2e.student@caat.local.test', E2E_TEST_PASSWORD: 'local-only-password',
  PATH: process.env.PATH, HOME: process.env.HOME,
  SUPABASE_SERVICE_ROLE_KEY: 'must-not-reach-browser', PGPASSWORD: 'must-not-reach-browser',
};
const status = { API_URL: env.NEXT_PUBLIC_SUPABASE_URL, ANON_KEY: 'local-anon', SERVICE_ROLE_KEY: 'admin-secret',
  DB_URL: 'postgresql://postgres:private-db-password@127.0.0.1:55432/postgres' };
const moduleUnderTest = () => import('./low-row-cap-e2e.mjs');

// Fake only the external database; retain its state so dropping finally is observable.
function database(initial = '') {
  let value = initial;
  const statements = [];
  return {
    statements, current: () => value,
    sql: async (query) => {
      statements.push(query);
      if (query.startsWith('SELECT')) return value;
      if (query.includes('RESET pgrst.db_max_rows')) value = '';
      else {
        const match = query.match(/SET pgrst.db_max_rows = '(\d+)'/);
        assert.ok(match, 'SQL must set a numeric override or reset it'); value = match[1];
      }
      assert.match(query, /NOTIFY pgrst, 'reload config'/);
      return '';
    },
  };
}

test('unsafe test configuration refuses every database operation', async () => {
  const { runLowCap } = await moduleUnderTest();
  const cases = [
    [{ CAAT_ISOLATED_E2E: '0' }, {}], [{ PLAYWRIGHT_BASE_URL: 'https://www.mycaat.com' }, {}],
    [{ E2E_TEST_EMAIL: 'student@example.com' }, {}], [{ NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321' }, {}],
    [{}, { API_URL: 'https://project.supabase.co:55431' }],
    [{}, { API_URL: 'http://user:secret@127.0.0.1:55431' }],
    [{}, { API_URL: 'http://127.0.0.1:55431/rest/v1' }],
    [{}, { DB_URL: 'postgresql://postgres:secret@db.example:55432/postgres' }],
    [{}, { DB_URL: 'postgresql://postgres:secret@127.0.0.1:54322/postgres' }],
    [{}, { DB_URL: 'postgresql://postgres:secret@localhost:55432/postgres' }],
    [{}, { DB_URL: 'postgresql://other:secret@127.0.0.1:55432/postgres' }],
    [{}, { DB_URL: 'postgresql://postgres:secret@127.0.0.1:55432/production' }],
    [{}, { DB_URL: 'postgresql://postgres:secret@127.0.0.1:55432/postgres?host=remote' }],
    [{}, { ANON_KEY: 'different-key' }],
  ];
  for (const [envPatch, statusPatch] of cases) {
    let touched = false;
    await assert.rejects(runLowCap({ env: { ...env, ...envPatch }, status: { ...status, ...statusPatch },
      sql: async () => { touched = true; }, runBrowser: async () => { throw Error('must not start'); } }));
    assert.equal(touched, false);
  }
});

for (const initial of ['', '725']) {
  test(`success restores ${initial || 'absent'} override and gives browser only public settings`, async () => {
    const { runLowCap } = await moduleUnderTest(); const db = database(initial);
    await runLowCap({ env, status, sql: db.sql, runBrowser: async (browserEnv) => {
      assert.equal(db.current(), '50');
      assert.equal(browserEnv.CAAT_EXPORT_TEST_ROW_CAP, '50');
      assert.equal(browserEnv.CAAT_TODAY_TEST_ROW_CAP, '50');
      assert.equal(browserEnv.CAAT_CALENDAR_TEST_ROW_CAP, '50');
      assert.equal(browserEnv.CI, '1');
      assert.equal(browserEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'local-anon');
      assert.equal(browserEnv.E2E_TEST_PASSWORD, 'local-only-password');
      assert.doesNotMatch(JSON.stringify(browserEnv), /admin-secret|private-db-password|must-not-reach-browser/);
    } });
    assert.equal(db.current(), initial);
    assert.ok(db.statements.at(-1).startsWith('SELECT'), 'restoration must be verified');
  });
}

test('browser failure remains failure after restoration', async () => {
  const { runLowCap } = await moduleUnderTest(); const db = database('725');
  await assert.rejects(runLowCap({ env, status, sql: db.sql, runBrowser: async () => { throw Error('browser failed'); } }), /browser failed/);
  assert.equal(db.current(), '725');
});

test('browser and restoration failures are both reported', async () => {
  const { runLowCap } = await moduleUnderTest(); const db = database(); let finished = false;
  await assert.rejects(runLowCap({ env, status,
    sql: async query => { if (finished) throw Error('restore failed'); return db.sql(query); },
    runBrowser: async () => { finished = true; throw Error('browser failed'); },
  }), error => /browser failed/.test(error.message) && /restoration failed/.test(error.message));
});

test('partial apply failure still restores the original override', async () => {
  const { runLowCap } = await moduleUnderTest(); const db = database(); let first = true;
  await assert.rejects(runLowCap({ env, status, sql: async query => {
    const result = await db.sql(query);
    if (first && query.startsWith('ALTER')) { first = false; throw Error('apply response lost'); }
    return result;
  }, runBrowser: async () => assert.fail('must not start') }), /apply response lost/);
  assert.equal(db.current(), '');
});

test('malformed prior override refuses mutation', async () => {
  const { runLowCap } = await moduleUnderTest(); const db = database("50'; DROP ROLE authenticator; --");
  await assert.rejects(runLowCap({ env, status, sql: db.sql, runBrowser: async () => assert.fail('must not start') }), /override/);
  assert.equal(db.statements.length, 1);
});

for (const mode of ['write failure', 'verification mismatch']) {
  test(`restoration ${mode} fails even after successful browser run`, async () => {
    const { runLowCap } = await moduleUnderTest(); const db = database('725'); let finished = false;
    await assert.rejects(runLowCap({ env, status, sql: async query => {
      if (finished && mode === 'write failure') throw Error('restore failed');
      if (finished && mode === 'verification mismatch' && query.startsWith('SELECT')) return '50';
      return db.sql(query);
    }, runBrowser: async () => { finished = true; } }), /restor/i);
  });
}

test('abort before mutation performs no SQL', async () => {
  const { runLowCap } = await moduleUnderTest(); const controller = new AbortController(); controller.abort();
  let touched = false;
  await assert.rejects(runLowCap({ env, status, signal: controller.signal,
    sql: async () => { touched = true; }, runBrowser: async () => assert.fail('must not start') }));
  assert.equal(touched, false);
});

test('abort while reading prior state does not apply the override', async () => {
  const { runLowCap } = await moduleUnderTest(); const db = database('725'); const controller = new AbortController();
  await assert.rejects(runLowCap({ env, status, signal: controller.signal,
    sql: async query => { const value = await db.sql(query); controller.abort(); return value; },
    runBrowser: async () => assert.fail('must not start'),
  }));
  assert.equal(db.current(), '725'); assert.equal(db.statements.length, 1);
});

test('abort waits for browser shutdown before restoring and cannot report success', async () => {
  const { runLowCap } = await moduleUnderTest(); const controller = new AbortController(); const db = database();
  let browserStopped = false;
  await assert.rejects(runLowCap({ env, status, signal: controller.signal,
    sql: async query => { if (query.includes('RESET')) assert.equal(browserStopped, true); return db.sql(query); },
    runBrowser: async () => { controller.abort(); await new Promise(r => setTimeout(r, 10)); browserStopped = true; },
  }));
  assert.equal(db.current(), '');
});

test('psql receives credentials only via private environment, not arguments or errors', async () => {
  const { createSql } = await moduleUnderTest(); let seen;
  const sql = createSql(status, (command, args, options) => { seen = { command, args, options }; return '725\n'; });
  assert.equal(await sql('SELECT 1'), '725');
  assert.doesNotMatch(JSON.stringify(seen.args), /private-db-password|postgresql:/);
  assert.equal(seen.options.env.PGPASSWORD, 'private-db-password');
  assert.equal(seen.options.env.PGHOST, '127.0.0.1');
  assert.equal(seen.options.input, 'SELECT 1');
  const broken = createSql(status, () => { throw Error('private-db-password admin-secret'); });
  await assert.rejects(broken('SELECT 1'), error => !/private-db-password|admin-secret/.test(String(error)));
});

test('real browser child exit codes and launch errors remain failures', async () => {
  const { runChild } = await moduleUnderTest();
  await runChild(process.execPath, ['-e', 'process.exit(0)'], { env: process.env });
  await assert.rejects(runChild(process.execPath, ['-e', 'process.exit(7)'], { env: process.env }), /failed \(7\)/);
  await assert.rejects(runChild('/caat-deliberately-missing-executable', [], { env: process.env }), /could not start/);
});

test('real child cancellation also stops a stubborn grandchild before resolving', { timeout: 10_000 }, async () => {
  const { runChild } = await moduleUnderTest(); const dir = await mkdtemp(join(tmpdir(), 'caat-cap-process-'));
  const heartbeat = join(dir, 'heartbeat'); const controller = new AbortController();
  const child = `process.on('SIGTERM',()=>{});const fs=require('node:fs');setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},'x'),20);`;
  const parent = `const {spawn}=require('node:child_process');spawn(process.execPath,['-e',${JSON.stringify(child)}],{stdio:'ignore'});setInterval(()=>{},1000);`;
  try {
    const result = runChild(process.execPath, ['-e', parent], { env: process.env, signal: controller.signal, killGraceMs: 100 });
    // Register rejection handling before abort to avoid unhandled rejection races.
    const rejected = assert.rejects(result, /interrupt|abort/i);
    for (let i = 0; i < 100; i++) { if (await readFile(heartbeat).catch(() => null)) break; await new Promise(r => setTimeout(r, 20)); }
    assert.ok((await readFile(heartbeat)).length > 0);
    controller.abort(); await rejected;
    const size = (await readFile(heartbeat)).length;
    await new Promise(r => setTimeout(r, 150));
    assert.equal((await readFile(heartbeat)).length, size, 'grandchild must not remain running');
  } finally { controller.abort(); await rm(dir, { recursive: true, force: true }); }
});
