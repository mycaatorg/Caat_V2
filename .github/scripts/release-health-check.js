const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const { checkAuthHealth } = require('./auth-health-check.js');

/** Only the existing fixed production probe is reachable; no event-supplied URL. */
async function waitForRelease(token, revision, { wait = false, fetchImpl = fetch, delayImpl = delay } = {}) {
  if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/.test(revision)) {
    return { ok: false, message: 'A valid full release revision is required.' };
  }
  if (typeof token !== 'string' || token.length < 32) {
    return { ok: false, message: 'Configure the existing production health-probe credential.' };
  }
  const attempts = wait ? 30 : 1;
  let result;
  for (let attempt = 0; attempt < attempts; attempt++) {
    result = await checkAuthHealth(token, fetchImpl, revision);
    if (result.ok) return result;
    if (attempt + 1 < attempts) await delayImpl(10_000);
  }
  return result;
}

async function main() {
  const revision = process.env.EXPECTED_RELEASE_SHA;
  const result = await waitForRelease(process.env.AUTH_HEALTH_CHECK_TOKEN, revision, { wait: process.argv.includes('--wait') });
  console.log(result.message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const safeRevision = typeof revision === 'string' && /^[a-f0-9]{40}$/.test(revision) ? revision : 'invalid';
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Deployed release: ${result.ok ? 'verified' : 'failed'}\n\nExpected revision: ${safeRevision}\n\n${result.message}\n`);
  }
  if (!result.ok) {
    console.error('::error::Production did not verify the expected release and provider readiness.');
    process.exitCode = 1;
  }
}
module.exports = { waitForRelease };
if (require.main === module) main().catch(() => { console.error('Release verification failed. Check the run summary.'); process.exitCode = 1; });
