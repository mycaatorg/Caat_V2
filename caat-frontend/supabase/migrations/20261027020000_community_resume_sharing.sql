-- PROD-97: explicitly published resume copies. Original drafts stay owner-only.
begin;
-- Consumed IDs survive post/copy removal, so delayed requests cannot republish
-- personal data. Only identity metadata is retained, until account deletion.
create table public.community_resume_publications (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index community_resume_publications_owner on public.community_resume_publications(user_id);
alter table public.community_resume_publications enable row level security;
revoke all on public.community_resume_publications from public,anon,authenticated;
grant select on public.community_resume_publications to authenticated;
grant all on public.community_resume_publications to service_role;
create policy resume_publications_owner_select on public.community_resume_publications for select to authenticated using (user_id=auth.uid());

create table public.community_resume_shares (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null check (coalesce(jsonb_typeof(snapshot) = 'object'
    and jsonb_typeof(snapshot->'sections') = 'array'
    and jsonb_array_length(snapshot->'sections') between 1 and 20
    and jsonb_typeof(snapshot->'title') = 'string'
    and octet_length(snapshot::text) <= 600000, false)),
  request_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.community_resume_shares enable row level security;
revoke all on public.community_resume_shares from public, anon, authenticated;
grant select, delete on public.community_resume_shares to authenticated;
grant all on public.community_resume_shares to service_role;
create policy resume_shares_owner_select on public.community_resume_shares for select to authenticated using (user_id = auth.uid());
-- The author can revoke even if they have since left the post's private group.
create policy resume_shares_owner_delete on public.community_resume_shares for delete to authenticated using (user_id = auth.uid());

create function public.create_community_resume_post(p_post_id uuid, p_post jsonb, p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_post public.community_posts;
  v_hash text := pg_catalog.md5(p_post::text || p_snapshot::text);
  v_group uuid := (p_post->>'group_id')::uuid;
begin
  if v_user is null or p_post_id is null or p_snapshot is null or p_post is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  -- Serialize per author for caps, and per request for retry/create collisions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 97));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_post_id::text, 98));
  select * into v_post from public.community_posts where id = p_post_id;
  if found then
    if v_post.user_id = v_user and exists (select 1 from public.community_resume_shares s where s.post_id = p_post_id and s.user_id = v_user and s.request_hash = v_hash) then
      return pg_catalog.to_jsonb(v_post);
    end if;
    -- In particular, an old request must not resurrect a revoked copy.
    raise exception 'This publication has changed or was removed. Preview a new copy.' using errcode = '23514';
  end if;
  if exists (select 1 from public.community_resume_publications where id=p_post_id) then
    raise exception 'This publication was removed. Preview a new copy.' using errcode = '23514';
  end if;
  if (select count(*) from public.community_resume_publications where user_id=v_user) >= 5000 then
    raise exception 'Resume publication limit reached' using errcode = '23514';
  end if;
  if not exists (select 1 from public.resumes r where r.id = (p_post->>'resume_link')::uuid and r.user_id = v_user) then
    raise exception 'Resume not found' using errcode = '42501';
  end if;
  if v_group is not null and not public.can_write_community_group(v_group) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if (select count(*) from public.community_posts where user_id = v_user) >= 5000
     or (select count(*) from public.community_posts where user_id = v_user and created_at >= now() - interval '24 hours') >= 100 then
    raise exception 'Post limit reached' using errcode = '23514';
  end if;
  insert into public.community_resume_publications(id,user_id) values(p_post_id,v_user);
  insert into public.community_posts(id,user_id,content,topic_tag,result_card,score_card,resume_link,is_anonymous,university_id,poll_options,group_id)
  values(p_post_id,v_user,coalesce(p_post->>'content',''),p_post->>'topic_tag',
    nullif(p_post->'result_card','null'::jsonb),nullif(p_post->'score_card','null'::jsonb),(p_post->>'resume_link')::uuid,
    coalesce((p_post->>'is_anonymous')::boolean,false),(p_post->>'university_id')::bigint,
    nullif(p_post->'poll_options','null'::jsonb),v_group) returning * into v_post;
  insert into public.community_resume_shares(post_id,user_id,snapshot,request_hash) values(p_post_id,v_user,p_snapshot,v_hash);
  return pg_catalog.to_jsonb(v_post);
end;
$$;

create function public.read_community_resume(p_post_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select s.snapshot from public.community_resume_shares s
  join public.community_posts p on p.id = s.post_id and p.user_id = s.user_id
  where p.id = p_post_id and auth.uid() is not null and not p.is_hidden
    and public.can_read_community_post(p.id)
    and not exists (select 1 from public.community_blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.user_id)
         or (b.blocker_id = p.user_id and b.blocked_id = auth.uid()));
$$;
revoke all on function public.create_community_resume_post(uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.read_community_resume(uuid) from public,anon,authenticated;
grant execute on function public.create_community_resume_post(uuid,jsonb,jsonb) to authenticated;
grant execute on function public.read_community_resume(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
