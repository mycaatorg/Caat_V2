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

const revision = 'a'.repeat(40);
test('exact-release health requires both healthy provider and matching valid revision', async () => {
  for (const body of [{ status: 'ok' }, { status: 'ok', revision: 'b'.repeat(40) }, { status: 'ok', revision: 'private response' }, { status: 'unavailable', revision }]) {
    const result = await checkAuthHealth(token, async () => Response.json(body), revision);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /private response/);
  }
  assert.equal((await checkAuthHealth(token, async () => Response.json({ status: 'ok', revision }), revision)).ok, true);
});
test('invalid release expectations fail before contacting production', async () => {
  for (const invalid of ['', 'private expectation', 'a'.repeat(39), 'a'.repeat(41), null, 42]) {
    let calls = 0;
    const result = await checkAuthHealth(token, async () => { calls++; return Response.json({ status: 'ok', revision }); }, invalid);
    assert.equal(calls, 0);
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /private expectation/);
  }
});
