-- PROD-100: community activity notifies the right person through the database.
--
-- public.notifications deliberately has no INSERT policy, so signed-in users
-- cannot forge a recipient or actor. That also refused every app-side
-- notification insert (post likes, comments, replies, comment likes, follows,
-- join request approvals), silently. This migration moves each of those
-- writes into an AFTER trigger on the row that caused it:
--
--   community_likes          post like     -> post author            'like'
--   community_comments       comment       -> post author            'comment'
--                            reply         -> parent comment author  'reply'
--                                             and the post author    'comment'
--                                             (unless they wrote the parent)
--   community_comment_likes  comment like  -> comment author         'comment_like'
--   community_follows        follow        -> followed user          'follow'
--   community_group_requests status changes to 'approved'
--                                          -> requester              'request_approved'
--
-- Recipient and actor are read from the triggering row and the rows it
-- references, never from client input. Every delivery goes through one
-- internal function that:
--   * skips self-notifications and pairs where either user blocked the other;
--   * skips posts the recipient cannot read (hidden posts, private communities
--     they are not in), mirroring can_read_community_post for that recipient;
--   * relies on idx_notifications_dedup: likes and follows never stack or
--     resurface (like/unlike/like is one row), a new comment, reply or liked
--     comment refreshes the single row as unread, and an approval resurfaces
--     its row;
--   * swallows any failure with a WARNING, so a notification problem never
--     blocks the like, comment, follow or approval itself.
--
-- 'comment_like' is added to notifications_type_check (the UI already renders
-- it). Anonymity: only community_posts has is_anonymous; comments always show
-- their author. Creating a post notifies nobody, so no notification links a
-- person to an anonymous post they wrote: its author only receives likes and
-- comments on it, readable by nobody else under the notifications SELECT
-- policy, and a reply they post in that thread names them exactly as the
-- thread already does.
--
-- Adds no policy (PROD-86's release gate requires notifications to have no
-- INSERT policy) and changes no existing function. Requires PROD-85
-- (20261004090000); does not require PROD-86 (20261007130000).
-- One transaction: SET LOCAL takes effect, and a failed check below leaves
-- nothing behind.
begin;
SET LOCAL lock_timeout = '5s';

-- Prerequisites. Abort rather than install triggers whose writes would fail
-- (and be swallowed) at runtime.
do $$
declare
  v_missing text;
  v_insert_policies integer;
begin
  if to_regprocedure('public.approve_group_join_request(uuid,uuid)') is null
     or to_regprocedure('public.can_read_community_post(uuid)') is null then
    raise exception 'Apply PROD-85 (20261004090000) before PROD-100';
  end if;

  select string_agg(req.t || '.' || req.c, ', ') into v_missing
  from (values
    ('notifications', 'user_id'), ('notifications', 'actor_id'), ('notifications', 'type'),
    ('notifications', 'post_id'), ('notifications', 'comment_id'), ('notifications', 'message'),
    ('notifications', 'is_read'), ('notifications', 'created_at'),
    ('community_likes', 'post_id'), ('community_likes', 'user_id'),
    ('community_comment_likes', 'comment_id'), ('community_comment_likes', 'user_id'),
    ('community_comments', 'id'), ('community_comments', 'post_id'), ('community_comments', 'user_id'),
    ('community_comments', 'parent_comment_id'), ('community_comments', 'is_deleted'),
    ('community_follows', 'follower_id'), ('community_follows', 'followee_id'),
    ('community_group_requests', 'group_id'), ('community_group_requests', 'user_id'),
    ('community_group_requests', 'status'),
    ('community_group_members', 'group_id'), ('community_group_members', 'user_id'),
    ('community_groups', 'id'), ('community_groups', 'creator_id'), ('community_groups', 'is_private'),
    ('community_groups', 'name'),
    ('community_posts', 'id'), ('community_posts', 'user_id'), ('community_posts', 'group_id'),
    ('community_posts', 'is_hidden'),
    ('community_blocks', 'blocker_id'), ('community_blocks', 'blocked_id')
  ) as req(t, c)
  where not exists (
    select 1 from pg_attribute a
    where a.attrelid = to_regclass('public.' || req.t) and a.attname = req.c
      and a.attnum > 0 and not a.attisdropped
  );
  if v_missing is not null then
    raise exception 'PROD-100 prerequisites missing: %', v_missing;
  end if;

  -- The ON CONFLICT target below infers this exact index.
  if to_regclass('public.idx_notifications_dedup') is null
     or pg_get_indexdef('public.idx_notifications_dedup'::regclass) <>
       'CREATE UNIQUE INDEX idx_notifications_dedup ON public.notifications USING btree '
       '(user_id, actor_id, type, COALESCE(post_id, ''00000000-0000-0000-0000-000000000000''::uuid))' then
    raise exception 'idx_notifications_dedup differs from the reviewed baseline; review before applying PROD-100';
  end if;

  -- The forgery guarantee depends on signed-in users having no direct
  -- INSERT path into notifications (same gate as PROD-86).
  select count(*) into v_insert_policies from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and cmd in ('INSERT', 'ALL');
  if v_insert_policies <> 0 then
    raise exception 'notifications has an INSERT policy; review notification forgery before applying PROD-100';
  end if;
end;
$$;

-- Allow 'comment_like'. Only the reviewed baseline is replaced; a reapply
-- finds the target set and does nothing. The new set is a superset, so
-- validation cannot fail. NOT VALID + VALIDATE does not shorten the lock
-- inside this one transaction; the ACCESS EXCLUSIVE lock lasts as long as a
-- scan of a table whose app writes have all been refused until now.
do $$
declare
  v_def text;
  v_values text[];
  v_baseline text[] := array['comment', 'follow', 'join_request', 'like', 'reply', 'request_approved', 'request_rejected'];
  v_target text[] := array['comment', 'comment_like', 'follow', 'join_request', 'like', 'reply', 'request_approved', 'request_rejected'];
begin
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
    where c.conrelid = 'public.notifications'::regclass and c.conname = 'notifications_type_check' and c.contype = 'c';
  select array_agg(m[1] order by m[1] collate "C") into v_values
    from regexp_matches(coalesce(v_def, ''), '''([a-z_]+)''::text', 'g') as m;
  if v_def like 'CHECK ((type = ANY (ARRAY[%' and v_values = v_target then
    return;
  end if;
  if v_def is null or v_def not like 'CHECK ((type = ANY (ARRAY[%' or v_values is distinct from v_baseline then
    raise exception 'notifications_type_check differs from the reviewed baseline; review before applying PROD-100';
  end if;
  alter table public.notifications
    drop constraint notifications_type_check,
    add constraint notifications_type_check check (type = any (array[
      'like'::text, 'comment'::text, 'reply'::text, 'follow'::text, 'join_request'::text,
      'request_approved'::text, 'request_rejected'::text, 'comment_like'::text
    ])) not valid;
  alter table public.notifications validate constraint notifications_type_check;
end;
$$;

-- The single delivery path. Invoker rights on purpose: only the definer
-- trigger functions below (same owner) call it, and if it were ever exposed
-- to a signed-in caller, RLS would still refuse the insert.
create or replace function public.community_deliver_notification(
  p_recipient uuid, p_actor uuid, p_type text, p_post_id uuid, p_comment_id uuid,
  p_message text, p_resurface boolean
)
returns void language plpgsql set search_path = ''
as $$
begin
  if p_recipient is null or p_actor is null or p_recipient = p_actor then
    return;
  end if;
  if exists (
    select 1 from public.community_blocks b
    where (b.blocker_id = p_recipient and b.blocked_id = p_actor)
       or (b.blocker_id = p_actor and b.blocked_id = p_recipient)
  ) then
    return;
  end if;
  -- can_read_community_post, evaluated for the recipient instead of auth.uid().
  if p_post_id is not null and not exists (
    select 1 from public.community_posts p
    where p.id = p_post_id
      and (not p.is_hidden or p.user_id = p_recipient)
      and (p.group_id is null or exists (
        select 1 from public.community_groups g
        where g.id = p.group_id and (
          not g.is_private or g.creator_id = p_recipient or exists (
            select 1 from public.community_group_members m
            where m.group_id = g.id and m.user_id = p_recipient
          )
        )
      ))
  ) then
    return;
  end if;

  insert into public.notifications as n (user_id, actor_id, type, post_id, comment_id, message)
    values (p_recipient, p_actor, p_type, p_post_id, p_comment_id, p_message)
    on conflict (user_id, actor_id, type, (coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    do update set comment_id = excluded.comment_id, message = excluded.message,
      is_read = false, created_at = now()
    where p_resurface or n.comment_id is distinct from excluded.comment_id;
exception when others then
  raise warning 'community % notification not delivered: % (SQLSTATE %)', p_type, sqlerrm, sqlstate;
end;
$$;

create or replace function public.community_notify_post_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_author uuid;
begin
  begin
    select p.user_id into v_author from public.community_posts p where p.id = new.post_id;
    perform public.community_deliver_notification(v_author, new.user_id, 'like', new.post_id, null, null, false);
  exception when others then
    raise warning 'community like notification not delivered: % (SQLSTATE %)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create or replace function public.community_notify_comment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  begin
    select p.user_id into v_post_author from public.community_posts p where p.id = new.post_id;
    if new.parent_comment_id is not null then
      select c.user_id into v_parent_author from public.community_comments c where c.id = new.parent_comment_id;
      perform public.community_deliver_notification(v_parent_author, new.user_id, 'reply', new.post_id, new.id, null, false);
    end if;
    -- A post author who wrote the parent already received the reply.
    if new.parent_comment_id is null or v_post_author is distinct from v_parent_author then
      perform public.community_deliver_notification(v_post_author, new.user_id, 'comment', new.post_id, new.id, null, false);
    end if;
  exception when others then
    raise warning 'community comment notification not delivered: % (SQLSTATE %)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create or replace function public.community_notify_comment_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_author uuid;
  v_post uuid;
  v_deleted boolean;
begin
  begin
    select c.user_id, c.post_id, c.is_deleted into v_author, v_post, v_deleted
      from public.community_comments c where c.id = new.comment_id;
    if not coalesce(v_deleted, true) then
      perform public.community_deliver_notification(v_author, new.user_id, 'comment_like', v_post, new.comment_id, null, false);
    end if;
  exception when others then
    raise warning 'community comment_like notification not delivered: % (SQLSTATE %)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

create or replace function public.community_notify_follow()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  begin
    perform public.community_deliver_notification(new.followee_id, new.follower_id, 'follow', null, null, null, false);
  exception when others then
    raise warning 'community follow notification not delivered: % (SQLSTATE %)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

-- Fires on the request's transition to 'approved'. Only
-- approve_group_join_request makes that transition (owners have no UPDATE
-- policy on requests; requesters may only reset to 'pending'), and it adds
-- the membership first, so the RPC is reused unchanged. A repeated approval
-- changes no row and so never notifies twice. The actor is the group owner,
-- read from the group, not the caller.
create or replace function public.community_notify_request_approved()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_group_name text;
begin
  begin
    select g.creator_id, g.name into v_owner, v_group_name
      from public.community_groups g where g.id = new.group_id;
    if exists (
      select 1 from public.community_group_members m
      where m.group_id = new.group_id and m.user_id = new.user_id
    ) then
      perform public.community_deliver_notification(new.user_id, v_owner, 'request_approved', null, null,
        'Your request to join ' || v_group_name || ' was approved', true);
    end if;
  exception when others then
    raise warning 'community request_approved notification not delivered: % (SQLSTATE %)', sqlerrm, sqlstate;
  end;
  return null;
end;
$$;

-- CREATE OR REPLACE TRIGGER (PostgreSQL 14+) is idempotent and takes SHARE
-- ROW EXCLUSIVE, whereas DROP TRIGGER would take ACCESS EXCLUSIVE and block
-- feed reads on these tables while waiting for the lock.
create or replace trigger trg_community_notify_post_like
  after insert on public.community_likes
  for each row execute function public.community_notify_post_like();
create or replace trigger trg_community_notify_comment
  after insert on public.community_comments
  for each row when (not new.is_deleted) execute function public.community_notify_comment();
create or replace trigger trg_community_notify_comment_like
  after insert on public.community_comment_likes
  for each row execute function public.community_notify_comment_like();
create or replace trigger trg_community_notify_follow
  after insert on public.community_follows
  for each row execute function public.community_notify_follow();
create or replace trigger trg_community_notify_request_approved
  after update of status on public.community_group_requests
  for each row when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.community_notify_request_approved();

-- Nothing here is callable through the API. Trigger functions need no
-- EXECUTE grant to fire.
revoke all on function public.community_deliver_notification(uuid, uuid, text, uuid, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.community_notify_post_like() from public, anon, authenticated;
revoke all on function public.community_notify_comment() from public, anon, authenticated;
revoke all on function public.community_notify_comment_like() from public, anon, authenticated;
revoke all on function public.community_notify_follow() from public, anon, authenticated;
revoke all on function public.community_notify_request_approved() from public, anon, authenticated;

-- Release self-check: ownership, rights, search_path, grants, bindings,
-- constraint and the no-INSERT-policy gate as reviewed.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and cmd in ('INSERT', 'ALL');
  if v_count <> 0 then
    raise exception 'notifications has an INSERT policy; review notification forgery before applying PROD-100';
  end if;

  select count(*) into v_count from pg_proc p
    where p.oid in (
      to_regprocedure('public.community_deliver_notification(uuid,uuid,text,uuid,uuid,text,boolean)'),
      to_regprocedure('public.community_notify_post_like()'),
      to_regprocedure('public.community_notify_comment()'),
      to_regprocedure('public.community_notify_comment_like()'),
      to_regprocedure('public.community_notify_follow()'),
      to_regprocedure('public.community_notify_request_approved()')
    )
      and pg_get_userbyid(p.proowner) = current_user
      and p.prosecdef = (p.proname <> 'community_deliver_notification')
      and p.proconfig @> array['search_path=""']
      and not has_function_privilege('anon', p.oid, 'execute')
      and not has_function_privilege('authenticated', p.oid, 'execute')
      and not exists (
        select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE'
      );
  if v_count <> 6 then
    raise exception 'PROD-100 notification functions differ from the reviewed ownership, rights or grants';
  end if;

  select count(*) into v_count from pg_trigger t
    where not t.tgisinternal and t.tgenabled = 'O' and (t.tgrelid, t.tgname, t.tgfoid) in (
      ('public.community_likes'::regclass::oid, 'trg_community_notify_post_like'::name,
        'public.community_notify_post_like()'::regprocedure::oid),
      ('public.community_comments'::regclass::oid, 'trg_community_notify_comment'::name,
        'public.community_notify_comment()'::regprocedure::oid),
      ('public.community_comment_likes'::regclass::oid, 'trg_community_notify_comment_like'::name,
        'public.community_notify_comment_like()'::regprocedure::oid),
      ('public.community_follows'::regclass::oid, 'trg_community_notify_follow'::name,
        'public.community_notify_follow()'::regprocedure::oid),
      ('public.community_group_requests'::regclass::oid, 'trg_community_notify_request_approved'::name,
        'public.community_notify_request_approved()'::regprocedure::oid)
    );
  if v_count <> 5 then
    raise exception 'PROD-100 notification triggers are missing, disabled or bound to other functions';
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.notifications'::regclass and c.conname = 'notifications_type_check'
      and c.convalidated and pg_get_constraintdef(c.oid) like '%''comment_like''::text%'
  ) then
    raise exception 'notifications_type_check does not allow a validated comment_like';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
