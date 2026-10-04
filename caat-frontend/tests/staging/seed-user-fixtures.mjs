import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDatabaseUrl, runLocalPsql } from './local-db.mjs';

const here = dirname(fileURLToPath(import.meta.url));
runLocalPsql(localDatabaseUrl(), ['-v', 'ON_ERROR_STOP=1', '-f', join(here, 'seed-user-fixtures.sql')]);
console.log('Synthetic community group fixture created for the local E2E student.');
