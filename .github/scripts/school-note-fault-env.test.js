const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const env = { CAAT_ISOLATED_E2E:'1', E2E_TEST_EMAIL:'e2e.student@caat.local.test', E2E_TEST_PASSWORD:'synthetic-local-password', PLAYWRIGHT_BASE_URL:'http://127.0.0.1:3100', NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55431', NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon', CAAT_ISOLATED_STATUS_FILE:'/tmp/synthetic-status' };
const status = 'API_URL="http://127.0.0.1:55431"\nDB_URL="postgresql://postgres:synthetic@127.0.0.1:55432/postgres"\nANON_KEY="synthetic-anon"\n';
test('note fault reads CI status only inside Node without exported database credentials', async () => {
 const {schoolNoteFaultDatabase}=await import('../../caat-frontend/tests/staging/school-note-fault-env.mjs');
 let reads=0; const result=schoolNoteFaultDatabase(env, (path, encoding)=>{assert.equal(path,env.CAAT_ISOLATED_STATUS_FILE);assert.equal(encoding,'utf8');reads++;return status;});
 assert.equal(result.port,'55432');assert.equal(reads,1);assert.equal(env.SUPABASE_DB_URL,undefined);
});
test('note fault permits explicit matching disposable local settings',async()=>{
 const {schoolNoteFaultDatabase}=await import('../../caat-frontend/tests/staging/school-note-fault-env.mjs');
 const result=schoolNoteFaultDatabase({...env,CAAT_ISOLATED_STATUS_FILE:undefined,SUPABASE_DB_URL:'postgresql://postgres:synthetic@127.0.0.1:55432/postgres'},()=>{throw Error('unexpected file read');});
 assert.equal(result.port,'55432');
});
test('note fault rejects remote/mismatched/unisolated configuration before SQL',async()=>{
 const {schoolNoteFaultDatabase}=await import('../../caat-frontend/tests/staging/school-note-fault-env.mjs');
 for (const changed of [{CAAT_ISOLATED_E2E:'0'},{PLAYWRIGHT_BASE_URL:'https://mycaat.com'},{PLAYWRIGHT_BASE_URL:'http://127.0.0.1:3100/path'},{PLAYWRIGHT_BASE_URL:'http://user@127.0.0.1:3100'},{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321'},{NEXT_PUBLIC_SUPABASE_ANON_KEY:'wrong'}]) assert.throws(()=>schoolNoteFaultDatabase({...env,...changed},()=>status));
 for (const changed of [status.replace('127.0.0.1:55432','remote.example:55432'),status.replace(':55432',':54322'),status.replace('/postgres"','/other"')]) assert.throws(()=>schoolNoteFaultDatabase(env,()=>changed));
});
test('CI supplies only the status-file path to the browser step',()=>{
 const workflow=readFileSync('.github/workflows/ci.yml','utf8');
 const step=workflow.split('name: Production browser journeys (one build + server)')[1].split('- name:')[0];
 assert.match(step,/CAAT_ISOLATED_STATUS_FILE:.*runner.temp.*caat-supabase-status.env/);
 assert.doesNotMatch(step,/SUPABASE_DB_URL|SERVICE_ROLE_KEY/);
});
