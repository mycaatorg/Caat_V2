const assert = require('node:assert/strict');
const test = require('node:test');

test('local Supabase status parser exports only validated loopback API settings', async () => {
  const { parseStatusEnv, validateStatus, githubPublicEnv } = await import('./bootstrap-local-supabase.mjs');
  const values = validateStatus(parseStatusEnv([
    'API_URL="http://127.0.0.1:55431"',
    'DB_URL="postgresql://postgres:local-only@127.0.0.1:55432/postgres"',
    'ANON_KEY="local-anon-key"',
    'SERVICE_ROLE_KEY="local-service-role-key"',
  ].join('\n')));
  const output = githubPublicEnv(values);
  assert.equal(output, 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55431\nNEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key\n');
  assert.doesNotMatch(output, /SERVICE_ROLE|local-service-role-key|DB_URL/);
});

test('local Supabase bootstrap rejects missing keys and non-loopback projects', async () => {
  const { validateStatus } = await import('./bootstrap-local-supabase.mjs');
  const base = {
    API_URL: 'http://127.0.0.1:55431',
    DB_URL: 'postgresql://postgres:local-only@127.0.0.1:55432/postgres',
    ANON_KEY: 'local-anon-key',
    SERVICE_ROLE_KEY: 'local-service-role-key',
  };
  assert.throws(() => validateStatus({ ...base, SERVICE_ROLE_KEY: '' }), /omitted SERVICE_ROLE_KEY/);
  assert.throws(() => validateStatus({ ...base, API_URL: 'https://project.supabase.co:55431' }), /loopback/);
  assert.throws(() => validateStatus({ ...base, DB_URL: 'postgresql://db.example:55432/postgres' }), /loopback/);
});
