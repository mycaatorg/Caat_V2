import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLocalPsql, localDatabaseUrl, runLocalPsql } from './local-db.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dbUrl = localDatabaseUrl();
const marker = checkLocalPsql(dbUrl, ['-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `
select case
  when to_regprocedure('public.approve_group_join_request(uuid,uuid)') is null then 'absent'
  when exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'community_posts' and policyname = 'posts_select'
      and qual like '%can_access_community_group%'
  ) and exists (
    select 1 from pg_trigger where tgname = 'trg_community_add_creator_membership'
      and not tgisinternal
  ) then 'applied'
  else 'partial'
end;
`]);
if (marker === 'partial') throw new Error('Local community migration metadata is incomplete; refusing to continue.');
if (marker === 'absent' || process.argv[2] === '--reapply') {
  runLocalPsql(dbUrl, ['-v', 'ON_ERROR_STOP=1', '-f', join(here, '../../supabase/migrations/20261004090000_secure_community_groups_and_content.sql')]);
  console.log('Local PROD-85 community migration applied.');
} else {
  console.log('Local PROD-85 community migration already applied.');
}
