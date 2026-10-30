const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('the actual PR CI command discovers all five legacy community journeys exactly once in staging', () => {
  // --list compiles discovery without starting the app, opening browsers or
  // authenticating. Synthetic values satisfy the existing isolated-test guard.
  const output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'test:e2e:ci', '--', '--list'], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, CAAT_ISOLATED_E2E: '1', PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3100', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55431', E2E_TEST_EMAIL: 'e2e.student@caat.local.test', E2E_TEST_PASSWORD: 'synthetic-discovery-only-password' },
    encoding: 'utf8', timeout: 30000,
  });
  const discovered = output.split('\n').filter(line => /\[[^\]]+\].*community-(?:features|smoke)\.spec\.ts:\d+:\d+/.test(line));
  assert.equal(discovered.length, 5, 'five community journeys must be included by the real CI filename filters');
  assert.ok(discovered.every(line => line.includes('[staging]')), 'community writes run only in the isolated staging project');
  assert.equal(new Set(discovered.map(line => line.slice(line.indexOf('community-')))).size, 5, 'no duplicate project execution');
});
