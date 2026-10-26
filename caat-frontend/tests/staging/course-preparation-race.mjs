import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {localDatabaseUrl} from './local-db.mjs';
import {assertLocalApiUrl} from './safety.mjs';
const db=localDatabaseUrl();assertLocalApiUrl(process.env.SUPABASE_URL);
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{assert.ifError(r.error);return r.data;};
const user=ok(await admin.auth.admin.createUser({email:`e2e.prep-race.${randomUUID()}@caat.local.test`,email_confirm:true})).user.id;
const courseId=`race-${randomUUID()}`,sessions=[];
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
 const c=ok(await admin.from('course_offerings').insert({id:courseId,institution_key:'race',institution_name:'Fixture',program_code:courseId,name:'Race course',school_id:900001,prerequisites:'Maths',source_url:'https://example.edu'}).select('*').single());
 const app=ok(await admin.from('user_school_applications').insert({user_id:user,school_id:900001,status:'researching'}).select('id').single());
 ok(await admin.from('user_course_bookmarks').insert({user_id:user,course_id:courseId}));
 const snap=JSON.stringify({name:c.name,program_code:c.program_code,campus:null,school_id:900001,active:true,text:'Maths',url:null,source_url:'https://example.edu',source_year:null,verified_at:null});
 const auth=`BEGIN; SET LOCAL statement_timeout='10s'; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);`;
 const rpc=(action,revision)=>`SELECT id FROM public.save_course_preparation('${app.id}','${courseId}','prerequisites','${action}',${revision?`'${revision}'`:'NULL'},'${snap}'::jsonb);`;
 const init=session();await init.exec(auth+rpc('start'));await init.exec('COMMIT;');init.child.stdin.end();assert.equal((await init.done).code,0);
 const check=ok(await admin.from('course_preparation_checks').select('*').eq('application_id',app.id).single());
 // Two tabs share a revision. The second must reject after the first commits.
 const first=session(),second=session();await first.exec(auth+rpc('reviewed',check.revision));
 second.child.stdin.end(auth+rpc('reopen',check.revision)+'COMMIT;');
 await first.exec('COMMIT;');first.child.stdin.end();assert.equal((await first.done).code,0);
 const stale=await second.done;assert.notEqual(stale.code,0);assert.match(stale.stderr,/Preparation changed elsewhere/);
 const next=ok(await admin.from('course_preparation_checks').select('*').eq('id',check.id).single());
 // A provider update holds the row; queued reviewed action sees its new facts.
 const edit=session(),mark=session();await edit.exec(`BEGIN; UPDATE public.course_offerings SET prerequisites='Physics' WHERE id='${courseId}';`);
 mark.child.stdin.end(auth+rpc('reviewed',next.revision)+'COMMIT;');
 await edit.exec('COMMIT;');edit.child.stdin.end();assert.equal((await edit.done).code,0);
 const changed=await mark.done;assert.notEqual(changed.code,0);assert.match(changed.stderr,/Course information changed/);
 assert.equal(ok(await admin.from('course_preparation_checks').select('*').eq('id',check.id).single()).snapshot.text,'Maths');
 console.log('Concurrent preparation writes reject stale revision and unseen source facts; prior snapshot preserved.');
} finally {
 for(const s of sessions) if(s.child.exitCode===null){s.child.kill();await s.done;}
 await admin.from('user_school_applications').delete().eq('user_id',user);
 ok(await admin.auth.admin.deleteUser(user));ok(await admin.from('course_offerings').delete().eq('id',courseId));
}
