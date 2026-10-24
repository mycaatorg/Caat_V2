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
const user = ok(await admin.auth.admin.createUser({ email: `e2e.attach-race.${randomUUID()}@caat.local.test`, email_confirm: true })).user.id;
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
  ok(await admin.from('schools').insert({ id: otherSchool, name: 'Synthetic attachment race university', country: 'Australia', institution_type: 'university' }));
  for (const operation of ['delete', 'move']) {
    ok(await admin.from('user_school_applications').delete().eq('user_id', user));
    ok(await admin.from('user_bookmarked_scholarships').delete().eq('user_id', user));
    const app = ok(await admin.from('user_school_applications').insert({ user_id: user, school_id: 900001, status: 'researching' }).select('id').single());
    ok(await admin.from('user_bookmarked_scholarships').insert({ user_id: user, scholarship_id: scholarship, status: 'interested' }));
    const removing = session(), attaching = session();
    const auth = `BEGIN; SET LOCAL statement_timeout='10s'; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${user}',true);`;
    const mutation = operation === 'delete'
      ? `DELETE FROM public.user_school_applications WHERE id='${app.id}';`
      : `UPDATE public.user_school_applications SET school_id=${otherSchool} WHERE id='${app.id}';`;
    await removing.exec(auth + mutation);
    // The detach trigger has run, but the parent mutation is uncommitted.
    await attaching.exec(auth + `UPDATE public.user_bookmarked_scholarships SET school_id=900001 WHERE user_id='${user}' AND scholarship_id='${scholarship}';`);
    // Old schema permits this commit; a deferred FK waits for the parent tx.
    attaching.child.stdin.end('COMMIT;\n');
    await removing.exec('COMMIT;');
    removing.child.stdin.end();
    await removing.done;
    const result = await attaching.done;
    const row = ok(await admin.from('user_bookmarked_scholarships').select('school_id,status').eq('user_id', user).eq('scholarship_id', scholarship).single());
    assert.equal(row.school_id, null, `${operation} racing an attach must not leave an orphan attachment`);
    assert.equal(row.status, 'interested', 'failed attach preserves the saved scholarship');
    assert.notEqual(result.code, 0, 'the concurrent orphan attach must be rejected');
    assert.match(result.stderr, /foreign key constraint/, 'rejected by relationship integrity, not a timeout');
  }
  console.log('Concurrent scholarship attach/delete and attach/move preserve relationship integrity.');
} finally {
  for (const s of sessions) if (s.child.exitCode === null) { s.child.kill(); await s.done; }
  ok(await admin.from('user_bookmarked_scholarships').delete().eq('user_id', user));
  ok(await admin.from('user_school_applications').delete().eq('user_id', user));
  ok(await admin.auth.admin.deleteUser(user));
  ok(await admin.from('schools').delete().eq('id', otherSchool));
}
