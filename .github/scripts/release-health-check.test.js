const { test } = require('node:test');
const assert = require('node:assert/strict');
const { waitForRelease } = require('./release-health-check.js');
const token = 'synthetic-probe-token-at-least-thirty-two-characters';
const revision = 'a'.repeat(40);

test('waiting continues across an old release and finishes only on matching health', async () => {
  let calls = 0; const pauses = [];
  const result = await waitForRelease(token, revision, { wait: true,
    fetchImpl: async () => Response.json({ status: 'ok', revision: ++calls < 3 ? 'b'.repeat(40) : revision }),
    delayImpl: async ms => pauses.push(ms),
  });
  assert.equal(result.ok, true); assert.equal(calls, 3); assert.deepEqual(pauses, [10000, 10000]);
});
test('deployment wait stops at thirty attempts and does not sleep after the final failure', async () => {
  let calls = 0; const pauses = [];
  const result = await waitForRelease(token, revision, { wait: true,
    fetchImpl: async () => { calls++; return Response.json({ status: 'ok', revision: 'b'.repeat(40) }); },
    delayImpl: async ms => pauses.push(ms),
  });
  assert.equal(result.ok, false); assert.equal(calls, 30); assert.deepEqual(pauses, Array(29).fill(10000));
});
test('post-smoke check fails immediately when a different release is live', async () => {
  let calls = 0; let pauses = 0;
  const result = await waitForRelease(token, revision, {
    fetchImpl: async () => { calls++; return Response.json({ status: 'ok', revision: 'b'.repeat(40) }); },
    delayImpl: async () => { pauses++; },
  });
  assert.equal(result.ok, false); assert.equal(calls, 1); assert.equal(pauses, 0);
});
test('bad deployment-check configuration makes no requests or delays', async () => {
  for (const [credential, expected] of [['', revision], [token, undefined], [token, 'private-input'], [token, '']]) {
    let calls = 0; let pauses = 0;
    const result = await waitForRelease(credential, expected, { wait: true,
      fetchImpl: async () => { calls++; return Response.json({ status: 'ok' }); },
      delayImpl: async () => { pauses++; },
    });
    assert.equal(result.ok, false); assert.equal(calls, 0); assert.equal(pauses, 0);
    assert.doesNotMatch(JSON.stringify(result), /private-input|synthetic-probe/);
  }
});
