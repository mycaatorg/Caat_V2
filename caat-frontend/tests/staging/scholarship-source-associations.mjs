// PROD-278: real atomic service RPC and private history, loopback fixtures only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {assertLocalApiUrl} from './safety.mjs';
import {localDatabaseUrl,checkLocalPsql} from './local-db.mjs';
import {createSupabaseStore} from '../../scripts/refresh-scholarship-sources.mjs';
assertLocalApiUrl(process.env.SUPABASE_URL);
const db=localDatabaseUrl(),q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=x=>checkLocalPsql(db,['-A','-t','-v','ON_ERROR_STOP=1','-c',x]);
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
const anon=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options);
const student=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,options);
const ok=r=>{assert.ifError(r.error);return r.data;};
const suffix=randomUUID().replaceAll('-',''),ids=[randomUUID(),randomUUID()];
const page=`https://source-association-${suffix}.invalid/awards`;
const rows=ids.map((id,i)=>({id,external_url:`${page}#award-${i}`}));
const covered=rows.map(r=>({id:r.id,source_url:r.external_url}));
const created=ok(await admin.auth.admin.createUser({email:`source-association-${suffix}@caat.local.test`,password:`${suffix}-Aa1`,email_confirm:true})).user;
let runId,failure;
const trigger=`source_association_fault_${suffix}`;
const checkCounts=()=>sql(`SELECT count(*) FROM public.scholarship_source_checks WHERE run_id=${q(runId)}`);
const linkCounts=()=>sql(`SELECT count(*) FROM public.scholarship_source_check_rows r JOIN public.scholarship_source_checks c ON c.id=r.check_id WHERE c.run_id=${q(runId)}`);
try {
 ok(await student.auth.signInWithPassword({email:created.email,password:`${suffix}-Aa1`}));
 ok(await admin.from('scholarships').insert(rows.map((r,i)=>({...r,slug:`source-association-${suffix}-${i}`,title:`Synthetic award ${i}`,provider_name:'Synthetic provider',is_active:true,last_verified_at:'2026-01-01',source_last_synced_at:'2026-01-01'}))));
 runId=ok(await admin.from('scholarship_import_runs').insert({status:'started'}).select('id').single()).id;
 const check={run_id:runId,url:page,http_status:200,final_url:page,content_hash:'synthetic-hash',outcome:'baseline',checked_at:'2999-01-01'};
 const before=ok(await admin.from('scholarships').select('*').in('id',ids).order('id'));
 const recorded=await createSupabaseStore(admin).recordCheck(check,rows);
 assert.ok(recorded.id);assert.ok(Date.parse(recorded.checked_at)>Date.now()-60000,'database clock');
 assert.ok(Date.parse(recorded.checked_at)<Date.now()+60000,'caller cannot supply a future timestamp');
 const links=ok(await admin.from('scholarship_source_check_rows').select('*').eq('check_id',recorded.id));
 assert.equal(links.length,2);
 for(const row of rows)assert.equal(links.find(l=>l.scholarship_id===row.id).source_url,row.external_url);
 assert.deepEqual(ok(await admin.from('scholarships').select('*').in('id',ids).order('id')),before,'no award facts/timestamps change');
 assert.equal(checkCounts(),'1');assert.equal(linkCounts(),'2');
 for(const [name,client] of [['anon',anon],['student',student]]){
  assert.ok((await client.from('scholarship_source_check_rows').select('*')).error,`${name} cannot read`);
  assert.ok((await client.from('scholarship_source_check_rows').insert({check_id:recorded.id,scholarship_id:ids[0],source_url:rows[0].external_url})).error,`${name} cannot insert`);
  assert.ok((await client.from('scholarship_source_check_rows').update({source_url:'https://wrong.invalid'}).eq('check_id',recorded.id)).error,`${name} cannot update`);
  assert.ok((await client.from('scholarship_source_check_rows').delete().eq('check_id',recorded.id)).error,`${name} cannot delete`);
  assert.ok((await client.rpc('record_scholarship_source_check',{p_check:check,p_rows:covered})).error,`${name} cannot record`);
 }
 const reject=async(p_rows,p_check=check)=>{
  const checks=checkCounts(),links=linkCounts();
  assert.ok((await admin.rpc('record_scholarship_source_check',{p_check,p_rows})).error,'invalid request fails');
  assert.equal(checkCounts(),checks,'failed operation leaves no check');
  assert.equal(linkCounts(),links,'failed operation leaves no partial links');
 };
 for(const invalid of [null,{},[],[null],[{}],[{id:ids[0],source_url:null}],[covered[0],covered[0]],[{...covered[0],id:randomUUID()}],Array(5001).fill(covered[0])])await reject(invalid);
 await reject(covered,null);
 await reject(covered,{...check,run_id:randomUUID()});
 await reject(covered,{...check,outcome:'invalid'});
 ok(await admin.from('scholarships').update({external_url:`${page}/moved`}).eq('id',ids[1]));await reject(covered);
 assert.equal(ok(await admin.from('scholarship_source_check_rows').select('source_url').eq('check_id',recorded.id).eq('scholarship_id',ids[1]).single()).source_url,rows[1].external_url,'history keeps original URL');
 ok(await admin.from('scholarships').update({external_url:rows[1].external_url,is_active:false}).eq('id',ids[1]));await reject(covered);
 ok(await admin.from('scholarships').update({is_active:true}).eq('id',ids[1]));
 // Fail the second link after inserting the check and first link: all must roll back.
 sql(`CREATE FUNCTION public.${trigger}() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'synthetic association failure'; END $$;
 CREATE TRIGGER ${trigger} BEFORE INSERT ON public.scholarship_source_check_rows FOR EACH ROW WHEN (NEW.scholarship_id=${q(ids[1])}::uuid) EXECUTE FUNCTION public.${trigger}();`);
 await reject(covered);
 sql(`DROP TRIGGER ${trigger} ON public.scholarship_source_check_rows; DROP FUNCTION public.${trigger}();`);
 assert.equal((await admin.from('scholarship_source_checks').delete().eq('id',recorded.id)).error?.code,'23503','associated checks cannot be deleted');
 ok(await admin.from('scholarships').delete().eq('id',ids[1]));
 assert.equal(linkCounts(),'1','scholarship deletion removes only its association');assert.equal(checkCounts(),'1');
 await reject(covered);
 console.log('PROD-278: atomic multi-award recording, private roles, drift/input failures, rollback and retained history passed.');
}catch(e){failure=e;}finally{
 const errors=failure?[failure]:[];
 const cleanup=async action=>{try{await action();}catch(e){errors.push(e);}};
 await cleanup(()=>sql(`DROP TRIGGER IF EXISTS ${trigger} ON public.scholarship_source_check_rows; DROP FUNCTION IF EXISTS public.${trigger}();`));
 if(runId){
  await cleanup(()=>sql(`DELETE FROM public.scholarship_source_check_rows r USING public.scholarship_source_checks c WHERE r.check_id=c.id AND c.run_id=${q(runId)}`));
  await cleanup(async()=>ok(await admin.from('scholarship_source_checks').delete().eq('run_id',runId)));
  await cleanup(async()=>ok(await admin.from('scholarship_import_runs').delete().eq('id',runId)));
 }
 await cleanup(async()=>ok(await admin.from('scholarships').delete().in('id',ids)));
 await cleanup(async()=>ok(await student.auth.signOut()));
 await cleanup(async()=>ok(await admin.auth.admin.deleteUser(created.id)));
 if(errors.length)throw new AggregateError(errors,'PROD-278 check or cleanup failed');
}
