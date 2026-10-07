-- PROD-101: pin delete_post_children's search_path.
--
-- The BEFORE DELETE trigger on community_posts is SECURITY DEFINER but used
-- the caller's search_path for its unqualified table names. Deleting a user
-- through Supabase Auth (dashboard or admin API) cascades to their posts under
-- the auth admin role's search_path, which does not include public, so the
-- delete failed with "Database error deleting user". In-app account deletion
-- was unaffected because delete_own_account sets search_path itself.
--
-- Changes only the function's configuration; its body and trigger are untouched.

-- One transaction: SET LOCAL takes effect, and a failed check below leaves
-- nothing behind.
begin;
SET LOCAL lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.delete_post_children()') is null then
    raise exception 'public.delete_post_children() is missing; nothing to fix';
  end if;
end;
$$;

alter function public.delete_post_children() set search_path = public;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    where p.oid = to_regprocedure('public.delete_post_children()')
      and p.proconfig @> array['search_path=public']
  ) then
    raise exception 'delete_post_children search_path was not pinned';
  end if;
end;
$$;

commit;
