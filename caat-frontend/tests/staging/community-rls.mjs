import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalApiUrl } from './safety.mjs';

const apiUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;
if (!apiUrl || !anonKey || !serviceKey || !password) throw new Error('Local Supabase test settings are required.');
assertLocalApiUrl(apiUrl);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const anonymous = createClient(apiUrl, anonKey, options);
const admin = createClient(apiUrl, serviceKey, options);
const login = async (email) => {
  const signInClient = createClient(apiUrl, anonKey, options);
  const { data, error } = await signInClient.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return {
    id: data.user.id,
    client: createClient(apiUrl, anonKey, {
      ...options,
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    }),
  };
};
const owner = await login('e2e.student@caat.local.test');
const requester = await login('e2e.peer@caat.local.test');
const tag = randomUUID();
const guestEmail = `e2e-community-${tag.slice(0, 12)}@caat.local.test`;
let guestId = null;
const ids = {
  privateGroup: randomUUID(), publicGroup: randomUUID(),
  privatePost: randomUUID(), publicPost: randomUUID(), memberPost: randomUUID(),
  privateComment: randomUUID(), publicComment: randomUUID(),
};
const required = (result, label) => { assert.ifError(result.error, label); return result.data; };
const empty = (result, label) => { assert.ifError(result.error, label); assert.deepEqual(result.data, [], label); };
const denied = (result, label) => assert.ok(result.error || !result.data?.length, label);
const rlsDenied = (result, label) => assert.equal(result.error?.code, '42501', label);
const triggerDenied = (result, label) => assert.equal(result.error?.code, '23514', label);
let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };

try {
  const privateGroup = required(await owner.client.from('community_groups').insert({
    id: ids.privateGroup, slug: `e2e-private-${tag.slice(0, 12)}`,
    name: 'Synthetic private community', creator_id: owner.id, is_private: true,
  }).select('id').single(), 'owner creates private group');
  check(privateGroup.id === ids.privateGroup, 'private group exists');

  required(await owner.client.from('community_posts').insert({
    id: ids.privatePost, user_id: owner.id, content: 'private synthetic content',
    topic_tag: 'ADVICE', group_id: ids.privateGroup, poll_options: [{ id: 'a', text: 'Option A' }],
  }), 'owner creates private post');
  required(await owner.client.from('community_comments').insert({
    id: ids.privateComment, post_id: ids.privatePost, user_id: owner.id, content: 'private reply',
  }), 'owner creates private comment');
  required(await owner.client.from('community_likes').insert({ post_id: ids.privatePost, user_id: owner.id }), 'owner likes private post');
  required(await owner.client.from('community_saves').insert({ post_id: ids.privatePost, user_id: owner.id }), 'owner saves private post');
  required(await owner.client.from('community_poll_votes').insert({ post_id: ids.privatePost, user_id: owner.id, option_id: 'a' }), 'owner votes on private post');
  required(await owner.client.from('community_comment_likes').insert({ comment_id: ids.privateComment, user_id: owner.id }), 'owner likes private comment');

  empty(await requester.client.from('community_groups').select('id').eq('id', ids.privateGroup), 'nonmember cannot read private group'); checks++;
  empty(await requester.client.from('community_posts').select('id,content').eq('id', ids.privatePost), 'nonmember cannot read private post'); checks++;
  empty(await requester.client.from('community_group_members').select('user_id,role')
    .eq('group_id', ids.privateGroup), 'nonmember cannot read private roster'); checks++;
  const ownerMembers = required(await owner.client.from('community_group_members')
    .select('role').eq('group_id', ids.privateGroup).eq('user_id', owner.id), 'owner membership read');
  check(ownerMembers.length === 1 && ownerMembers[0].role === 'owner', 'group creation atomically adds one owner');
  empty(await requester.client.from('community_comments').select('id,content').eq('post_id', ids.privatePost), 'nonmember cannot read private comment'); checks++;
  empty(await requester.client.from('community_likes').select('post_id,user_id').eq('post_id', ids.privatePost), 'nonmember cannot read private like'); checks++;
  empty(await requester.client.from('community_saves').select('post_id').eq('post_id', ids.privatePost), 'nonmember cannot read private save'); checks++;
  empty(await requester.client.from('community_poll_votes').select('post_id').eq('post_id', ids.privatePost), 'nonmember cannot read private vote'); checks++;
  empty(await requester.client.from('community_comment_likes').select('comment_id').eq('comment_id', ids.privateComment), 'nonmember cannot read private comment like'); checks++;
  empty(await anonymous.from('community_posts').select('id').eq('id', ids.privatePost), 'anonymous cannot read private post'); checks++;
  const privateTally = required(await requester.client.rpc('get_poll_vote_counts', { post_ids: [ids.privatePost] }), 'nonmember poll tally');
  check(privateTally.length === 0, 'private poll tally is not exposed');
  const ownerTally = required(await owner.client.rpc('get_poll_vote_counts', { post_ids: [ids.privatePost] }), 'owner poll tally');
  check(ownerTally.length === 1 && ownerTally[0].post_id === ids.privatePost &&
    ownerTally[0].option_id === 'a' && ownerTally[0].votes === 1, 'owner receives private poll count');
  check(required(await owner.client.from('community_posts').select('id').eq('id', ids.privatePost), 'owner post read').length === 1, 'owner reads private post');
  check(required(await owner.client.from('community_comments').select('id').eq('id', ids.privateComment), 'owner comment read').length === 1, 'owner reads private comment');

  rlsDenied(await requester.client.from('community_group_members').insert({
    group_id: ids.privateGroup, user_id: requester.id, role: 'owner',
  }).select('group_id'), 'nonmember cannot self-promote to owner'); checks++;
  rlsDenied(await requester.client.from('community_group_members').insert({
    group_id: ids.privateGroup, user_id: requester.id, role: 'member',
  }).select('group_id'), 'nonmember cannot self-join private group'); checks++;
  empty(await admin.from('community_group_members').select('role').eq('group_id', ids.privateGroup)
    .eq('user_id', requester.id), 'private self-join attempts create no membership'); checks++;
  rlsDenied(await requester.client.from('community_posts').insert({
    user_id: requester.id, content: 'intrusion', topic_tag: 'ADVICE', group_id: ids.privateGroup,
  }).select('id'), 'nonmember cannot write private post'); checks++;
  rlsDenied(await requester.client.from('community_comments').insert({
    post_id: ids.privatePost, user_id: requester.id, content: 'intrusion',
  }).select('id'), 'nonmember cannot comment on private post'); checks++;
  rlsDenied(await requester.client.from('community_likes').insert({
    post_id: ids.privatePost, user_id: requester.id,
  }).select('post_id'), 'nonmember cannot like private post'); checks++;
  rlsDenied(await requester.client.from('community_saves').insert({
    post_id: ids.privatePost, user_id: requester.id,
  }).select('post_id'), 'nonmember cannot save private post'); checks++;
  rlsDenied(await requester.client.from('community_reports').insert({
    post_id: ids.privatePost, reporter_id: requester.id,
  }).select('post_id'), 'nonmember cannot report private post'); checks++;
  rlsDenied(await requester.client.from('community_comment_likes').insert({
    comment_id: ids.privateComment, user_id: requester.id,
  }).select('comment_id'), 'nonmember cannot like private comment'); checks++;
  rlsDenied(await requester.client.from('community_poll_votes').insert({
    post_id: ids.privatePost, user_id: requester.id, option_id: 'a',
  }).select('post_id'), 'nonmember cannot vote on private post'); checks++;

  required(await requester.client.from('community_group_requests').upsert({
    group_id: ids.privateGroup, user_id: requester.id, status: 'pending',
  }), 'nonmember requests private membership');
  required(await requester.client.from('community_group_requests').upsert({
    group_id: ids.privateGroup, user_id: requester.id, status: 'pending',
  }), 'pending request retry');
  const selfApprove = await requester.client.from('community_group_requests')
    .update({ status: 'approved' }).eq('group_id', ids.privateGroup).eq('user_id', requester.id)
    .select('status');
  denied(selfApprove, 'requester cannot approve themselves directly'); checks++;
  const directOwnerApproval = await owner.client.from('community_group_requests')
    .update({ status: 'approved' }).eq('group_id', ids.privateGroup)
    .eq('user_id', requester.id).select('status');
  denied(directOwnerApproval, 'owner must use atomic approval RPC'); checks++;
  check(required(await admin.from('community_group_requests').select('status')
    .eq('group_id', ids.privateGroup).eq('user_id', requester.id).single(), 'request persisted').status === 'pending', 'request remains pending');
  const missingApproval = await owner.client.rpc('approve_group_join_request', {
    p_group_id: ids.privateGroup, p_requester_user_id: randomUUID(),
  });
  check(!!missingApproval.error, 'owner cannot approve an absent request');
  const unauthorizedApproval = await requester.client.rpc('approve_group_join_request', {
    p_group_id: ids.privateGroup, p_requester_user_id: requester.id,
  });
  check(!!unauthorizedApproval.error, 'requester cannot invoke owner approval');
  const [approvalA, approvalB] = await Promise.all([
    owner.client.rpc('approve_group_join_request', { p_group_id: ids.privateGroup, p_requester_user_id: requester.id }),
    owner.client.rpc('approve_group_join_request', { p_group_id: ids.privateGroup, p_requester_user_id: requester.id }),
  ]);
  check(!approvalA.error && !approvalB.error && [approvalA.data, approvalB.data].sort().join(',') === 'false,true', 'concurrent approval changes membership once');
  check(required(await requester.client.from('community_posts').select('id').eq('id', ids.privatePost), 'member private read').length === 1, 'approved member reads private post');
  const memberTally = required(await requester.client.rpc('get_poll_vote_counts', { post_ids: [ids.privatePost] }), 'member poll tally');
  check(memberTally.length === 1 && memberTally[0].option_id === 'a' && memberTally[0].votes === 1, 'member receives private poll count');
  check(required(await requester.client.from('community_group_members').select('role')
    .eq('group_id', ids.privateGroup).eq('user_id', requester.id), 'member role read')[0]?.role === 'member', 'approved request grants member role');
  denied(await requester.client.from('community_group_members').update({ role: 'owner' })
    .eq('group_id', ids.privateGroup).eq('user_id', requester.id).select('role'), 'private member cannot self-promote'); checks++;
  check(required(await admin.from('community_group_members').select('role')
    .eq('group_id', ids.privateGroup).eq('user_id', requester.id).single(), 'private role persisted').role === 'member', 'private member role unchanged');
  required(await requester.client.from('community_reports').insert({
    post_id: ids.privatePost, reporter_id: requester.id,
  }), 'member can report visible private post'); checks++;
  const duplicateReport = await requester.client.from('community_reports').insert({
    post_id: ids.privatePost, reporter_id: requester.id,
  });
  assert.equal(duplicateReport.error?.code, '23505', 'one reporter cannot inflate the moderation count'); checks++;
  check(required(await admin.from('community_posts').select('is_hidden')
    .eq('id', ids.privatePost).single(), 'moderation state after duplicate report').is_hidden === false,
  'a repeated report by one member does not hide the post');
  check(required(await owner.client.rpc('approve_group_join_request', {
    p_group_id: ids.privateGroup, p_requester_user_id: requester.id,
  }), 'idempotent approval') === false, 'repeat approval is idempotent');

  check(required(await requester.client.from('community_group_members').delete()
    .eq('group_id', ids.privateGroup).eq('user_id', requester.id).select('group_id'),
  'approved member leaves').length === 1, 'approved member can leave private group');
  required(await requester.client.from('community_group_requests').upsert({
    group_id: ids.privateGroup, user_id: requester.id, status: 'pending',
  }), 'former member requests to rejoin');
  check(required(await owner.client.rpc('approve_group_join_request', {
    p_group_id: ids.privateGroup, p_requester_user_id: requester.id,
  }), 'owner approves rejoin') === true, 'former member can be approved again');

  const createdGuest = required(await admin.auth.admin.createUser({
    email: guestEmail, password, email_confirm: true,
  }), 'create disposable guest');
  guestId = createdGuest.user.id;
  const guest = await login(guestEmail);
  empty(await guest.client.from('community_group_requests').select('user_id,status')
    .eq('group_id', ids.privateGroup).eq('user_id', requester.id), 'guest cannot read another request'); checks++;
  rlsDenied(await guest.client.from('community_group_requests').insert({
    group_id: ids.privateGroup, user_id: guest.id, status: 'approved',
  }).select('status'), 'requester cannot insert approved status'); checks++;
  required(await guest.client.from('community_group_requests').insert({
    group_id: ids.privateGroup, user_id: guest.id, status: 'pending',
  }), 'guest requests private membership');
  check(required(await owner.client.rpc('reject_group_join_request', {
    p_group_id: ids.privateGroup, p_requester_user_id: guest.id,
  }), 'owner rejects guest') === true, 'pending request can be rejected');
  const rejectedApproval = await owner.client.rpc('approve_group_join_request', {
    p_group_id: ids.privateGroup, p_requester_user_id: guest.id,
  });
  check(!!rejectedApproval.error, 'rejected request cannot be approved');
  required(await guest.client.from('community_group_requests').upsert({
    group_id: ids.privateGroup, user_id: guest.id, status: 'pending',
  }), 'guest retries private request');
  required(await admin.from('community_group_members').insert({
    group_id: ids.privateGroup, user_id: guest.id, role: 'moderator',
  }), 'synthetic existing elevated role');
  check(required(await owner.client.rpc('approve_group_join_request', {
    p_group_id: ids.privateGroup, p_requester_user_id: guest.id,
  }), 'approve pending existing moderator') === true, 'pending request with membership can be approved');
  check(required(await admin.from('community_group_members').select('role').eq('group_id', ids.privateGroup)
    .eq('user_id', guest.id).single(), 'preserved role').role === 'moderator', 'approval preserves moderator role');

  const movedPost = await owner.client.from('community_posts').update({ group_id: null })
    .eq('id', ids.privatePost).select('id');
  triggerDenied(movedPost, 'private post cannot be moved to public feed'); checks++;
  required(await owner.client.from('community_groups').insert({
    id: ids.publicGroup, slug: `e2e-public-${tag.slice(0, 12)}`,
    name: 'Synthetic public community', creator_id: owner.id, is_private: false,
  }), 'owner creates public group');
  required(await owner.client.from('community_posts').insert({
    id: ids.publicPost, user_id: owner.id, content: 'public synthetic content',
    topic_tag: 'ADVICE', group_id: ids.publicGroup,
  }), 'owner creates public post');
  const movedComment = await owner.client.from('community_comments').update({ post_id: ids.publicPost })
    .eq('id', ids.privateComment).select('id');
  triggerDenied(movedComment, 'private comment cannot be moved to another existing post'); checks++;
  check(required(await requester.client.from('community_posts').select('id')
    .eq('id', ids.publicPost), 'public post read').length === 1, 'public post remains visible');
  rlsDenied(await requester.client.from('community_group_members').insert({
    group_id: ids.publicGroup, user_id: requester.id, role: 'owner',
  }).select('role'), 'public self-promotion rejected'); checks++;
  empty(await admin.from('community_group_members').select('role').eq('group_id', ids.publicGroup)
    .eq('user_id', requester.id), 'public owner attempt creates no membership'); checks++;
  required(await requester.client.from('community_group_members').upsert({
    group_id: ids.publicGroup, user_id: requester.id, role: 'member',
  }, { onConflict: 'group_id,user_id', ignoreDuplicates: true }), 'public self-join');
  check(required(await requester.client.from('community_group_members').select('role')
    .eq('group_id', ids.publicGroup).eq('user_id', requester.id), 'public member read')[0]?.role === 'member', 'public self-join grants only member role');
  denied(await requester.client.from('community_group_members').update({ role: 'owner' })
    .eq('group_id', ids.publicGroup).eq('user_id', requester.id).select('role'), 'public member cannot self-promote'); checks++;
  check(required(await admin.from('community_group_members').select('role')
    .eq('group_id', ids.publicGroup).eq('user_id', requester.id).single(), 'public role persisted').role === 'member', 'public member role unchanged');

  required(await owner.client.from('community_comments').insert({
    id: ids.publicComment, post_id: ids.publicPost, user_id: owner.id, content: 'public comment',
  }), 'owner creates public comment');
  triggerDenied(await owner.client.from('community_comments').insert({
    post_id: ids.publicPost, parent_comment_id: ids.privateComment,
    user_id: owner.id, content: 'cross-post reply',
  }).select('id'), 'cross-post reply rejected'); checks++;
  check(required(await owner.client.from('community_posts').update({ content: 'edited private content' })
    .eq('id', ids.privatePost).select('id'), 'author edit').length === 1, 'author can edit accessible private post');
  check(required(await owner.client.from('community_comments').update({ content: 'edited private reply' })
    .eq('id', ids.privateComment).select('id'), 'author comment edit').length === 1, 'author can edit accessible private comment');

  required(await requester.client.from('community_comment_likes').insert({
    comment_id: ids.privateComment, user_id: requester.id,
  }), 'member likes owner comment');
  check(required(await owner.client.from('community_comments').delete()
    .eq('id', ids.privateComment).select('id'), 'author hard-deletes liked comment').length === 1,
  'author can hard-delete a comment liked by another member');
  empty(await admin.from('community_comment_likes').select('comment_id')
    .eq('comment_id', ids.privateComment), 'hard delete cascades comment likes'); checks++;

  required(await requester.client.from('community_posts').insert({
    id: ids.memberPost, user_id: requester.id, content: 'member group post',
    topic_tag: 'ADVICE', group_id: ids.privateGroup,
  }), 'member creates private post');
  check(required(await owner.client.from('community_groups').delete()
    .eq('id', ids.privateGroup).select('id'), 'owner deletes group with member post').length === 1,
  'owner can delete group with member content');
  empty(await admin.from('community_posts').select('id').in('id', [ids.privatePost, ids.memberPost]),
    'group delete cascades posts'); checks++;

  console.log(`Community RLS passed: ${checks} assertions using disposable local users and rows.`);
} finally {
  const cleanup = await admin.from('community_groups').delete().in('id', [ids.privateGroup, ids.publicGroup]);
  assert.ifError(cleanup.error, 'synthetic group cleanup');
  if (guestId) {
    const guestCleanup = await admin.auth.admin.deleteUser(guestId);
    assert.ifError(guestCleanup.error, 'synthetic guest cleanup');
  }
}
