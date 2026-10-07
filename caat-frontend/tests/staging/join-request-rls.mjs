// PROD-86: a private-community join request must reach the owner through a
// trusted database path, without widening group visibility or letting anyone
// forge notification recipients or actors. Runs only against the disposable
// loopback stack with disposable synthetic users; every row it creates is
// removed, including the temporary failure trigger.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDatabaseUrl, runLocalPsql } from './local-db.mjs';
import { assertLocalApiUrl } from './safety.mjs';

const apiUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;
if (!apiUrl || !anonKey || !serviceKey || !password) throw new Error('Local Supabase test settings are required.');
assertLocalApiUrl(apiUrl);
const dbUrl = localDatabaseUrl();

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anonymous = createClient(apiUrl, anonKey, options);
const admin = createClient(apiUrl, serviceKey, options);
const tag = randomUUID().replaceAll('-', '').slice(0, 12);
const userIds = [];
const groupIds = { private: randomUUID(), public: randomUUID() };
const failTrigger = `e2e_joinreq_fail_${tag}`;
let triggerInstalled = false;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const required = (result, label) => { assert.ifError(result.error, label); return result.data; };

async function disposableUser(role, firstName, lastName) {
  const email = `e2e-joinreq-${role}-${tag}@caat.local.test`;
  const created = required(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `create ${role}`);
  userIds.push(created.user.id);
  required(await admin.from('profiles').upsert({
    id: created.user.id, email, first_name: firstName, last_name: lastName, is_verified: false,
  }), `${role} profile`);
  const signIn = createClient(apiUrl, anonKey, options);
  const { data, error } = await signIn.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return {
    id: created.user.id,
    client: createClient(apiUrl, anonKey, { ...options, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } }),
  };
}

const requestStatus = async (userId) => (await admin.from('community_group_requests').select('status')
  .eq('group_id', groupIds.private).eq('user_id', userId).maybeSingle()).data?.status ?? null;
const ownerNotifications = async (client, actorId) => required(await client.from('notifications')
  .select('user_id, actor_id, type, post_id, message, is_read').eq('type', 'join_request').eq('actor_id', actorId), 'notification read');
const adminNotifications = async (actorId) => required(await admin.from('notifications')
  .select('user_id, actor_id, type, message, is_read').eq('actor_id', actorId), 'admin notification read');
const requestJoin = (client, groupId = groupIds.private) => client.rpc('request_community_group_join', { p_group_id: groupId });
const joinCard = (client, slug) => client.rpc('get_community_group_join_card', { p_slug: slug });

try {
  const owner = await disposableUser('owner', 'E2E', `Owner ${tag}`);
  const requester = await disposableUser('requester', 'E2E', `Requester ${tag}`);
  const intruder = await disposableUser('intruder', 'E2E', `Intruder ${tag}`);
  const blocked = await disposableUser('blocked', 'E2E', `Blocked ${tag}`);
  const privateSlug = `e2e-joinreq-${tag}`;
  const publicSlug = `e2e-joinreq-public-${tag}`;
  const groupName = `E2E Join Request ${tag}`;

  required(await owner.client.from('community_groups').insert({
    id: groupIds.private, slug: privateSlug, name: groupName, description: 'Synthetic private description',
    creator_id: owner.id, is_private: true,
  }), 'owner creates private group');
  required(await owner.client.from('community_groups').insert({
    id: groupIds.public, slug: publicSlug, name: `E2E Join Request Public ${tag}`,
    creator_id: owner.id, is_private: false,
  }), 'owner creates public group');
  required(await owner.client.from('community_posts').insert({
    user_id: owner.id, content: 'private join request content', topic_tag: 'ADVICE', group_id: groupIds.private,
  }), 'owner posts privately');

  // 1. Private-group visibility is unchanged for non-members.
  check(required(await requester.client.from('community_groups').select('id, creator_id').eq('id', groupIds.private), 'group read').length === 0,
    'non-member still cannot read the private group row (the old owner lookup)');
  check(required(await requester.client.from('community_groups').select('id').eq('slug', privateSlug), 'slug read').length === 0,
    'non-member still cannot read the private group by slug');
  check(required(await requester.client.from('community_group_members').select('user_id').eq('group_id', groupIds.private), 'roster').length === 0,
    'non-member still cannot read the private roster');
  check(required(await requester.client.from('community_posts').select('id').eq('group_id', groupIds.private), 'posts').length === 0,
    'non-member still cannot read private posts');

  // 2. Notifications cannot be written directly, so nobody can choose a recipient or actor.
  for (const [label, row] of [
    ['own actor', { user_id: owner.id, actor_id: requester.id, type: 'join_request', post_id: null, message: 'forged' }],
    ['forged actor', { user_id: owner.id, actor_id: intruder.id, type: 'join_request', post_id: null, message: 'forged' }],
    ['self recipient', { user_id: requester.id, actor_id: owner.id, type: 'request_approved', post_id: null, message: 'forged' }],
  ]) {
    const direct = await requester.client.from('notifications').insert(row).select('id');
    check(direct.error?.code === '42501', `direct notification insert is denied (${label})`);
  }
  check((await adminNotifications(intruder.id)).length === 0 && (await adminNotifications(requester.id)).length === 0,
    'refused direct inserts left no notification rows');

  // 3. The minimal join card exposes only id, name and the caller's own pending flag.
  const card = required(await joinCard(requester.client, privateSlug), 'join card');
  check(card.length === 1, 'non-member gets exactly one join card for a private slug');
  assert.deepEqual(Object.keys(card[0]).sort(), ['has_pending_request', 'id', 'name'], 'join card has no description, counts, posts or members'); checks++;
  check(card[0].id === groupIds.private && card[0].name === groupName && card[0].has_pending_request === false, 'join card identifies the group by id and name');
  check(required(await joinCard(owner.client, privateSlug), 'owner card').length === 0, 'the owner gets no join card (they can read the group)');
  check(required(await joinCard(requester.client, publicSlug), 'public card').length === 0, 'public groups never produce a join card');
  check(required(await joinCard(requester.client, `e2e-joinreq-missing-${tag}`), 'missing card').length === 0, 'an unknown slug produces no card');
  check(!!(await joinCard(anonymous, privateSlug)).error, 'anonymous callers cannot use the join card');

  // 4. The trusted request path records the request and notifies the owner once.
  check(!!(await requestJoin(anonymous)).error, 'anonymous callers cannot request to join');
  check((await requestStatus(requester.id)) === null, 'anonymous attempt recorded nothing');
  check(required(await requestJoin(requester.client), 'request') === 'requested', 'request is recorded');
  check((await requestStatus(requester.id)) === 'pending', 'request status is pending');
  const delivered = await ownerNotifications(owner.client, requester.id);
  check(delivered.length === 1, 'owner receives exactly one join request notification');
  check(delivered[0].user_id === owner.id && delivered[0].actor_id === requester.id && delivered[0].post_id === null &&
    delivered[0].is_read === false && delivered[0].message === `E2E Requester ${tag} requested to join ${groupName}`,
  'notification recipient, actor and message are derived by the database');
  check((await ownerNotifications(requester.client, requester.id)).length === 0, 'requester cannot read the owner notification');
  check((await ownerNotifications(intruder.client, requester.id)).length === 0, 'other users cannot read the owner notification');
  check(required(await joinCard(requester.client, privateSlug), 'pending card')[0]?.has_pending_request === true, 'join card reports the pending request');
  check(required(await requester.client.from('community_groups').select('id').eq('id', groupIds.private), 'still hidden').length === 0,
    'requesting does not reveal the private group row');

  // 5. Retries never duplicate the request or the notification, even concurrently.
  check(required(await requestJoin(requester.client), 'retry') === 'pending', 'a retry reports the existing pending request');
  check((await ownerNotifications(owner.client, requester.id)).length === 1, 'a retry does not add a notification');
  const burst = await Promise.all([1, 2, 3].map(() => requestJoin(intruder.client)));
  burst.forEach((result) => assert.ifError(result.error));
  check(burst.map((result) => result.data).sort().join(',') === 'pending,pending,requested', 'concurrent requests record one change');
  check((await adminNotifications(intruder.id)).length === 1, 'concurrent requests notify the owner once');

  // 6. Callers cannot redirect the notification or notify outside the private request flow.
  const forgedArgs = await requester.client.rpc('request_community_group_join', {
    p_group_id: groupIds.private, p_user_id: intruder.id, p_actor_id: intruder.id,
  });
  check(!!forgedArgs.error, 'the request path accepts no recipient or actor arguments');
  check(!!(await requestJoin(requester.client, groupIds.public)).error, 'public groups are joined, not requested');
  check(!!(await requestJoin(owner.client)).error, 'owners cannot request their own group');
  check(!!(await requestJoin(requester.client, randomUUID())).error, 'an unknown group is refused');
  check((await adminNotifications(owner.id)).length === 0, 'refused requests never produce a notification');
  check((await adminNotifications(intruder.id)).length === 1 && (await adminNotifications(requester.id)).length === 1,
    'no extra notifications were created for forged arguments');

  // 7. A failed notification rolls back the request, keeping its previous status.
  runLocalPsql(dbUrl, ['-q', '-v', 'ON_ERROR_STOP=1', '-c', `
    create function public.${failTrigger}() returns trigger language plpgsql as $f$
    begin raise exception 'synthetic notification failure'; end; $f$;
    create trigger ${failTrigger} before insert or update on public.notifications
      for each row when (new.actor_id = '${blocked.id}'::uuid) execute function public.${failTrigger}();
  `]);
  triggerInstalled = true;
  check(!!(await requestJoin(blocked.client)).error, 'request fails when the owner notification fails');
  check((await requestStatus(blocked.id)) === null, 'failed first request leaves no request row');
  required(await blocked.client.from('community_group_requests').insert({
    group_id: groupIds.private, user_id: blocked.id, status: 'pending',
  }), 'legacy direct request');
  check(required(await owner.client.rpc('reject_group_join_request', {
    p_group_id: groupIds.private, p_requester_user_id: blocked.id,
  }), 'owner rejects') === true, 'owner rejects the blocked request');
  check(!!(await requestJoin(blocked.client)).error, 'repeat request fails while notification delivery fails');
  check((await requestStatus(blocked.id)) === 'rejected', 'failed repeat request keeps the rejected status');
  runLocalPsql(dbUrl, ['-q', '-v', 'ON_ERROR_STOP=1', '-c', `
    drop trigger if exists ${failTrigger} on public.notifications;
    drop function if exists public.${failTrigger}();
  `]);
  triggerInstalled = false;
  check(required(await requestJoin(blocked.client), 'recovered request') === 'requested', 'request succeeds once delivery recovers');
  check((await requestStatus(blocked.id)) === 'pending' && (await adminNotifications(blocked.id)).length === 1,
    'recovered request is pending with one notification');

  // 8. Owner review: the owner lists the request, approves it, and the member can read the group.
  const pending = required(await owner.client.from('community_group_requests').select('user_id')
    .eq('group_id', groupIds.private).eq('status', 'pending'), 'owner review list');
  check(pending.some((row) => row.user_id === requester.id), 'owner can list the pending request');
  check(required(await owner.client.rpc('approve_group_join_request', {
    p_group_id: groupIds.private, p_requester_user_id: requester.id,
  }), 'approve') === true, 'owner approves the request');
  check(required(await requester.client.from('community_groups').select('id').eq('id', groupIds.private), 'member read').length === 1,
    'approved member can now read the group');
  check(required(await requestJoin(requester.client), 'member retry') === 'member', 'a member request is a no-op');
  check((await ownerNotifications(owner.client, requester.id)).length === 1, 'a member request does not notify');
  check(required(await joinCard(requester.client, privateSlug), 'member card').length === 0, 'members get the full group, not a join card');

  // 9. A genuine new request after leaving or rejection resurfaces the single notification as unread.
  required(await owner.client.from('notifications').update({ is_read: true })
    .eq('actor_id', requester.id).eq('type', 'join_request'), 'owner marks read');
  required(await requester.client.from('community_group_members').delete()
    .eq('group_id', groupIds.private).eq('user_id', requester.id), 'member leaves');
  check(required(await requestJoin(requester.client), 'rejoin') === 'requested', 'former member can request again');
  const resurfaced = await ownerNotifications(owner.client, requester.id);
  check(resurfaced.length === 1 && resurfaced[0].is_read === false, 'a new request resurfaces one unread notification');
  check(required(await owner.client.rpc('reject_group_join_request', {
    p_group_id: groupIds.private, p_requester_user_id: requester.id,
  }), 'reject') === true, 'owner rejects the new request');
  check((await requestStatus(requester.id)) === 'rejected', 'rejection is recorded');
  check(required(await requestJoin(requester.client), 'after rejection') === 'requested', 'rejected requester may ask again');
  check((await ownerNotifications(owner.client, requester.id)).length === 1, 'still one notification per requester');

  console.log(`Join request RLS passed: ${checks} assertions using disposable local users and rows.`);
} finally {
  if (triggerInstalled) {
    runLocalPsql(dbUrl, ['-q', '-v', 'ON_ERROR_STOP=1', '-c', `
      drop trigger if exists ${failTrigger} on public.notifications;
      drop function if exists public.${failTrigger}();
    `]);
  }
  const groups = await admin.from('community_groups').delete().in('id', Object.values(groupIds));
  assert.ifError(groups.error, 'synthetic group cleanup');
  for (const id of userIds) {
    const removed = await admin.auth.admin.deleteUser(id);
    assert.ifError(removed.error, 'synthetic user cleanup');
  }
  const leftovers = await admin.from('notifications').select('id').or(
    userIds.map((id) => `user_id.eq.${id},actor_id.eq.${id}`).join(',') || 'id.is.null',
  );
  assert.ifError(leftovers.error, 'notification cleanup check');
  assert.equal(leftovers.data.length, 0, 'synthetic notifications are removed with their users');
}
