const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkAuthHealth } = require('./auth-health-check.js');

const token = 'probe-secret-at-least-thirty-two-characters';
test('a healthy production probe sends only the probe credential and disables redirects', async () => {
  const result = await checkAuthHealth(token, async (url, options) => {
    assert.equal(url, 'https://www.mycaat.com/api/health/auth');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(JSON.stringify({ status: 'ok' }));
  });
  assert.equal(result.ok, true);
});
test('missing monitor configuration fails without making a request', async () => {
  const result = await checkAuthHealth('', async () => assert.fail('must not fetch'));
  assert.equal(result.ok, false);
  assert.match(result.message, /configure/i);
});
test('unhealthy, unauthorized, redirected and malformed replies cannot appear healthy', async () => {
  for (const response of [new Response('{"status":"unavailable"}', { status: 503 }), new Response('private data', { status: 404 }), new Response('private data', { status: 302 }), new Response('private data'), new Response('{"status":"unavailable"}')]) {
    const result = await checkAuthHealth(token, async () => response);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /private data/);
  }
});
test('a network failure is sanitized and the next healthy check recovers', async () => {
  const failed = await checkAuthHealth(token, async () => { throw new Error(`private-host ${token}`); });
  assert.equal(failed.ok, false);
  assert.doesNotMatch(JSON.stringify(failed), /private-host|probe-secret/);
  assert.equal((await checkAuthHealth(token, async () => new Response('{"status":"ok"}'))).ok, true);
});
