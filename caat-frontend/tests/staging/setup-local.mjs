import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const run = (script) => {
  const result = spawnSync(process.execPath, [join(here, script)], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed (exit ${result.status}).`);
};
run('generate-schema.mjs');
run('bootstrap-local.mjs');
run('seed-users.mjs');
run('seed-user-fixtures.mjs');
console.log('Disposable local CAAT Supabase is ready for staging journeys.');
