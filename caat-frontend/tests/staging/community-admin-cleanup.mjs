import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';

// Catches caller-search_path-dependent trigger failures and overbroad cleanup.
const url = process.env.SUPABASE_URL;
assertLocalApiUrl(url);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const peerClient = createClient(url, process.env.SUPABASE_ANON_KEY, options);
const users = new Set();
const posts = [randomUUID(), randomUUID()];
const comments = [randomUUID(), randomUUID()];
const tables = ['community_comments', 'community_likes', 'community_saves', 'community_reports', 'community_poll_votes', 'notifications'];
const required = (result, label) => { assert.ifError(result.error, label); return result.data; };
const rows = async (table, column, id) => required(await admin.from(table).select('*').eq(column, id), `read ${table}`);
const createUser = async () => {
  const email = `e2e-admin-cleanup-${randomUUID()}@caat.local.test`;
  const password = randomBytes(24).toString('hex');
  const data = required(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create disposable user');
  users.add(data.user.id);
  return { id: data.user.id, email, password };
};
try {
  const owner = await createUser();
  const peer = await createUser();
  required(await peerClient.auth.signInWithPassword({ email: peer.email, password: peer.password }), 'peer signs in');
  for (const [i, author] of [owner, peer].entries()) {
    required(await admin.from('community_posts').insert({ id: posts[i], user_id: author.id, content: 'Synthetic cleanup post', topic_tag: 'ADVICE', poll_options: [{ id: 'a', text: 'One' }, { id: 'b', text: 'Two' }] }), 'create post');
    required(await admin.from('community_comments').insert({ id: comments[i], post_id: posts[i], user_id: peer.id, content: 'Peer reply' }), 'create comment');
    for (const table of ['community_likes', 'community_saves']) required(await admin.from(table).insert({ post_id: posts[i], user_id: peer.id }), `create ${table}`);
    required(await admin.from('community_reports').insert({ post_id: posts[i], reporter_id: peer.id }), 'create report');
    required(await admin.from('community_poll_votes').insert({ post_id: posts[i], user_id: peer.id, option_id: 'a' }), 'create vote');
    required(await admin.from('community_comment_likes').insert({ comment_id: comments[i], user_id: peer.id }), 'create comment like');
    required(await admin.from('notifications').insert({ post_id: posts[i], comment_id: comments[i], user_id: peer.id, actor_id: peer.id, type: 'reply' }), 'create notification');
    for (const table of tables) assert.equal((await rows(table, 'post_id', posts[i])).length, 1, `${table} fixture exists`);
    assert.equal((await rows('community_comment_likes', 'comment_id', comments[i])).length, 1);
  }
  const denied = await peerClient.from('community_posts').delete().eq('id', posts[0]).select('id');
  assert.ok(denied.error || denied.data?.length === 0, 'peer cannot delete owner post');
  assert.equal((await rows('community_posts', 'id', posts[0])).length, 1);

  required(await admin.auth.admin.deleteUser(owner.id), 'Auth Admin deletes user with community children');
  users.delete(owner.id);
  const absent = await admin.auth.admin.getUserById(owner.id);
  assert.equal(absent.error?.status, 404, 'owner account is gone');
  assert.equal((await rows('community_posts', 'id', posts[0])).length, 0);
  for (const table of tables) assert.equal((await rows(table, 'post_id', posts[0])).length, 0, `${table} cleaned`);
  assert.equal((await rows('community_comment_likes', 'comment_id', comments[0])).length, 0);
  assert.equal((await rows('community_posts', 'id', posts[1])).length, 1, 'unrelated peer post retained');
  for (const table of tables) assert.equal((await rows(table, 'post_id', posts[1])).length, 1, `${table} peer row retained`);
  assert.equal((await rows('community_comment_likes', 'comment_id', comments[1])).length, 1);
  assert.equal(required(await admin.auth.admin.getUserById(peer.id), 'peer account retained').user.id, peer.id);
  console.log('Community Auth Admin cleanup PASS: account/post children removed, peer account/post/children retained, peer deletion denied.');
} finally {
  // Explicit REST cleanup also works on the old trigger, so a RED run is clean.
  required(await admin.from('community_posts').delete().in('id', posts), 'cleanup exact test posts');
  for (const id of users) required(await admin.auth.admin.deleteUser(id), 'cleanup disposable user');
}
