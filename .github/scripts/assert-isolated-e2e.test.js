const assert = require('node:assert/strict');
const test = require('node:test');
const { assertIsolatedE2E } = require('./assert-isolated-e2e.js');

const valid = {
  CAAT_ISOLATED_E2E: '1',
  PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3100/',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55431/?project=local',
  E2E_TEST_EMAIL: 'e2e.student@caat.local.test',
  E2E_TEST_PASSWORD: 'Caat-ci-e2e-local-only-2026',
};

test('isolated E2E preflight accepts the seeded loopback app and database', () => {
  assert.equal(assertIsolatedE2E(valid), true);
});

test('isolated E2E preflight rejects missing opt-in or credentials', () => {
  assert.throws(() => assertIsolatedE2E({ ...valid, CAAT_ISOLATED_E2E: undefined }), /CAAT_ISOLATED_E2E/);
  assert.throws(() => assertIsolatedE2E({ ...valid, E2E_TEST_EMAIL: undefined }), /E2E_TEST_EMAIL/);
  assert.throws(() => assertIsolatedE2E({ ...valid, E2E_TEST_PASSWORD: '' }), /E2E_TEST_PASSWORD/);
});

test('isolated E2E preflight rejects malformed, non-loopback, and production URLs', () => {
  assert.throws(() => assertIsolatedE2E({ ...valid, PLAYWRIGHT_BASE_URL: 'not a url' }), /valid URL/);
  assert.throws(() => assertIsolatedE2E({ ...valid, PLAYWRIGHT_BASE_URL: 'http://localhost:3000' }), /approved local test port/);
  assert.throws(() => assertIsolatedE2E({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' }), /approved local test port/);
  assert.throws(() => assertIsolatedE2E({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'http://evil.example:55431' }), /approved local test port/);
});
