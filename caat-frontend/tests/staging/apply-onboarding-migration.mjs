import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDatabaseUrl, runLocalPsql } from './local-db.mjs';

// Idempotent (IF NOT EXISTS / guarded constraints): safe on fresh and reused
// local stacks. Local-only; production needs an approved release step.
const here = dirname(fileURLToPath(import.meta.url));
runLocalPsql(localDatabaseUrl(), ['-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', join(here, '../../supabase/migrations/20261007100000_student_onboarding_profile_fields.sql')]);
console.log('Local PROD-73 onboarding profile fields applied.');
