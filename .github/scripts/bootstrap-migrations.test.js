const assert = require('node:assert/strict');
const test = require('node:test');
const {readdir} = require('node:fs/promises');
const {resolve} = require('node:path');
const prefix='../../supabase/migrations/';
const first='20261023070000_first.sql',second='20261024000000_second.sql';
const plan=[prefix+first,'seed-courses.sql',prefix+second];
const load=()=>import('../../caat-frontend/tests/staging/bootstrap-migrations.mjs');

test('bootstrap migration guard accepts exact ordered migrations interleaved with seeds',async()=>{
 const {validateMigrationPlan}=await load();
 assert.doesNotThrow(()=>validateMigrationPlan(plan,['20200101000000_baseline.sql',second,first]));
});
test('bootstrap migration guard detects future omitted migrations without changing the test',async()=>{
 const {validateMigrationPlan}=await load();
 assert.throws(()=>validateMigrationPlan(plan,[first,second,'20990101000000_new_feature.sql']),/migration plan/i);
});
test('bootstrap migration guard rejects duplicates, wrong order, nonexistent files and unknown steps',async()=>{
 const {validateMigrationPlan}=await load();
 for(const broken of [[...plan,prefix+second],[prefix+second,prefix+first],[prefix+first,prefix+'20990101000000_missing.sql'],[...plan,'unexpected.sql']]){
  assert.throws(()=>validateMigrationPlan(broken,[first,second]),/migration plan/i);
 }
});
test('actual bootstrap plan includes every post-baseline repository migration exactly once in order',async()=>{
 const {postBaselineSteps,validateMigrationPlan}=await load();
 const files=await readdir(resolve(__dirname,'../../caat-frontend/supabase/migrations'));
 assert.doesNotThrow(()=>validateMigrationPlan(postBaselineSteps,files));
});
