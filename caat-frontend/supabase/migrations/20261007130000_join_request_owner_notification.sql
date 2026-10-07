-- PROD-86: a private community join request reliably notifies the owner.
--
-- After PROD-85 a requester cannot read a private group, so the app could not
-- look up the owner, and public.notifications has no INSERT policy, so the
-- app-side notification insert was refused as well. Both failures were
-- silent. This migration adds two narrow definer functions and changes no
-- table, policy or existing function:
--
--   request_community_group_join(group id)
--     Records the caller's pending request and notifies the owner in one
--     transaction. The caller supplies only the group id; the recipient
--     (group owner), actor (auth.uid()), type and message are derived here.
--     A retry while the request is pending never notifies again.
--
--   get_community_group_join_card(slug)
--     The deliberately minimal join screen for a private community the
--     caller reached by its link but cannot read: id, name and whether the
--     caller already has a pending request. No description, posts, members
--     or counts.
--
-- Requires 20261004090000_secure_community_groups_and_content.sql (PROD-85).
SET LOCAL lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.can_request_community_group(uuid)') is null then
    raise exception 'Apply PROD-85 (20261004090000) before PROD-86';
  end if;
end;
$$;

create or replace function public.request_community_group_join(p_group_id uuid)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_group_name text;
  v_changed boolean;
  v_requester_name text;
  v_message text;
begin
  if v_actor is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  -- Share-lock the group so its owner and privacy cannot change mid-request.
  select g.creator_id, g.name into v_owner, v_group_name
    from public.community_groups g
    where g.id = p_group_id and g.is_private
    for share;
  -- One message for missing, public and own groups: nothing to probe.
  if v_owner is null or v_owner = v_actor then
    raise exception 'This community is not accepting join requests' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.community_group_members m
    where m.group_id = p_group_id and m.user_id = v_actor
  ) then
    return 'member';
  end if;

  -- Concurrent calls serialise on the request's primary key. Only a new row
  -- or a change into pending returns a row, so retries cannot notify twice.
  insert into public.community_group_requests as r (group_id, user_id, status)
    values (p_group_id, v_actor, 'pending')
    on conflict (group_id, user_id) do update set status = 'pending'
      where r.status is distinct from 'pending'
    returning true into v_changed;
  if v_changed is null then
    return 'pending';
  end if;

  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '')
    into v_requester_name
    from public.profiles p where p.id = v_actor;
  v_message := coalesce(v_requester_name, 'Someone') || ' requested to join ' || v_group_name;

  -- idx_notifications_dedup keeps one join_request row per owner and
  -- requester; a genuine new request resurfaces it as unread.
  insert into public.notifications (user_id, actor_id, type, post_id, message)
    values (v_owner, v_actor, 'join_request', null, v_message)
    on conflict do nothing;
  if not found then
    update public.notifications n
      set message = v_message, is_read = false, created_at = now()
      where n.user_id = v_owner and n.actor_id = v_actor
        and n.type = 'join_request' and n.post_id is null;
  end if;
  return 'requested';
end;
$$;

create or replace function public.get_community_group_join_card(p_slug text)
returns table (id uuid, name text, has_pending_request boolean)
language sql stable security definer set search_path = ''
as $$
  select g.id, g.name, exists (
      select 1 from public.community_group_requests r
      where r.group_id = g.id and r.user_id = auth.uid() and r.status = 'pending'
    )
  from public.community_groups g
  where auth.uid() is not null
    and g.slug = p_slug
    and g.is_private
    and public.can_request_community_group(g.id);
$$;

revoke all on function public.request_community_group_join(uuid) from public, anon;
revoke all on function public.get_community_group_join_card(text) from public, anon;
grant execute on function public.request_community_group_join(uuid) to authenticated;
grant execute on function public.get_community_group_join_card(text) to authenticated;

-- Release gate. The forgery guarantee depends on signed-in users having no
-- direct INSERT path into notifications; stop if live policies differ.
do $$
declare
  v_insert_policies integer;
  v_function_count integer;
begin
  select count(*) into v_insert_policies from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and cmd in ('INSERT', 'ALL');
  if v_insert_policies <> 0 then
    raise exception 'notifications has an INSERT policy; review notification forgery before applying PROD-86';
  end if;

  select count(*) into v_function_count from pg_proc p
    where p.oid in (
      to_regprocedure('public.request_community_group_join(uuid)'),
      to_regprocedure('public.get_community_group_join_card(text)')
    ) and p.prosecdef and pg_get_userbyid(p.proowner) = current_user
      and not has_function_privilege('anon', p.oid, 'execute')
      and has_function_privilege('authenticated', p.oid, 'execute');
  if v_function_count <> 2 then
    raise exception 'PROD-86 definer functions differ from the reviewed ownership or grants';
  end if;
end;
$$;

notify pgrst, 'reload schema';
