-- Stable owner history, including hidden/removed rows. Existing offset RPC stays
-- available during rolling deployment. Full indexes are needed: visible-only
-- feed indexes cannot serve an owner's private removal history.
create index if not exists community_posts_owner_history_idx
  on public.community_posts (user_id, created_at desc, id desc);
create index if not exists community_comments_owner_history_idx
  on public.community_comments (user_id, created_at desc, id desc);

create or replace function public.list_owned_community_content_page(
  p_created_at timestamptz default null,
  p_id uuid default null,
  p_kind text default null,
  p_direction text default 'older'
)
returns table(kind text, id uuid, content text, created_at timestamptz, removed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_direction is null or p_direction not in ('older', 'newer')
     or num_nonnulls(p_created_at, p_id, p_kind) not in (0, 3)
     or (p_kind is not null and p_kind not in ('post', 'comment'))
     or (p_created_at is not null and not isfinite(p_created_at))
     or (p_direction = 'newer' and p_created_at is null) then
    raise exception 'Invalid cursor' using errcode = '22023';
  end if;
  -- Each branch reads at most 21 candidates. Tuple bounds form index conditions,
  -- including on a generic prepared plan; kind breaks cross-table UUID ties.
  if p_direction = 'older' then
    return query
    select x.kind, x.id, x.content, x.created_at, x.removed from (
      (select 'post'::text as kind, r.id, left(r.content, 500) as content,
              r.created_at, r.is_removed as removed
       from public.community_posts r
       where r.user_id = auth.uid()
         and (r.created_at, r.id) <= (coalesce(p_created_at, 'infinity'::timestamptz), coalesce(p_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
         and (p_created_at is null or (r.created_at, r.id) <> (p_created_at, p_id)
              or 'post'::text > p_kind)
       order by r.created_at desc, r.id desc limit 21)
      union all
      (select 'comment'::text as kind, r.id, left(r.content, 500) as content,
              r.created_at, r.is_deleted as removed
       from public.community_comments r
       where r.user_id = auth.uid()
         and (r.created_at, r.id) <= (coalesce(p_created_at, 'infinity'::timestamptz), coalesce(p_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
         and (p_created_at is null or (r.created_at, r.id) <> (p_created_at, p_id)
              or 'comment'::text > p_kind)
       order by r.created_at desc, r.id desc limit 21)
    ) x order by x.created_at desc, x.id desc, x.kind asc limit 21;
  else
    return query
    select x.kind, x.id, x.content, x.created_at, x.removed from (
      (select 'post'::text as kind, r.id, left(r.content, 500) as content,
              r.created_at, r.is_removed as removed
       from public.community_posts r
       where r.user_id = auth.uid()
         and (r.created_at, r.id) >= (p_created_at, p_id)
         and (p_created_at is null or (r.created_at, r.id) <> (p_created_at, p_id)
              or 'post'::text < p_kind)
       order by r.created_at asc, r.id asc limit 21)
      union all
      (select 'comment'::text as kind, r.id, left(r.content, 500) as content,
              r.created_at, r.is_deleted as removed
       from public.community_comments r
       where r.user_id = auth.uid()
         and (r.created_at, r.id) >= (p_created_at, p_id)
         and (p_created_at is null or (r.created_at, r.id) <> (p_created_at, p_id)
              or 'comment'::text < p_kind)
       order by r.created_at asc, r.id asc limit 21)
    ) x order by x.created_at asc, x.id asc, x.kind desc limit 21;
  end if;
end;
$$;
revoke all on function public.list_owned_community_content_page(timestamptz, uuid, text, text) from public, anon;
grant execute on function public.list_owned_community_content_page(timestamptz, uuid, text, text) to authenticated;
notify pgrst, 'reload schema';
