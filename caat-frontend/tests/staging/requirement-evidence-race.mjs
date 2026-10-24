// Real concurrent transactions, exclusively on the disposable loopback stack.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDatabaseUrl } from './local-db.mjs';
import { assertLocalApiUrl } from './safety.mjs';

const db = localDatabaseUrl();
assertLocalApiUrl(process.env.SUPABASE_URL);
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = r => { assert.ifError(r.error); return r.data; };
const user = ok(await admin.auth.admin.createUser({ email: `e2e.requirement-race.${randomUUID()}@caat.local.test`, email_confirm: true })).user.id;
const scholarship = 'e2000000-0000-4000-8000-0000000000a1';
const otherSchool = 990000 + Math.floor(Math.random() * 1000000);
const sessions = [];

function session() {
  const child = spawn('psql', ['-X', '-q', '-A', '-t', '-h', db.hostname, '-p', db.port, '-U', decodeURIComponent(db.username), '-d', db.pathname.slice(1), '-v', 'ON_ERROR_STOP=1'], {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(db.password), PGSSLMODE: 'disable' },
  });
  let stdout = '', stderr = '', pending;
  const done = new Promise(resolve => child.on('exit', code => {
    if (pending) pending.reject(new Error(stderr));
    resolve({ code, stderr });
  }));
  child.stdout.on('data', chunk => {
    stdout += chunk;
    if (pending && stdout.includes(pending.marker)) { pending.resolve(); pending = null; }
  });
  child.stderr.on('data', chunk => { stderr += chunk; });
  const exec = sql => new Promise((resolve, reject) => {
    const marker = randomUUID();
    pending = { marker, resolve, reject };
    child.stdin.write(sql + `\n\\echo ${marker}\n`);
  });
  const s = { child, done, exec };
  sessions.push(s);
  return s;
}

try {
  ok(await admin.from('schools').insert({ id: otherSchool, name: 'Synthetic requirement race university', country: 'Australia', institution_type: 'university' }));
  const app=ok(await admin.from('user_school_applications').insert({user_id:user,school_id:900001,status:'researching'}).select('id').single());
  ok(await admin.from('user_school_applications').insert({user_id:user,school_id:otherSchool,status:'researching'}));
  const item=ok(await admin.from('evidence_items').insert({user_id:user,kind:'award',title:'Race fixture'}).select('id').single());
  const source=ok(await admin.from('application_evidence_links').insert({user_id:user,application_id:app.id,kind:'item',evidence_item_id:item.id}).select('id').single());
  for(const operation of ['detach','move']) {
    ok(await admin.from('user_bookmarked_scholarships').delete().eq('user_id',user));
    ok(await admin.from('user_bookmarked_scholarships').insert({user_id:user,scholarship_id:scholarship,school_id:900001,status:'interested'}));
    const moving=session(), linking=session();
    const auth=`BEGIN; SET LOCAL statement_timeout='10s'; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);`;
    await moving.exec(auth+`UPDATE public.user_bookmarked_scholarships SET school_id=${operation==='detach'?'NULL':otherSchool} WHERE user_id='${user}' AND scholarship_id='${scholarship}';`);
    await linking.exec(auth+`INSERT INTO public.requirement_evidence_links(user_id,application_id,school_id,scholarship_id,item_key,requirement_label,evidence_link_id) VALUES('${user}','${app.id}',900001,'${scholarship}','essay','Essay required','${source.id}');`);
    linking.child.stdin.end('COMMIT;\n');
    await moving.exec('COMMIT;'); moving.child.stdin.end();
    assert.equal((await moving.done).code,0);
    const result=await linking.done;
    assert.notEqual(result.code,0,'concurrent stale link must fail');
    assert.match(result.stderr,/foreign key constraint/,'relationship integrity, not timeout');
    assert.deepEqual(ok(await admin.from('requirement_evidence_links').select('id').eq('user_id',user)),[]);
    assert.equal(ok(await admin.from('application_evidence_links').select('id').eq('id',source.id)).length,1);
  }
  console.log('Concurrent requirement link/detach and link/move reject stale associations and preserve source work.');
} finally {
  for(const s of sessions) if(s.child.exitCode===null){s.child.kill();await s.done;}
  ok(await admin.from('user_bookmarked_scholarships').delete().eq('user_id',user));
  ok(await admin.from('application_evidence_links').delete().eq('user_id',user));
  ok(await admin.from('evidence_items').delete().eq('user_id',user));
  ok(await admin.from('user_school_applications').delete().eq('user_id',user));
  ok(await admin.auth.admin.deleteUser(user));
  ok(await admin.from('schools').delete().eq('id',otherSchool));
}
