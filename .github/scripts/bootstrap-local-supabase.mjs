import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const frontendRoot = resolve(repoRoot, 'caat-frontend');

export function parseStatusEnv(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replaceAll('\\"', '"');
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

function requireLoopback(value, label, ports) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} from local Supabase status is malformed.`);
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || !ports.includes(parsed.port)) {
    throw new Error(`${label} must be a loopback URL on one of the expected local Supabase ports.`);
  }
  return parsed;
}

export function validateStatus(values) {
  for (const key of ['API_URL', 'DB_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
    if (!values[key]) throw new Error(`Local Supabase status omitted ${key}.`);
  }
  requireLoopback(values.API_URL, 'API_URL', ['55431', '54321']);
  const db = new URL(values.DB_URL);
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) || !['55432', '54322'].includes(db.port)) {
    throw new Error('DB_URL must target loopback port 55432 or 54322.');
  }
  return values;
}

export function githubPublicEnv(values) {
  validateStatus(values);
  return `NEXT_PUBLIC_SUPABASE_URL=${values.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${values.ANON_KEY}\n`;
}

function run(script, env) {
  const result = spawnSync(process.execPath, [resolve(frontendRoot, script)], {
    cwd: frontendRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status}.`);
}

async function main() {
  const statusFile = process.argv[2];
  if (!statusFile) throw new Error('Pass the file containing `supabase status --output env` output.');
  if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required so the browser job can use local public Supabase settings.');
  if (!process.env.E2E_TEST_PASSWORD) throw new Error('E2E_TEST_PASSWORD must be set to the disposable local test password.');

  const local = validateStatus(parseStatusEnv(await readFile(statusFile, 'utf8')));
  const childBase = { PATH: process.env.PATH, HOME: process.env.HOME };
  const localOnlyEnv = {
    ...childBase,
    SUPABASE_DB_URL: local.DB_URL,
    SUPABASE_URL: local.API_URL,
    SUPABASE_ANON_KEY: local.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD,
  };
  run('tests/staging/setup-local.mjs', localOnlyEnv);
  run('tests/staging/rls-smoke.mjs', localOnlyEnv);
  run('tests/staging/community-rls.mjs', localOnlyEnv);
  run('tests/staging/document-status-rls.mjs', localOnlyEnv);
  const githubEnv = githubPublicEnv(local);
  const { appendFile } = await import('node:fs/promises');
  await appendFile(process.env.GITHUB_ENV, githubEnv);
  process.stdout.write('Synthetic schema/users/catalog installed in isolated loopback Supabase; only local public URL and anon key exported to later app steps.\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
