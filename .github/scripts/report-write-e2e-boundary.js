const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'caat-frontend/tests/e2e/route-coverage.json'), 'utf8'),
);

function buildSummary(data = manifest) {
  const isolated = data.writeJourneys.filter((journey) => journey.coverage === 'isolated-ci');
  const partial = data.writeJourneys.filter((journey) => journey.coverage === 'partial-isolated-ci');
  const manual = data.writeJourneys.filter((journey) => journey.coverage === 'manual-isolated-only');
  const uncovered = data.writeJourneys.filter((journey) => journey.coverage === 'not-covered');
  const lines = [
    '### Write-flow E2E coverage boundary',
    '',
    'Authenticated browser and write journeys run only against a disposable local Supabase stack on loopback. The workflow builds that stack from synthetic schema/data and exports only its local URL and anon key to the app build; production Supabase credentials are not used.',
    '',
    '**Journeys configured for the PR browser job (results are reported by the job check):**',
  ];
  for (const journey of isolated) {
    lines.push(`- \`${journey.id}\`: ${journey.reason} Specs: ${journey.specs.map((spec) => `\`${spec}\``).join(', ')}.`);
  }
  lines.push('', '**Partial isolated write coverage in the PR browser job:**');
  for (const journey of partial) {
    lines.push(`- \`${journey.id}\`: ${journey.reason} Specs: ${journey.specs.map((spec) => `\`${spec}\``).join(', ')}.`);
  }
  lines.push('', '**Manual isolated-database suite only:**');
  for (const journey of manual) {
    lines.push(`- \`${journey.id}\`: ${journey.reason} Specs: ${journey.specs.map((spec) => `\`${spec}\``).join(', ')}.`);
  }
  lines.push('', '**Not yet covered by a successful write-flow E2E:**');
  for (const journey of uncovered) {
    const specs = journey.specs.length ? ` Related specs: ${journey.specs.map((spec) => `\`${spec}\``).join(', ')}.` : '';
    lines.push(`- \`${journey.id}\`: ${journey.reason}${specs}`);
  }
  return `${lines.join('\n')}\n`;
}

const summary = buildSummary();
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
  process.stdout.write(summary);
}

module.exports = { buildSummary };
