import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDatabaseUrl, runLocalPsql } from './local-db.mjs';

// Idempotent (ALTER FUNCTION ... SET is repeatable): safe on fresh and reused
// local stacks. Local-only; production needs an approved release step.
const here = dirname(fileURLToPath(import.meta.url));
runLocalPsql(localDatabaseUrl(), ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261007150000_delete_post_children_search_path.sql')]);
console.log('Local PROD-101 delete_post_children search_path pinned.');
