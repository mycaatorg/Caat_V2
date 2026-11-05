const fs = require('node:fs');

// GitHub's hosted Ubuntu image currently supplies this exact mirror metadata.
// Lower priorities run first; retain every existing URL and both fallbacks.
const AZURE = 'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1';
const ARCHIVE = 'https://archive.ubuntu.com/ubuntu/\tpriority:2';
const SECURITY = 'https://security.ubuntu.com/ubuntu/\tpriority:3';

function preferUbuntuArchive(source) {
  const lines = source.split('\n');
  const mirrors = lines.filter(line => line.trim() && !line.trimStart().startsWith('#'));
  if (mirrors.length !== 3 || ![AZURE, ARCHIVE, SECURITY].every(line => mirrors.includes(line))) return source;
  return lines.map(line => line === AZURE ? AZURE.replace('priority:1', 'priority:2')
    : line === ARCHIVE ? ARCHIVE.replace('priority:2', 'priority:1') : line).join('\n');
}

function assertHostedRunner(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.RUNNER_ENVIRONMENT !== 'github-hosted') {
    throw new Error('This helper is only for a disposable GitHub-hosted runner.');
  }
}

if (require.main === module) {
  assertHostedRunner(process.env);
  const path = '/etc/apt/apt-mirrors.txt';
  if (!fs.existsSync(path)) {
    console.log('No hosted mirror list; keeping runner defaults.');
  } else {
    const source = fs.readFileSync(path, 'utf8');
    const preferred = preferUbuntuArchive(source);
    if (preferred === source) {
      console.log('Mirror priorities already changed or layout unknown; keeping runner defaults.');
    } else {
      fs.writeFileSync(path, preferred);
      console.log('Prefer the existing HTTPS Ubuntu archive; Azure and security fallbacks retained.');
    }
  }
}

module.exports = { preferUbuntuArchive, assertHostedRunner };
