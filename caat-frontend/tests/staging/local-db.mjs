import { spawn, spawnSync } from 'node:child_process';
import { parseLocalDatabaseUrl } from './safety.mjs';

export function localDatabaseUrl() {
  return parseLocalDatabaseUrl(process.env.SUPABASE_DB_URL);
}

function psqlArgs(url, extraArgs) {
  return [
    '-X', '-h', url.hostname.replace(/^\[|\]$/g, ''), '-p', url.port,
    '-U', decodeURIComponent(url.username), '-d', decodeURIComponent(url.pathname.slice(1)),
    ...extraArgs,
  ];
}

function psqlEnv(url) {
  const env = { ...process.env, PGSSLMODE: 'disable' };
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  return env;
}

export function runLocalPsql(url, extraArgs) {
  const result = spawnSync('psql', psqlArgs(url, extraArgs), { stdio: 'inherit', env: psqlEnv(url) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Local psql command failed (exit ${result.status}).`);
}

export function checkLocalPsql(url, extraArgs) {
  const result = spawnSync('psql', psqlArgs(url, extraArgs), { encoding: 'utf8', env: psqlEnv(url) });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Local DB preflight failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

// Runs psql concurrently with the caller; resolves with its exit status and stderr.
export function startLocalPsql(url, extraArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', psqlArgs(url, extraArgs), { env: psqlEnv(url), stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stderr }));
  });
}
