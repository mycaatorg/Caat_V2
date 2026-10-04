const assert = require('node:assert/strict');
const test = require('node:test');
const { validateIsolation } = require('./assert-e2e-isolation');

const validSecrets = {
  E2E_SUPABASE_URL: 'https://test-project.supabase.co',
  E2E_SUPABASE_ANON_KEY: 'test-anon-key',
  E2E_TEST_EMAIL: 'test@example.invalid',
  E2E_TEST_PASSWORD: 'test-password',
  PRODUCTION_SUPABASE_URL: 'https://production-project.supabase.co',
};

test('isolation guard requires the dedicated database, key, test user and production URL', () => {
  for (const name of Object.keys(validSecrets)) {
    const env = { ...validSecrets };
    delete env[name];
    assert.throws(() => validateIsolation(env), new RegExp(name));
  }
});

test('isolation guard rejects the production host despite path, query or case differences', () => {
  const env = {
    ...validSecrets,
    E2E_SUPABASE_URL: 'https://PROJECT.SUPABASE.CO/path/?ref=not-production',
    PRODUCTION_SUPABASE_URL: 'https://project.supabase.co/',
  };
  assert.throws(() => validateIsolation(env), /must differ from production/);
});

test('isolation guard rejects malformed or non-HTTPS project URLs', () => {
  assert.throws(
    () => validateIsolation({ ...validSecrets, E2E_SUPABASE_URL: 'not-a-url' }),
    /E2E_SUPABASE_URL must be a valid HTTPS URL/,
  );
  assert.throws(
    () => validateIsolation({ ...validSecrets, PRODUCTION_SUPABASE_URL: 'http://production.local' }),
    /PRODUCTION_SUPABASE_URL must be a valid HTTPS URL/,
  );
});

test('isolation guard accepts a distinct E2E host', () => {
  assert.doesNotThrow(() => validateIsolation(validSecrets));
});
