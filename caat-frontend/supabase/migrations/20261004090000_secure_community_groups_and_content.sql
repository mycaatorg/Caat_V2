-- PROD-85: enforce community privacy and atomic group membership transitions.
-- Apply as the table-owning migration role. All definer functions use caller auth.uid().
begin;

-- A local migration may be reapplied without widening access or creating duplicate policies.
drop policy if exists poll_votes_insert_own on public.community_poll_votes;
drop policy if exists poll_votes_update_own on public.community_poll_votes;
drop policy if exists poll_votes_delete_own on public.community_poll_votes;
drop policy if exists comment_likes_select on public.community_comment_likes;
drop policy if exists comment_likes_insert on public.community_comment_likes;
drop policy if exists comment_likes_delete on public.community_comment_likes;
drop policy if exists requests_select on public.community_group_requests;
drop policy if exists requests_insert_pending on public.community_group_requests;
drop policy if exists requests_reset_pending on public.community_group_requests;

create or replace function public.can_access_community_group(p_group_id uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  return auth.uid() is not null and exists (
    select 1 from public.community_groups g
    where g.id = p_group_id and (
      not g.is_private or g.creator_id = auth.uid() or exists (
        select 1 from public.community_group_members m
        where m.group_id = g.id and m.user_id = auth.uid()
      )
    )
  );
end;
$$;

create or replace function public.can_write_community_group(p_group_id uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  return auth.uid() is not null and exists (
    select 1 from public.community_groups g
    where g.id = p_group_id and (
      not g.is_private or g.creator_id = auth.uid() or exists (
        select 1 from public.community_group_members m
        where m.group_id = g.id and m.user_id = auth.uid()
      )
    )
  );
end;
$$;

create or replace function public.can_request_community_group(p_group_id uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  return auth.uid() is not null and exists (
    select 1 from public.community_groups g
    where g.id = p_group_id and g.is_private
      and g.creator_id is distinct from auth.uid()
      and not exists (
        select 1 from public.community_group_members m
        where m.group_id = g.id and m.user_id = auth.uid()
      )
  );
end;
$$;

create or replace function public.can_read_community_post(p_post_id uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  return auth.uid() is not null and exists (
    select 1 from public.community_posts p
    where p.id = p_post_id
      and (not p.is_hidden or p.user_id = auth.uid())
      and (p.group_id is null or public.can_access_community_group(p.group_id))
  );
end;
$$;

create or replace function public.can_read_community_comment(p_comment_id uuid)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
begin
  return exists (
    select 1 from public.community_comments c
    where c.id = p_comment_id and public.can_read_community_post(c.post_id)
  );
end;
$$;

-- No caller may choose a viewer identity for these helpers.
drop policy if exists group_members_select_visible on public.community_group_members;
drop function if exists public.can_view_group_members(uuid, uuid);
revoke all on function public.can_access_community_group(uuid) from public, anon;
revoke all on function public.can_write_community_group(uuid) from public, anon;
revoke all on function public.can_request_community_group(uuid) from public, anon;
revoke all on function public.can_read_community_post(uuid) from public, anon;
revoke all on function public.can_read_community_comment(uuid) from public, anon;
grant execute on function public.can_access_community_group(uuid) to authenticated;
grant execute on function public.can_write_community_group(uuid) to authenticated;
grant execute on function public.can_request_community_group(uuid) to authenticated;
grant execute on function public.can_read_community_post(uuid) to authenticated;
grant execute on function public.can_read_community_comment(uuid) to authenticated;

drop policy if exists groups_select on public.community_groups;
create policy groups_select on public.community_groups for select to authenticated
  using (not is_private or creator_id = auth.uid() or
    public.can_access_community_group(id));
-- Reassert the creator boundary before the owner-membership trigger trusts it.
drop policy if exists groups_insert on public.community_groups;
create policy groups_insert on public.community_groups for insert to authenticated
  with check (creator_id = auth.uid());
drop policy if exists groups_update on public.community_groups;
create policy groups_update on public.community_groups for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());
drop policy if exists groups_delete on public.community_groups;
create policy groups_delete on public.community_groups for delete to authenticated
  using (creator_id = auth.uid());
create policy group_members_select_visible on public.community_group_members for select to authenticated
  using (public.can_access_community_group(group_id));
drop policy if exists members_insert on public.community_group_members;
create policy members_insert on public.community_group_members for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'member' and exists (
      select 1 from public.community_groups g where g.id = group_id and not g.is_private
    )
  );
drop policy if exists members_delete on public.community_group_members;
create policy members_delete on public.community_group_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner' and not exists (
    select 1 from public.community_groups g where g.id = group_id and g.creator_id = auth.uid()
  ));

-- A group and its owner membership are one PostgreSQL statement/transaction.
create or replace function public.community_add_creator_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.creator_id is not null then
    insert into public.community_group_members (group_id, user_id, role)
    values (new.id, new.creator_id, 'owner');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_community_add_creator_membership on public.community_groups;
create trigger trg_community_add_creator_membership after insert on public.community_groups
  for each row execute function public.community_add_creator_membership();
revoke all on function public.community_add_creator_membership() from public, anon, authenticated;

-- Keep group_id fixed after a post accumulates comments/interactions. Otherwise a
-- post could be moved from a private group into the public feed with its children.
create or replace function public.community_keep_post_scope()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.group_id is distinct from old.group_id then
    raise exception 'A post cannot move between communities' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_community_keep_post_scope on public.community_posts;
create trigger trg_community_keep_post_scope before update of group_id on public.community_posts
  for each row execute function public.community_keep_post_scope();
revoke all on function public.community_keep_post_scope() from public, anon, authenticated;

drop policy if exists posts_select on public.community_posts;
create policy posts_select on public.community_posts for select to authenticated
  using ((not is_hidden or user_id = auth.uid()) and
    (group_id is null or public.can_access_community_group(group_id)));
drop policy if exists posts_insert on public.community_posts;
create policy posts_insert on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and
    (group_id is null or public.can_write_community_group(group_id)));
drop policy if exists posts_update on public.community_posts;
create policy posts_update on public.community_posts for update to authenticated
  using (user_id = auth.uid() and
    (group_id is null or public.can_write_community_group(group_id)))
  with check (user_id = auth.uid() and
    (group_id is null or public.can_write_community_group(group_id)));
drop policy if exists posts_delete on public.community_posts;
create policy posts_delete on public.community_posts for delete to authenticated
  using (user_id = auth.uid() and
    (group_id is null or public.can_write_community_group(group_id)));

-- A reply's parent is immutable and must belong to the same post. This guards
-- direct REST writes as well as the server action's existing validation.
create or replace function public.community_check_comment_lineage()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.post_id is distinct from old.post_id or
      new.parent_comment_id is distinct from old.parent_comment_id then
      raise exception 'Comment post and parent cannot change' using errcode = '23514';
    end if;
  end if;
  if new.parent_comment_id is not null and not exists (
    select 1 from public.community_comments parent
    where parent.id = new.parent_comment_id and parent.post_id = new.post_id
      and parent.id <> new.id
  ) then
    raise exception 'Parent comment must belong to the same post' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_community_check_comment_lineage on public.community_comments;
create trigger trg_community_check_comment_lineage
  before insert or update of post_id, parent_comment_id on public.community_comments
  for each row execute function public.community_check_comment_lineage();
revoke all on function public.community_check_comment_lineage() from public, anon, authenticated;

drop policy if exists comments_select on public.community_comments;
create policy comments_select on public.community_comments for select to authenticated
  using (public.can_read_community_post(post_id));
drop policy if exists comments_insert on public.community_comments;
create policy comments_insert on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists comments_update on public.community_comments;
create policy comments_update on public.community_comments for update to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id))
  with check (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists comments_delete on public.community_comments;
create policy comments_delete on public.community_comments for delete to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id));

drop policy if exists likes_select on public.community_likes;
create policy likes_select on public.community_likes for select to authenticated
  using (public.can_read_community_post(post_id));
drop policy if exists likes_insert on public.community_likes;
create policy likes_insert on public.community_likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists likes_delete on public.community_likes;
create policy likes_delete on public.community_likes for delete to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id));

drop policy if exists saves_select on public.community_saves;
create policy saves_select on public.community_saves for select to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists saves_insert on public.community_saves;
create policy saves_insert on public.community_saves for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists saves_delete on public.community_saves;
create policy saves_delete on public.community_saves for delete to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id));

drop policy if exists reports_insert on public.community_reports;
create policy reports_insert on public.community_reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.can_read_community_post(post_id));

-- The historical report trigger reads auth.users to count trusted reporters.
-- An authenticated caller cannot SELECT that table, so valid reports need the
-- trigger to run as the table-owning migration role with a fixed search path.
create or replace function public.check_post_reports()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_total integer;
  v_trusted integer;
begin
  select count(*) into v_total from public.community_reports r
    where r.post_id = new.post_id;
  select count(*) into v_trusted
    from public.community_reports r join auth.users u on u.id = r.reporter_id
    where r.post_id = new.post_id and u.created_at < (now() - interval '7 days');
  if v_total >= 5 or v_trusted >= 3 then
    update public.community_posts set is_hidden = true where id = new.post_id;
  end if;
  return new;
end;
$$;
revoke all on function public.check_post_reports() from public, anon, authenticated;

drop policy if exists poll_votes_select_own on public.community_poll_votes;
create policy poll_votes_select_own on public.community_poll_votes for select to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists "Users can insert own vote" on public.community_poll_votes;
create policy poll_votes_insert_own on public.community_poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists "Users can update own vote" on public.community_poll_votes;
create policy poll_votes_update_own on public.community_poll_votes for update to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id))
  with check (user_id = auth.uid() and public.can_read_community_post(post_id));
drop policy if exists "Users can delete own vote" on public.community_poll_votes;
create policy poll_votes_delete_own on public.community_poll_votes for delete to authenticated
  using (user_id = auth.uid() and public.can_read_community_post(post_id));

drop policy if exists "Anyone can read comment likes" on public.community_comment_likes;
drop policy if exists "Users manage own comment likes" on public.community_comment_likes;
create policy comment_likes_select on public.community_comment_likes for select to authenticated
  using (public.can_read_community_comment(comment_id));
create policy comment_likes_insert on public.community_comment_likes for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_community_comment(comment_id));
create policy comment_likes_delete on public.community_comment_likes for delete to authenticated
  using (user_id = auth.uid() and public.can_read_community_comment(comment_id));

-- Requesters may create/reset only their own pending private-group request.
-- Owners view requests, but all status transitions use atomic definer RPCs.
create or replace function public.community_keep_request_identity()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.group_id is distinct from old.group_id or new.user_id is distinct from old.user_id then
    raise exception 'Request group and user cannot change' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_community_keep_request_identity on public.community_group_requests;
create trigger trg_community_keep_request_identity
  before update of group_id, user_id on public.community_group_requests
  for each row execute function public.community_keep_request_identity();
revoke all on function public.community_keep_request_identity() from public, anon, authenticated;

drop policy if exists owner_manage_requests on public.community_group_requests;
drop policy if exists users_insert_requests on public.community_group_requests;
drop policy if exists users_view_own_requests on public.community_group_requests;
create policy requests_select on public.community_group_requests for select to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.community_groups g
    where g.id = group_id and g.creator_id = auth.uid()
  ));
create policy requests_insert_pending on public.community_group_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and
    public.can_request_community_group(group_id));
create policy requests_reset_pending on public.community_group_requests for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'pending' and
    public.can_request_community_group(group_id));

create or replace function public.approve_group_join_request(p_group_id uuid, p_requester_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select creator_id into v_owner from public.community_groups where id = p_group_id for update;
  if v_owner is distinct from auth.uid() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select status into v_status from public.community_group_requests
    where group_id = p_group_id and user_id = p_requester_user_id for update;
  if v_status = 'approved' and exists (
    select 1 from public.community_group_members
    where group_id = p_group_id and user_id = p_requester_user_id
  ) then return false; end if;
  if v_status is distinct from 'pending' then
    raise exception 'Pending join request required' using errcode = 'P0002';
  end if;
  insert into public.community_group_members (group_id, user_id, role)
    values (p_group_id, p_requester_user_id, 'member')
    on conflict (group_id, user_id) do nothing;
  update public.community_group_requests set status = 'approved'
    where group_id = p_group_id and user_id = p_requester_user_id and status = 'pending';
  if not found then raise exception 'Pending join request required' using errcode = 'P0002'; end if;
  return true;
end;
$$;

create or replace function public.reject_group_join_request(p_group_id uuid, p_requester_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  select creator_id into v_owner from public.community_groups where id = p_group_id for update;
  if v_owner is distinct from auth.uid() then raise exception 'Not authorized' using errcode = '42501'; end if;
  select status into v_status from public.community_group_requests
    where group_id = p_group_id and user_id = p_requester_user_id for update;
  if v_status = 'rejected' then return false; end if;
  if v_status is distinct from 'pending' then
    raise exception 'Pending join request required' using errcode = 'P0002';
  end if;
  update public.community_group_requests set status = 'rejected'
    where group_id = p_group_id and user_id = p_requester_user_id and status = 'pending';
  if not found then raise exception 'Pending join request required' using errcode = 'P0002'; end if;
  return true;
end;
$$;
revoke all on function public.approve_group_join_request(uuid, uuid) from public, anon;
revoke all on function public.reject_group_join_request(uuid, uuid) from public, anon;
grant execute on function public.approve_group_join_request(uuid, uuid) to authenticated;
grant execute on function public.reject_group_join_request(uuid, uuid) to authenticated;

create or replace function public.get_poll_vote_counts(post_ids uuid[])
returns table(post_id uuid, option_id text, votes bigint)
language sql stable security definer set search_path = ''
as $$
  select v.post_id, v.option_id, count(*)::bigint
  from public.community_poll_votes v
  where v.post_id = any(post_ids) and public.can_read_community_post(v.post_id)
  group by v.post_id, v.option_id;
$$;
revoke all on function public.get_poll_vote_counts(uuid[]) from public, anon;
grant execute on function public.get_poll_vote_counts(uuid[]) to authenticated;

-- Permissive policies are OR-ed. A forgotten policy with an unfamiliar name
-- would silently reopen access, so abort the whole migration on policy drift.
do $$
declare
  v_expected text[] := array[
    'community_groups|groups_select|SELECT',
    'community_groups|groups_insert|INSERT',
    'community_groups|groups_update|UPDATE',
    'community_groups|groups_delete|DELETE',
    'community_group_members|group_members_select_visible|SELECT',
    'community_group_members|members_insert|INSERT',
    'community_group_members|members_delete|DELETE',
    'community_group_requests|requests_select|SELECT',
    'community_group_requests|requests_insert_pending|INSERT',
    'community_group_requests|requests_reset_pending|UPDATE',
    'community_posts|posts_select|SELECT',
    'community_posts|posts_insert|INSERT',
    'community_posts|posts_update|UPDATE',
    'community_posts|posts_delete|DELETE',
    'community_comments|comments_select|SELECT',
    'community_comments|comments_insert|INSERT',
    'community_comments|comments_update|UPDATE',
    'community_comments|comments_delete|DELETE',
    'community_likes|likes_select|SELECT',
    'community_likes|likes_insert|INSERT',
    'community_likes|likes_delete|DELETE',
    'community_saves|saves_select|SELECT',
    'community_saves|saves_insert|INSERT',
    'community_saves|saves_delete|DELETE',
    'community_reports|reports_insert|INSERT',
    'community_poll_votes|poll_votes_select_own|SELECT',
    'community_poll_votes|poll_votes_insert_own|INSERT',
    'community_poll_votes|poll_votes_update_own|UPDATE',
    'community_poll_votes|poll_votes_delete_own|DELETE',
    'community_comment_likes|comment_likes_select|SELECT',
    'community_comment_likes|comment_likes_insert|INSERT',
    'community_comment_likes|comment_likes_delete|DELETE'
  ];
  v_actual text[];
  v_sorted_expected text[];
  v_table_count integer;
  v_function_count integer;
begin
  select array_agg(tablename || '|' || policyname || '|' || cmd
                   order by tablename, policyname, cmd)
    into v_actual
    from pg_policies
    where schemaname = 'public' and tablename in (
      'community_groups', 'community_group_members', 'community_group_requests',
      'community_posts', 'community_comments', 'community_likes',
      'community_saves', 'community_reports', 'community_poll_votes',
      'community_comment_likes'
    );
  select array_agg(item order by item) into v_sorted_expected from unnest(v_expected) item;
  if v_actual is distinct from v_sorted_expected then
    raise exception 'Unexpected community RLS policy set; review production drift before applying PROD-85';
  end if;

  select count(*) into v_table_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_roles r on r.oid = c.relowner
  where n.nspname = 'public' and c.relname in (
    'community_groups', 'community_group_members', 'community_group_requests',
    'community_posts', 'community_comments', 'community_likes',
    'community_saves', 'community_reports', 'community_poll_votes',
    'community_comment_likes'
  ) and c.relkind = 'r' and c.relrowsecurity and not c.relforcerowsecurity
    and r.rolname = current_user and r.rolbypassrls;
  if v_table_count <> 10 then
    raise exception 'Community table owner or RLS mode differs from reviewed baseline';
  end if;

  select count(*) into v_function_count from pg_proc p
  where p.oid in (
    to_regprocedure('public.can_access_community_group(uuid)'),
    to_regprocedure('public.can_write_community_group(uuid)'),
    to_regprocedure('public.can_request_community_group(uuid)'),
    to_regprocedure('public.can_read_community_post(uuid)'),
    to_regprocedure('public.can_read_community_comment(uuid)'),
    to_regprocedure('public.community_add_creator_membership()'),
    to_regprocedure('public.community_check_comment_lineage()'),
    to_regprocedure('public.check_post_reports()'),
    to_regprocedure('public.approve_group_join_request(uuid,uuid)'),
    to_regprocedure('public.reject_group_join_request(uuid,uuid)'),
    to_regprocedure('public.get_poll_vote_counts(uuid[])')
  ) and p.prosecdef and pg_get_userbyid(p.proowner) = current_user;
  if v_function_count <> 11 then
    raise exception 'Community definer function ownership differs from reviewed baseline';
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
