// PROD-100: community activity (post likes, comments, replies, comment likes,
// follows, join request approvals) must notify the right person through a
// trusted database path. Recipient and actor come from the row that caused
// the event, never from the client, and a failed notification never blocks
// the activity itself. Runs only against the disposable loopback stack with
// disposable synthetic users; every row it creates is removed, including the
// temporary failure trigger.
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
const admin = createClient(apiUrl, serviceKey, options);
const tag = randomUUID().replaceAll('-', '').slice(0, 12);
const userIds = [];
const ids = {
  group: randomUUID(), publicPost: randomUUID(), anonPost: randomUUID(),
  privatePost: randomUUID(), hiddenPost: randomUUID(),
};
const failTrigger = `e2e_notify_fail_${tag}`;
let triggerInstalled = false;
let failure = null;
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const required = (result, label) => { assert.ifError(result.error, label); return result.data; };
const refused = (result, label) => check(result.error?.code === '42501', label);

async function disposableUser(role, firstName, lastName) {
  const email = `e2e-notify-${role}-${tag}@caat.local.test`;
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

// Service-role views of what was delivered, so a missing row cannot hide behind RLS.
const delivered = async (recipientId, actorId, type, postId) => {
  let query = admin.from('notifications')
    .select('user_id, actor_id, type, post_id, comment_id, message, is_read')
    .eq('user_id', recipientId).eq('actor_id', actorId).eq('type', type);
  query = postId === null ? query.is('post_id', null) : postId ? query.eq('post_id', postId) : query;
  return required(await query, `delivered ${type}`);
};
const fromActor = async (actorId) => required(await admin.from('notifications').select('id').eq('actor_id', actorId), 'actor rows');
const aboutPost = async (postId) => required(await admin.from('notifications').select('user_id, actor_id, message').eq('post_id', postId), 'post rows');
// What a signed-in user can read through RLS.
const inbox = async (user, postId) => {
  const query = user.client.from('notifications').select('user_id, actor_id, type, post_id');
  return required(await (postId ? query.eq('post_id', postId) : query), 'inbox read');
};
const markAllRead = async (user) => required(await user.client.from('notifications').update({ is_read: true })
  .eq('user_id', user.id), 'mark read');
const exists = async (table, filters) => {
  let query = admin.from(table).select('*', { count: 'exact', head: true });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count, error } = await query;
  assert.ifError(error, `${table} lookup`);
  return count === 1;
};
const comment = async (user, postId, content, parentId = null) => required(await user.client.from('community_comments')
  .insert({ post_id: postId, user_id: user.id, content, parent_comment_id: parentId }).select('id').single(), `comment: ${content}`).id;
const approve = async (owner, requesterId) => required(await owner.client.rpc('approve_group_join_request', {
  p_group_id: ids.group, p_requester_user_id: requesterId,
}), 'approve request');

try {
  const author = await disposableUser('author', 'E2E', `Author ${tag}`);
  const peer = await disposableUser('peer', 'E2E', `Peer ${tag}`);
  const third = await disposableUser('third', 'E2E', `Third ${tag}`);
  const outsider = await disposableUser('outsider', 'E2E', `Outsider ${tag}`);
  const shunned = await disposableUser('shunned', 'E2E', `Shunned ${tag}`);
  const faulty = await disposableUser('faulty', 'E2E', `Faulty ${tag}`);
  const groupName = `E2E Notify Private ${tag}`;

  required(await author.client.from('community_posts').insert({
    id: ids.publicPost, user_id: author.id, content: `notify public ${tag}`, topic_tag: 'ADVICE',
  }), 'author posts publicly');

  // 1. Nobody can write a notification directly, so nobody chooses a recipient or actor.
  for (const [label, row] of [
    ['own actor', { user_id: author.id, actor_id: peer.id, type: 'like', post_id: ids.publicPost }],
    ['forged actor', { user_id: author.id, actor_id: third.id, type: 'comment', post_id: ids.publicPost }],
    ['forged recipient', { user_id: third.id, actor_id: author.id, type: 'follow', post_id: null }],
    ['self approval', { user_id: peer.id, actor_id: author.id, type: 'request_approved', post_id: null, message: 'forged' }],
    ['comment like', { user_id: author.id, actor_id: peer.id, type: 'comment_like', post_id: ids.publicPost }],
  ]) {
    refused(await peer.client.from('notifications').insert(row).select('id'), `direct notification insert is refused (${label})`);
  }
  check((await fromActor(peer.id)).length === 0 && (await fromActor(third.id)).length === 0 && (await fromActor(author.id)).length === 0,
    'refused direct inserts left no notification rows');

  // 2. Post likes: one notification for the author, none for self-likes, no stacking.
  required(await peer.client.from('community_likes').insert({ post_id: ids.publicPost, user_id: peer.id }), 'peer likes post');
  const like = await delivered(author.id, peer.id, 'like', ids.publicPost);
  check(like.length === 1 && like[0].comment_id === null && like[0].message === null && like[0].is_read === false,
    'a post like notifies the post author exactly once');
  check((await inbox(author, ids.publicPost)).some((n) => n.type === 'like' && n.actor_id === peer.id),
    'the post author can read the like notification');
  check((await inbox(peer)).length === 0 && (await inbox(third)).length === 0, 'the liker and other users cannot read it');
  required(await author.client.from('community_likes').insert({ post_id: ids.publicPost, user_id: author.id }), 'author self-like');
  check((await delivered(author.id, author.id, 'like')).length === 0, 'the post author liking their own post creates no notification');
  await markAllRead(author);
  required(await peer.client.from('community_likes').delete().eq('post_id', ids.publicPost).eq('user_id', peer.id), 'peer unlikes');
  required(await peer.client.from('community_likes').insert({ post_id: ids.publicPost, user_id: peer.id }), 'peer likes again');
  const reliked = await delivered(author.id, peer.id, 'like', ids.publicPost);
  check(reliked.length === 1 && reliked[0].is_read === true, 're-liking does not stack or resurface the like notification');

  // 3. Comments and replies notify the post author and the parent comment author.
  const authorComment = await comment(author, ids.publicPost, 'author comment');
  check((await delivered(author.id, author.id, 'comment')).length === 0, 'commenting on your own post creates no notification');
  const peerComment = await comment(peer, ids.publicPost, 'peer comment');
  const commented = await delivered(author.id, peer.id, 'comment', ids.publicPost);
  check(commented.length === 1 && commented[0].comment_id === peerComment && commented[0].message === null,
    'a comment notifies the post author exactly once, pointing at the comment');
  const thirdReply = await comment(third, ids.publicPost, 'third reply', peerComment);
  const replied = await delivered(peer.id, third.id, 'reply', ids.publicPost);
  check(replied.length === 1 && replied[0].comment_id === thirdReply, 'a reply notifies the parent comment author exactly once');
  const threadNote = await delivered(author.id, third.id, 'comment', ids.publicPost);
  check(threadNote.length === 1 && threadNote[0].comment_id === thirdReply, 'a reply in the thread notifies the post author as a comment');
  check((await delivered(author.id, third.id, 'reply')).length === 0, 'the post author is not told someone replied to their comment when they did not');
  const peerReply = await comment(peer, ids.publicPost, 'peer reply to author', authorComment);
  const authorReplied = await delivered(author.id, peer.id, 'reply', ids.publicPost);
  check(authorReplied.length === 1 && authorReplied[0].comment_id === peerReply, 'a reply to the post author notifies them as a reply');
  check((await delivered(author.id, peer.id, 'comment', ids.publicPost))[0]?.comment_id === peerComment,
    'a reply to the post author does not also send them a comment notification');
  await markAllRead(author);
  const peerSecond = await comment(peer, ids.publicPost, 'peer second comment');
  const refreshed = await delivered(author.id, peer.id, 'comment', ids.publicPost);
  check(refreshed.length === 1 && refreshed[0].comment_id === peerSecond && refreshed[0].is_read === false,
    'a new comment refreshes the single comment notification as unread');
  await comment(author, ids.publicPost, 'author reply to peer', peerComment);
  check((await delivered(peer.id, author.id, 'reply', ids.publicPost)).length === 1, 'the post author replying notifies the commenter');
  check((await delivered(author.id, author.id, 'reply')).length === 0, 'replying in your own thread creates no self notification');

  // 4. Comment likes (a new notification type) notify the comment author once.
  required(await third.client.from('community_comment_likes').insert({ comment_id: peerComment, user_id: third.id }), 'third likes comment');
  const commentLike = await delivered(peer.id, third.id, 'comment_like', ids.publicPost);
  check(commentLike.length === 1 && commentLike[0].comment_id === peerComment, 'a comment like notifies the comment author exactly once');
  required(await peer.client.from('community_comment_likes').insert({ comment_id: peerComment, user_id: peer.id }), 'self comment like');
  check((await delivered(peer.id, peer.id, 'comment_like')).length === 0, 'liking your own comment creates no notification');
  await markAllRead(peer);
  required(await third.client.from('community_comment_likes').delete().eq('comment_id', peerComment).eq('user_id', third.id), 'unlike comment');
  required(await third.client.from('community_comment_likes').insert({ comment_id: peerComment, user_id: third.id }), 'like comment again');
  const commentReliked = await delivered(peer.id, third.id, 'comment_like', ids.publicPost);
  check(commentReliked.length === 1 && commentReliked[0].is_read === true, 're-liking a comment does not stack or resurface');

  // 5. Follows notify the followed user once.
  required(await peer.client.from('community_follows').insert({ follower_id: peer.id, followee_id: author.id }), 'peer follows');
  const followed = await delivered(author.id, peer.id, 'follow', null);
  check(followed.length === 1 && followed[0].comment_id === null, 'a follow notifies the followed user exactly once');
  await markAllRead(author);
  required(await peer.client.from('community_follows').delete().eq('follower_id', peer.id).eq('followee_id', author.id), 'unfollow');
  required(await peer.client.from('community_follows').insert({ follower_id: peer.id, followee_id: author.id }), 'follow again');
  const refollowed = await delivered(author.id, peer.id, 'follow', null);
  check(refollowed.length === 1 && refollowed[0].is_read === true, 're-following does not stack or resurface');

  // 6. Anonymous posts: their author is only ever a recipient, and only they can read it.
  required(await author.client.from('community_posts').insert({
    id: ids.anonPost, user_id: author.id, content: `notify anonymous ${tag}`, topic_tag: 'ADVICE', is_anonymous: true,
  }), 'author posts anonymously');
  required(await peer.client.from('community_likes').insert({ post_id: ids.anonPost, user_id: peer.id }), 'peer likes anonymous post');
  await comment(peer, ids.anonPost, 'peer comment on anonymous post');
  check((await delivered(author.id, peer.id, 'like', ids.anonPost)).length === 1 &&
    (await delivered(author.id, peer.id, 'comment', ids.anonPost)).length === 1,
  'the anonymous author is notified of likes and comments');
  const anonRows = await aboutPost(ids.anonPost);
  check(anonRows.length === 2 && anonRows.every((n) => n.user_id === author.id && n.actor_id === peer.id && n.message === null),
    'anonymous post notifications carry no names and name the anonymous author only as recipient');
  check((await inbox(peer, ids.anonPost)).length === 0 && (await inbox(third, ids.anonPost)).length === 0 &&
    (await inbox(outsider, ids.anonPost)).length === 0, 'nobody but the anonymous author can read those notifications');

  // 7. Blocks in either direction suppress notifications, never the activity.
  required(await author.client.from('community_blocks').insert({ blocker_id: author.id, blocked_id: shunned.id }), 'author blocks shunned');
  required(await shunned.client.from('community_blocks').insert({ blocker_id: shunned.id, blocked_id: peer.id }), 'shunned blocks peer');
  required(await shunned.client.from('community_likes').insert({ post_id: ids.publicPost, user_id: shunned.id }), 'shunned likes');
  check(await exists('community_likes', { post_id: ids.publicPost, user_id: shunned.id }), 'the blocked user\'s like itself is stored');
  check((await delivered(author.id, shunned.id, 'like')).length === 0, 'a blocked user\'s like does not notify the author who blocked them');
  required(await shunned.client.from('community_follows').insert({ follower_id: shunned.id, followee_id: author.id }), 'shunned follows');
  await comment(shunned, ids.publicPost, 'shunned reply to peer', peerComment);
  check((await fromActor(shunned.id)).length === 0, 'blocked users notify nobody on either side of the block');

  // 8. Private communities: approvals notify the requester; outsiders cannot cause notifications.
  required(await author.client.from('community_groups').insert({
    id: ids.group, slug: `e2e-notify-${tag}`, name: groupName, creator_id: author.id, is_private: true,
  }), 'author creates private group');
  required(await peer.client.from('community_group_requests').insert({
    group_id: ids.group, user_id: peer.id, status: 'pending',
  }), 'peer requests to join');
  check(await approve(author, peer.id) === true, 'owner approves the request');
  const approved = await delivered(peer.id, author.id, 'request_approved', null);
  check(approved.length === 1 && approved[0].message === `Your request to join ${groupName} was approved` && approved[0].is_read === false,
    'an approval notifies the requester exactly once');
  check(await approve(author, peer.id) === false && (await delivered(peer.id, author.id, 'request_approved')).length === 1,
    'a repeated approval does not notify again');
  required(await outsider.client.from('community_group_requests').insert({
    group_id: ids.group, user_id: outsider.id, status: 'pending',
  }), 'outsider requests to join');
  required(await admin.from('community_group_requests').update({ status: 'approved' })
    .eq('group_id', ids.group).eq('user_id', outsider.id), 'status flipped without the approval RPC');
  check((await delivered(outsider.id, author.id, 'request_approved')).length === 0,
    'an approval that grants no membership notifies nobody');
  required(await author.client.from('community_posts').insert({
    id: ids.privatePost, user_id: author.id, content: `notify private ${tag}`, topic_tag: 'ADVICE', group_id: ids.group,
  }), 'author posts privately');
  const privateComment = await comment(author, ids.privatePost, 'author private comment');
  required(await peer.client.from('community_likes').insert({ post_id: ids.privatePost, user_id: peer.id }), 'member likes private post');
  check((await delivered(author.id, peer.id, 'like', ids.privatePost)).length === 1, 'a member\'s like on a private post notifies the author');
  refused(await outsider.client.from('community_likes').insert({ post_id: ids.privatePost, user_id: outsider.id }).select('post_id'),
    'a non-member cannot like a private post');
  refused(await outsider.client.from('community_comments').insert({
    post_id: ids.privatePost, user_id: outsider.id, content: 'intrusion',
  }).select('id'), 'a non-member cannot comment on a private post');
  refused(await outsider.client.from('community_comments').insert({
    post_id: ids.privatePost, user_id: outsider.id, content: 'intrusion', parent_comment_id: privateComment,
  }).select('id'), 'a non-member cannot reply in a private thread');
  refused(await outsider.client.from('community_comment_likes').insert({ comment_id: privateComment, user_id: outsider.id }).select('comment_id'),
    'a non-member cannot like a private comment');
  check((await fromActor(outsider.id)).length === 0 && (await aboutPost(ids.privatePost)).every((n) => n.actor_id === peer.id),
    'a non-member causes no notification about private content');

  const memberComment = await comment(peer, ids.privatePost, 'member private comment');
  check((await delivered(author.id, peer.id, 'comment', ids.privatePost)).length === 1, 'a member\'s private comment notifies the author');
  check(required(await peer.client.from('community_group_members').delete()
    .eq('group_id', ids.group).eq('user_id', peer.id).select('user_id'), 'member leaves').length === 1, 'member leaves the private group');
  await comment(author, ids.privatePost, 'owner reply after leaving', memberComment);
  check((await delivered(peer.id, author.id, 'reply', ids.privatePost)).length === 0,
    'a former member is not notified about content they can no longer see');
  await markAllRead(peer);
  required(await peer.client.from('community_group_requests').upsert({
    group_id: ids.group, user_id: peer.id, status: 'pending',
  }), 'former member asks again');
  check(await approve(author, peer.id) === true, 'owner approves the renewed request');
  const reapproved = await delivered(peer.id, author.id, 'request_approved', null);
  check(reapproved.length === 1 && reapproved[0].is_read === false, 'a renewed approval resurfaces the single approval notification');

  // 9. Hidden posts: only their author can see them, so nobody else is notified.
  required(await author.client.from('community_posts').insert({
    id: ids.hiddenPost, user_id: author.id, content: `notify hidden ${tag}`, topic_tag: 'ADVICE',
  }), 'author posts');
  const thirdOnHidden = await comment(third, ids.hiddenPost, 'third comment before hiding');
  required(await admin.from('community_posts').update({ is_hidden: true }).eq('id', ids.hiddenPost), 'moderation hides post');
  await comment(author, ids.hiddenPost, 'author reply on hidden post', thirdOnHidden);
  check((await delivered(third.id, author.id, 'reply', ids.hiddenPost)).length === 0, 'nobody is notified about a hidden post they cannot see');

  // 10. A failed notification never blocks the like, comment, follow or approval.
  runLocalPsql(dbUrl, ['-q', '-v', 'ON_ERROR_STOP=1', '-c', `
    create function public.${failTrigger}() returns trigger language plpgsql as $f$
    begin raise exception 'synthetic notification failure'; end; $f$;
    create trigger ${failTrigger} before insert or update on public.notifications
      for each row when (new.actor_id = '${faulty.id}'::uuid or new.user_id = '${faulty.id}'::uuid)
      execute function public.${failTrigger}();
  `]);
  triggerInstalled = true;
  const faultyLike = await faulty.client.from('community_likes').insert({ post_id: ids.publicPost, user_id: faulty.id });
  check(!faultyLike.error && await exists('community_likes', { post_id: ids.publicPost, user_id: faulty.id }),
    'a like succeeds while notification delivery fails');
  const faultyCommented = await faulty.client.from('community_comments')
    .insert({ post_id: ids.publicPost, user_id: faulty.id, content: 'faulty comment' }).select('id').single();
  check(!faultyCommented.error && await exists('community_comments', { id: faultyCommented.data.id }),
    'a comment succeeds while notification delivery fails');
  const faultyComment = faultyCommented.data.id;
  const faultyCommentLike = await faulty.client.from('community_comment_likes').insert({ comment_id: peerComment, user_id: faulty.id });
  check(!faultyCommentLike.error && await exists('community_comment_likes', { comment_id: peerComment, user_id: faulty.id }),
    'a comment like succeeds while notification delivery fails');
  const faultyFollow = await faulty.client.from('community_follows').insert({ follower_id: faulty.id, followee_id: author.id });
  check(!faultyFollow.error && await exists('community_follows', { follower_id: faulty.id, followee_id: author.id }),
    'a follow succeeds while notification delivery fails');
  required(await faulty.client.from('community_group_requests').insert({ group_id: ids.group, user_id: faulty.id, status: 'pending' }), 'faulty requests');
  check(await approve(author, faulty.id) === true && await exists('community_group_members', { group_id: ids.group, user_id: faulty.id }),
    'an approval succeeds while notification delivery fails');
  const replyToFaulty = await comment(third, ids.publicPost, 'third reply to faulty', faultyComment);
  check((await delivered(faulty.id, third.id, 'reply')).length === 0 &&
    (await delivered(author.id, third.id, 'comment', ids.publicPost))[0]?.comment_id === replyToFaulty,
  'one failed delivery does not stop the other notification for the same reply');
  check((await fromActor(faulty.id)).length === 0 && (await delivered(faulty.id, author.id, 'request_approved')).length === 0,
    'failed deliveries leave no partial notification rows');
  runLocalPsql(dbUrl, ['-q', '-v', 'ON_ERROR_STOP=1', '-c', `
    drop trigger if exists ${failTrigger} on public.notifications;
    drop function if exists public.${failTrigger}();
  `]);
  triggerInstalled = false;
  required(await faulty.client.from('community_likes').delete().eq('post_id', ids.publicPost).eq('user_id', faulty.id), 'faulty unlikes');
  required(await faulty.client.from('community_likes').insert({ post_id: ids.publicPost, user_id: faulty.id }), 'faulty likes again');
  check((await delivered(author.id, faulty.id, 'like', ids.publicPost)).length === 1, 'notifications resume once delivery recovers');

  console.log(`Community notifications RLS passed: ${checks} assertions using disposable local users and rows.`);
} catch (error) {
  failure = error;
  throw error;
} finally {
  try {
    if (triggerInstalled) {
      runLocalPsql(dbUrl, ['-q', '-v', 'ON_ERROR_STOP=1', '-c', `
        drop trigger if exists ${failTrigger} on public.notifications;
        drop function if exists public.${failTrigger}();
      `]);
    }
    const groups = await admin.from('community_groups').delete().eq('id', ids.group);
    assert.ifError(groups.error, 'synthetic group cleanup');
    // Delete posts here, where public is on the search path: the snapshot's
    // delete_post_children trigger has none, so an Auth-side cascade fails.
    const posts = await admin.from('community_posts').delete().in('id', Object.values(ids));
    assert.ifError(posts.error, 'synthetic post cleanup');
    for (const id of userIds) {
      const removed = await admin.auth.admin.deleteUser(id);
      assert.ifError(removed.error, 'synthetic user cleanup');
    }
    const leftovers = await admin.from('notifications').select('id').or(
      userIds.map((id) => `user_id.eq.${id},actor_id.eq.${id}`).join(',') || 'id.is.null',
    );
    assert.ifError(leftovers.error, 'notification cleanup check');
    assert.equal(leftovers.data.length, 0, 'synthetic notifications are removed with their users');
  } catch (cleanupError) {
    // Never let a cleanup error hide the assertion that actually failed.
    if (!failure) throw cleanupError;
    console.error(`Cleanup also failed: ${cleanupError.message}`);
  }
}
