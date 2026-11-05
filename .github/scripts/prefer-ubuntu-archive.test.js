const assert = require('node:assert/strict');
const { test } = require('node:test');
const { preferUbuntuArchive, assertHostedRunner } = require('./prefer-ubuntu-archive.js');
const azure = 'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1';
const archive = 'https://archive.ubuntu.com/ubuntu/\tpriority:2';
const security = 'https://security.ubuntu.com/ubuntu/\tpriority:3';
const source = `${azure}\n${archive}\n${security}\n`;

test('prefers the existing HTTPS archive and keeps both fallbacks', () => {
  assert.equal(preferUbuntuArchive(source), `${azure.replace('priority:1', 'priority:2')}\n${archive.replace('priority:2', 'priority:1')}\n${security}\n`);
});
test('preserves comments, blank lines and final newline exactly', () => {
  const annotated = `# Runner defaults\n\n${source}\n`;
  assert.equal(preferUbuntuArchive(annotated), `# Runner defaults\n\n${preferUbuntuArchive(source)}\n`);
});
test('is idempotent', () => {
  const preferred = preferUbuntuArchive(source);
  assert.equal(preferUbuntuArchive(preferred), preferred);
});
test('does not guess at changed, missing, duplicated or restricted mirror layouts', () => {
  for (const input of ['', source.replace(archive, ''), source.replace('priority:1', 'priority:0'), `${source}${azure}\n`, `${source}https://another.example/ubuntu/\tpriority:0\n`, source.replace(archive, `${archive} arch:amd64`)]) {
    assert.equal(preferUbuntuArchive(input), input);
  }
});
test('requires both GitHub Actions and a GitHub-hosted runner', () => {
  assert.doesNotThrow(() => assertHostedRunner({ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' }));
  for (const env of [{}, {GITHUB_ACTIONS:'true'}, {GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'self-hosted'}, {GITHUB_ACTIONS:'false',RUNNER_ENVIRONMENT:'github-hosted'}]) {
    assert.throws(() => assertHostedRunner(env), /GitHub-hosted/);
  }
});
