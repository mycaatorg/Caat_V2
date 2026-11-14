const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflowPath = path.join(__dirname, '../workflows/production-release.yml');

test('production verification is restricted to successful same-repo main pushes or main dispatch', () => {
  const text = fs.readFileSync(workflowPath, 'utf8');
  for (const guard of ["github.repository == 'mycaatorg/Caat_V2'", "github.event.workflow_run.conclusion == 'success'", "github.event.workflow_run.event == 'push'", "github.event.workflow_run.head_branch == 'main'", 'github.event.workflow_run.head_repository.full_name == github.repository', "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"]) assert.ok(text.includes(guard), guard);
  assert.match(text, /workflow_run:\s+workflows: \[CI\]\s+types: \[completed\]\s+branches: \[main\]/);
  assert.match(text, /permissions:\s+contents: read/);
  assert.doesNotMatch(text, /pull_request_target|contents: write|id-token: write/);
  assert.match(text, /ref: \$\{\{ github.event.workflow_run.head_sha \|\| github.sha \}\}/);
  assert.match(text, /persist-credentials: false/);
  const uses = [...text.matchAll(/uses:\s+([^\n]+)/g)].map(match => match[1]);
  assert.ok(uses.length >= 3);
  for (const use of uses) assert.match(use, /^[\w/-]+@[a-f0-9]{40}(?:\s|$)/);
});
test('release checks bracket public-only browser coverage without leaking the probe secret into browsers', () => {
  const text = fs.readFileSync(workflowPath, 'utf8');
  const before = text.indexOf('run: node .github/scripts/release-health-check.js --wait');
  const browser = text.indexOf('run: npx playwright test public-smoke.spec.ts route-guard.spec.ts --project=public-smoke --retries=0');
  const after = text.indexOf('run: node .github/scripts/release-health-check.js\n', browser);
  assert.ok(before >= 0 && browser > before && after > browser);
  assert.match(text, /!cancelled\(\) && steps.release_ready.outcome == 'success'/);
  const browserStep = text.slice(text.lastIndexOf('      - name:', browser), text.indexOf('      - name:', browser));
  assert.doesNotMatch(browserStep, /AUTH_HEALTH_CHECK_TOKEN|SUPABASE|storageState/);
  assert.match(browserStep, /PLAYWRIGHT_BASE_URL: https:\/\/mycaat.com/);
  assert.doesNotMatch(text, /SUPABASE_SERVICE_ROLE|VERCEL_TOKEN|staging-journeys|test:e2e:ci/);
  assert.equal((text.match(/secrets\.AUTH_HEALTH_CHECK_TOKEN/g) || []).length, 2);
});

test('hosted apt mirror mutation uses the established narrowly preserved sudo environment', () => {
  const text = fs.readFileSync(workflowPath, 'utf8');
  const step = text.match(/- name: Prefer Ubuntu archive for browser dependencies\n\s+run: ([^\n]+)/);
  assert.ok(step, 'hosted mirror step exists');
  assert.equal(step[1], 'sudo --preserve-env=GITHUB_ACTIONS,RUNNER_ENVIRONMENT "$(command -v node)" .github/scripts/prefer-ubuntu-archive.js');
  assert.ok(fs.existsSync(path.join(__dirname, 'prefer-ubuntu-archive.js')));
});
