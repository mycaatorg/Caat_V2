const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

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

for (const stage of ['restore', 'verify']) {
  test(`abort during ${stage} completes restoration but rejects the run`, async () => {
    const { runLowCap } = await moduleUnderTest(); const db = database('725');
    const controller = new AbortController(); let finished = false;
    await assert.rejects(runLowCap({ env, status, signal: controller.signal,
      sql: async query => {
        const result = await db.sql(query);
        if (finished && (stage === 'restore' ? query.startsWith('ALTER') : query.startsWith('SELECT'))) controller.abort();
        return result;
      }, runBrowser: async () => { finished = true; },
    }), /abort|interrupt/i);
    assert.equal(db.current(), '725');
    assert.ok(db.statements.at(-1).startsWith('SELECT'));
  });
}

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
  const child = `process.on('SIGTERM',()=>{});process.on('SIGINT',()=>{});const fs=require('node:fs');setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},'x'),20);`;
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

test('actual Playwright interruption tears down its detached webServer', { timeout: 15_000 }, async t => {
  const cli = resolve(__dirname, '../../caat-frontend/node_modules/@playwright/test/cli.js');
  // The discovery job has no frontend dependencies yet; the browser job reruns these tests after npm ci.
  if (!require('node:fs').existsSync(cli)) return t.skip('Playwright integration runs after frontend dependency installation');
  const { runChild } = await moduleUnderTest(); const dir = await mkdtemp(join(tmpdir(), 'caat-cap-playwright-'));
  const heartbeat = join(dir, 'heartbeat'); const pidFile = join(dir, 'server-pid');
  const controller = new AbortController();
  await writeFile(join(dir, 'server.cjs'), `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid));console.log('READY');setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},'x'),20);`);
  await writeFile(join(dir, 'wait.spec.cjs'), `const {test}=require(${JSON.stringify(resolve(__dirname, '../../caat-frontend/node_modules/@playwright/test'))});test('wait',async()=>{await new Promise(r=>setTimeout(r,60000));});`);
  await writeFile(join(dir, 'playwright.config.cjs'), `module.exports={testDir:${JSON.stringify(dir)},testMatch:'wait.spec.cjs',reporter:'line',webServer:{command:${JSON.stringify(`${process.execPath} ${join(dir, 'server.cjs')}`)},wait:{stdout:/READY/},timeout:10000}};`);
  try {
    const result = runChild(process.execPath, [cli, 'test', '--config', join(dir, 'playwright.config.cjs')], { cwd: dir, env: process.env, signal: controller.signal, killGraceMs: 2000 });
    const rejected = assert.rejects(result, /interrupt|abort/i);
    for (let i = 0; i < 200; i++) { if (await readFile(heartbeat).catch(() => null)) break; await new Promise(r => setTimeout(r, 25)); }
    assert.ok((await readFile(heartbeat)).length);
    controller.abort(); await rejected;
    const size = (await readFile(heartbeat)).length; await new Promise(r => setTimeout(r, 150));
    assert.equal((await readFile(heartbeat)).length, size, 'detached webServer must stop before restoration');
  } finally {
    controller.abort();
    const pid = Number(await readFile(pidFile, 'utf8').catch(() => ''));
    if (pid > 1) { try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    await rm(dir, { recursive: true, force: true });
  }
});

test('owned server is stopped even when test and server ignore graceful interruption', { timeout: 10_000 }, async () => {
  const { runBrowserPhase } = await moduleUnderTest(); const dir = await mkdtemp(join(tmpdir(), 'caat-cap-owned-'));
  const heartbeat = join(dir, 'heartbeat'); const started = join(dir, 'tests-started'); const controller = new AbortController();
  const probe = require('node:net').createServer();
  await new Promise(r => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; await new Promise(r => probe.close(r));
  const serverCode = `process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});require('node:http').createServer((q,r)=>r.end('ready')).listen(${port},'127.0.0.1');setInterval(()=>require('node:fs').appendFileSync(${JSON.stringify(heartbeat)},'x'),20);`;
  try {
    const result = runBrowserPhase({ env: process.env, signal: controller.signal, url: `http://127.0.0.1:${port}`,
      serverArgs: ['-e', serverCode], testArgs: ['-e', `process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});require('node:fs').writeFileSync(${JSON.stringify(started)},'ready');setInterval(()=>{},1000);`], killGraceMs: 100 });
    const rejected = assert.rejects(result, /abort|interrupt/i);
    for (let i = 0; i < 100; i++) { if (await readFile(started).catch(() => null)) break; await new Promise(r => setTimeout(r, 20)); }
    assert.equal(await readFile(started, 'utf8'), 'ready');
    assert.ok((await readFile(heartbeat)).length); controller.abort(); await rejected;
    const size = (await readFile(heartbeat)).length; await new Promise(r => setTimeout(r, 150));
    assert.equal((await readFile(heartbeat)).length, size);
    await assert.rejects(fetch(`http://127.0.0.1:${port}`));
  } finally { controller.abort(); await rm(dir, { recursive: true, force: true }); }
});

test('browser phase refuses an occupied app port without disturbing its server', async () => {
  const { runBrowserPhase } = await moduleUnderTest();
  const occupied = require('node:http').createServer((q, r) => r.end('existing server'));
  await new Promise(r => occupied.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${occupied.address().port}`;
  try {
    await assert.rejects(runBrowserPhase({ env: process.env, url, serverArgs: ['-e', 'process.exit(9)'], testArgs: ['-e', 'process.exit(9)'] }), /occupied/);
    assert.equal(await (await fetch(url)).text(), 'existing server');
  } finally { await new Promise(r => occupied.close(r)); }
});
