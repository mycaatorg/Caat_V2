import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLocalPsql, localDatabaseUrl, runLocalPsql } from './local-db.mjs';
import { assertEmptyPublicSchema } from './safety.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dbUrl = localDatabaseUrl();
const [{ schema }] = JSON.parse(await readFile(join(here, 'schema.snapshot.json'), 'utf8'));
const tables = schema.tables.map(({ name }) => `'${name.replaceAll("'", "''")}'`).join(', ');
const probe = `SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name IN (${tables})) THEN 'nonempty' ELSE 'empty' END`;
assertEmptyPublicSchema(checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', probe]));

runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, 'schema.sql')]);
const { spawnSync } = await import('node:child_process');
const migration = spawnSync(process.execPath, [join(here, 'apply-community-migration.mjs')], {
  stdio: 'inherit', env: process.env,
});
if (migration.error) throw migration.error;
if (migration.status !== 0) throw new Error('Local community migration failed.');
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, 'seed.sql')]);
console.log('Local-only CAAT schema and synthetic catalog fixtures installed.');
