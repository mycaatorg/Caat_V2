const LOCAL_EMAIL = 'e2e.student@caat.local.test';

function assertLoopback(value, label, ports) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname) || !ports.includes(url.port)) {
    throw new Error(`${label} must use HTTP loopback on an approved local test port.`);
  }
  return url;
}

function assertIsolatedE2E(env) {
  if (env.CAAT_ISOLATED_E2E !== '1') throw new Error('Set CAAT_ISOLATED_E2E=1 to run write-capable browser tests.');
  assertLoopback(env.PLAYWRIGHT_BASE_URL, 'PLAYWRIGHT_BASE_URL', ['3100']);
  assertLoopback(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL', ['55431', '54321']);
  if (env.E2E_TEST_EMAIL !== LOCAL_EMAIL) throw new Error(`E2E_TEST_EMAIL must be the seeded local account ${LOCAL_EMAIL}.`);
  if (!env.E2E_TEST_PASSWORD || env.E2E_TEST_PASSWORD.length < 12) throw new Error('E2E_TEST_PASSWORD must be set for the disposable local test account.');
  return true;
}

if (require.main === module) {
  try {
    assertIsolatedE2E(process.env);
    process.stdout.write('E2E safety preflight passed: loopback app and seeded local Supabase configured.\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { assertIsolatedE2E };
