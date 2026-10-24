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
const onboarding = spawnSync(process.execPath, [join(here, 'apply-onboarding-migration.mjs')], {
  stdio: 'inherit', env: process.env,
});
if (onboarding.error) throw onboarding.error;
if (onboarding.status !== 0) throw new Error('Local onboarding migration failed.');
const search = spawnSync(process.execPath, [join(here, 'apply-search-migration.mjs')], {
  stdio: 'inherit', env: process.env,
});
if (search.error) throw search.error;
if (search.status !== 0) throw new Error('Local scholarship search migration failed.');
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, 'seed.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261023070000_course_offerings.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261024090000_scholarship_source_checks.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261024100000_scholarship_bookmark_update_policy.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, 'seed-courses.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261024110000_scholarship_attachments.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261024120000_application_evidence_links.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261024130000_scholarship_attachment_integrity.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261024140000_evidence_source_versions.sql')]);
runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, 'seed-opportunities.sql')]);
console.log('Local-only CAAT schema and synthetic catalog fixtures installed.');
