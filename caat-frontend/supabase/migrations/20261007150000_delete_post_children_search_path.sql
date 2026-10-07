-- PROD-101: pin the search_path of the community cleanup triggers.
--
-- The BEFORE DELETE trigger on community_posts is SECURITY DEFINER but used
-- the caller's search_path for its unqualified table names. Deleting a user
-- through Supabase Auth (dashboard or admin API) cascades to their posts under
-- the auth admin role's search_path, which does not include public, so the
-- delete failed with "Database error deleting user". In-app account deletion
-- was unaffected because delete_own_account sets search_path itself.
--
-- delete_group_children has the same gap (not reached by user deletion today,
-- since groups only null their creator_id), so it is pinned too. pg_temp is
-- listed last so a session's temporary tables can never shadow public ones.
-- Changes only the functions' configuration; bodies and triggers are untouched.

-- One transaction: SET LOCAL takes effect, and a failed check below leaves
-- nothing behind.
begin;
SET LOCAL lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.delete_post_children()') is null
    or to_regprocedure('public.delete_group_children()') is null then
    raise exception 'delete_post_children() or delete_group_children() is missing; nothing to fix';
  end if;
end;
$$;

alter function public.delete_post_children() set search_path = public, pg_temp;
alter function public.delete_group_children() set search_path = public, pg_temp;

do $$
begin
  if (
    select count(*) from pg_proc p
    where p.oid in (to_regprocedure('public.delete_post_children()'), to_regprocedure('public.delete_group_children()'))
      and p.proconfig @> array['search_path=public, pg_temp']
  ) <> 2 then
    raise exception 'community cleanup trigger search_path was not pinned';
  end if;
end;
$$;

commit;
