import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDatabaseUrl, runLocalPsql } from './local-db.mjs';

const here = dirname(fileURLToPath(import.meta.url));
runLocalPsql(localDatabaseUrl(), ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261010130000_scholarship_search_matching.sql')]);
console.log('Local scholarship search migration applied.');
