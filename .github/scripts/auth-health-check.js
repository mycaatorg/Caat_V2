const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');

async function checkAuthHealth(token, fetchImpl = fetch) {
  if (!token || token.length < 32) return { ok: false, message: 'Configure the AUTH_HEALTH_CHECK_TOKEN repository secret and matching Vercel production variable.' };
  try {
    const response = await fetchImpl('https://www.mycaat.com/api/health/auth', {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 404) return { ok: false, message: 'Probe authentication or deployment is unavailable. Check the deployed route and matching probe secrets.' };
    if (response.status !== 200) return { ok: false, message: 'Production auth-provider readiness is unavailable. Follow the recovery runbook.' };
    const body = await response.json();
    return body?.status === 'ok'
      ? { ok: true, message: 'Production auth-provider readiness is healthy.' }
      : { ok: false, message: 'The readiness response is invalid. Check the deployment and recovery runbook.' };
  } catch {
    // Never echo raw errors, response bodies or authorization headers.
    return { ok: false, message: 'The production health probe could not complete. Check availability and the recovery runbook.' };
  }
}

async function main() {
  let result;
  for (let attempt = 0; attempt < 3; attempt++) {
    result = await checkAuthHealth(process.env.AUTH_HEALTH_CHECK_TOKEN);
    if (result.ok) break;
    if (attempt < 2) await delay(5000);
  }
  console.log(result.message);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Auth-provider readiness: ${result.ok ? 'healthy' : 'failed'}\n\n${result.message}\n\n[Recovery runbook](https://github.com/mycaatorg/Caat_V2/blob/main/docs/operations/auth-provider-health.md) · [Linear PROD-135](https://linear.app/purpl-solutions/issue/PROD-135)\n`);
  }
  if (!result.ok) {
    console.error('::error::CAAT auth-provider health check failed. See the run summary and recovery runbook.');
    process.exitCode = 1;
  }
}

module.exports = { checkAuthHealth };
if (require.main === module) main().catch(() => { console.error('Health monitor failed. See the recovery runbook.'); process.exitCode = 1; });
