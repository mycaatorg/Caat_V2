import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDatabaseUrl, runLocalPsql } from './local-db.mjs';

// Idempotent (CREATE OR REPLACE / DROP IF EXISTS): safe on fresh and reused
// local stacks. Local-only; production needs an approved release step.
const here = dirname(fileURLToPath(import.meta.url));
runLocalPsql(localDatabaseUrl(), ['-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', join(here, '../../supabase/migrations/20261007120000_document_status_integrity.sql')]);
console.log('Local PROD-94 document status guard applied.');
