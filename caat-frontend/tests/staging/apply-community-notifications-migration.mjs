import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDatabaseUrl, runLocalPsql } from './local-db.mjs';

// Idempotent (CREATE OR REPLACE, guarded constraint swap, REVOKE, metadata
// checks): safe on fresh and reused local stacks. Local-only; production
// needs an approved release step.
const here = dirname(fileURLToPath(import.meta.url));
runLocalPsql(localDatabaseUrl(), ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261007140000_community_notification_triggers.sql')]);
console.log('Local PROD-100 community notification triggers applied.');
