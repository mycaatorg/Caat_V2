// PROD-277: real migration regression against disposable loopback-only fixtures.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {assertLocalApiUrl} from './safety.mjs';
import {localDatabaseUrl,checkLocalPsql} from './local-db.mjs';

assertLocalApiUrl(process.env.SUPABASE_URL);
const db=localDatabaseUrl();
const migration=fileURLToPath(new URL('../../supabase/migrations/20261115010000_exchange_achievement_source_repair.sql',import.meta.url));
readFileSync(migration);
const target='1b720943-1f37-49e5-b45d-8877d79a483e';
const source='c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a';
const oldUrl='https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1048';
const newUrl='https://www.scholarships.unsw.edu.au/scholarships/id/2001';
const unrelated=randomUUID();
const otherSource=randomUUID();
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const sql=s=>checkLocalPsql(db,['-A','-t','-v','ON_ERROR_STOP=1','-c',s]);
const apply=()=>checkLocalPsql(db,['-v','ON_ERROR_STOP=1','-f',migration]);
const ids=[target,unrelated].map(q).join(',');
assert.equal(sql(`SELECT count(*) FROM public.scholarships WHERE id IN (${ids})`),'0','refuse to overwrite existing IDs');
const sourceExists=sql(`SELECT count(*) FROM public.scholarship_sources WHERE id=${q(source)}`)==='1';
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const created=await admin.auth.admin.createUser({email:`exchange-repair-${randomUUID()}@caat.local.test`,password:`${randomUUID()}-Aa1`,email_confirm:true});
assert.ifError(created.error);
const owner=created.data.user.id;
let inserted=false,failure;
const snapshot=()=>JSON.parse(sql(`SELECT json_agg(s ORDER BY id) FROM (SELECT * FROM public.scholarships WHERE id IN (${ids})) s`));
const saves=()=>JSON.parse(sql(`SELECT json_agg(b ORDER BY scholarship_id) FROM (SELECT * FROM public.user_bookmarked_scholarships WHERE user_id=${q(owner)}) b`));
const protectedFields=row=>Object.fromEntries(Object.entries(row).filter(([k])=>!['external_url','raw_payload','updated_at'].includes(k)));
try {
 apply();
 assert.equal(sql(`SELECT count(*) FROM public.scholarships WHERE id IN (${ids})`),'0','missing target is a no-op');
 sql(`BEGIN;
 INSERT INTO public.scholarship_sources(id,slug,name,source_type) VALUES (${q(source)},'prod277-unsw','Synthetic UNSW','official_site') ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.scholarship_sources(id,slug,name,source_type) VALUES (${q(otherSource)},${q(`prod277-${otherSource}`)},'Other source','official_site');
 INSERT INTO public.scholarships(id,source_id,external_id,external_url,slug,title,provider_name,description,amount_value,amount_currency,deadline_at,source_last_synced_at,last_verified_at,raw_payload)
 VALUES (${q(target)},${q(source)},'UGTR1048',${q(oldUrl)},'prod277-target','UNSW Student Exchange Achievement Award','Synthetic UNSW','Protected recorded facts',5000,'AUD','2026-05-01','2026-05-01','2026-05-01','{"retain":"original evidence"}'),
 (${q(unrelated)},${q(source)},${q(unrelated)},'https://example.invalid/other','prod277-unrelated','Other award','Synthetic UNSW','Unrelated',1,'AUD','2026-05-01','2026-05-01','2026-05-01','{}');
 INSERT INTO public.user_bookmarked_scholarships(user_id,scholarship_id,status) SELECT ${q(owner)}::uuid,id,'applied' FROM public.scholarships WHERE id IN (${ids});
 COMMIT;`);
 inserted=true;
 const before=snapshot(),savedBefore=saves();
 apply();
 const after=snapshot(),original=before.find(r=>r.id===target),updated=after.find(r=>r.id===target);
 assert.equal(updated.external_url,newUrl,'the broken link must be repaired');
 assert.deepEqual(protectedFields(updated),protectedFields(original),'award facts, identity and freshness dates preserved');
 assert.equal(updated.raw_payload.retain,'original evidence');
 assert.equal(updated.raw_payload.source_url_repair.issue,'PROD-277');
 assert.equal(updated.raw_payload.source_url_repair.previous_url,oldUrl);
 assert.equal(updated.raw_payload.source_url_repair.replacement_url,newUrl);
 assert.deepEqual(after.find(r=>r.id===unrelated),before.find(r=>r.id===unrelated),'unrelated row untouched');
 assert.deepEqual(saves(),savedBefore,'all bookmarks and statuses preserved');
 apply();assert.deepEqual(snapshot(),after,'replay does not even change timestamps');
 const cases=[
  `source_id=${q(otherSource)}`,
  "external_id='different-award'", "title='Different title'", 'is_active=false',
  'external_url=NULL', "external_url='https://example.invalid/unreviewed'",
  "raw_payload='[]'::jsonb", "raw_payload='\"scalar\"'::jsonb",
  "raw_payload='{\"source_url_repair\":{\"issue\":\"prior-audit\"}}'::jsonb",
  `external_url=${q(newUrl)}`,
  `external_url=${q(newUrl)},raw_payload=${q(JSON.stringify({source_url_repair:{issue:'PROD-277',previous_url:'unexpected',replacement_url:newUrl}}))}::jsonb`,
  `external_url=${q(newUrl)},raw_payload=${q(JSON.stringify({source_url_repair:{issue:'PROD-277',previous_url:oldUrl,replacement_url:'unexpected'}}))}::jsonb`,
 ];
 for(const drift of cases){
  sql(`UPDATE public.scholarships SET source_id=${q(source)},external_id='UGTR1048',title='UNSW Student Exchange Achievement Award',is_active=true,external_url=${q(oldUrl)},raw_payload='{"retain":"original evidence"}' WHERE id=${q(target)}; UPDATE public.scholarships SET ${drift} WHERE id=${q(target)};`);
  const changed=snapshot();assert.throws(apply,/PROD-277.*drift/i,drift);
  assert.deepEqual(snapshot(),changed,'guard failure is atomic');
  assert.deepEqual(saves(),savedBefore);
 }
 sql(`UPDATE public.scholarships SET raw_payload=NULL,external_url=${q(oldUrl)} WHERE id=${q(target)}`);
 apply();assert.equal(snapshot().find(r=>r.id===target).raw_payload.source_url_repair.issue,'PROD-277','null payload can acquire an audit object');
 console.log('PROD-277: source repair, protected fields/bookmarks, no-op replay, absent target and atomic drift guards passed.');
}catch(e){failure=e;}finally{
 const errors=failure?[failure]:[];
 const cleanup=async action=>{try{await action();}catch(e){errors.push(e);}};
 await cleanup(()=>{if(inserted){sql(`DELETE FROM public.scholarships WHERE id IN (${ids})`);assert.equal(sql(`SELECT count(*) FROM public.scholarships WHERE id IN (${ids})`),'0');}});
 await cleanup(()=>{if(!sourceExists)sql(`DELETE FROM public.scholarship_sources WHERE id=${q(source)} AND slug='prod277-unsw'`);});
 await cleanup(()=>{if(inserted)sql(`DELETE FROM public.scholarship_sources WHERE id=${q(otherSource)}`);});
 await cleanup(async()=>{assert.ifError((await admin.auth.admin.deleteUser(owner)).error);});
 if(errors.length)throw new AggregateError(errors,'PROD-277 check or cleanup failed');
}
