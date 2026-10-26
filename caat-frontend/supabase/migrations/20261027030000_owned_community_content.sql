-- PROD-87: redact caller-owned content without restoring private-group access.
begin;
alter table public.community_posts add column is_removed boolean not null default false;
alter table public.community_posts add constraint community_removed_post_redacted check (
 not is_removed or (content='[Removed by author]' and is_anonymous and topic_tag='ADVICE'
 and resume_link is null and result_card is null and score_card is null and poll_options is null
 and university_id is null and major_id is null)
);
create function public.community_keep_removed_content()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='community_posts' then
  if old.is_removed and (not new.is_removed or new.id is distinct from old.id or new.user_id is distinct from old.user_id) then
   raise exception 'Removed content cannot be restored' using errcode='23514';
  end if;
 else
  if old.is_deleted and (not new.is_deleted or new.content<>'[deleted]' or new.id is distinct from old.id or new.user_id is distinct from old.user_id) then
   raise exception 'Removed content cannot be restored' using errcode='23514';
  end if;
 end if;
 return new;
end;
$$;
create trigger community_keep_removed_post before update on public.community_posts for each row execute function public.community_keep_removed_content();
create trigger community_keep_removed_comment before update on public.community_comments for each row execute function public.community_keep_removed_content();
revoke all on function public.community_keep_removed_content() from public,anon,authenticated;

create function public.list_owned_community_content(p_page integer default 0)
returns table(kind text,id uuid,content text,created_at timestamptz,removed boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Not signed in' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>250 then raise exception 'Invalid page' using errcode='22023'; end if;
 return query
 select x.kind,x.id,x.content,x.created_at,x.removed from (
  select 'post'::text as kind,p.id,left(p.content,500) as content,p.created_at,p.is_removed as removed
   from public.community_posts p where p.user_id=auth.uid()
  union all
  select 'comment'::text,c.id,left(c.content,500),c.created_at,c.is_deleted
   from public.community_comments c where c.user_id=auth.uid()
 ) x order by x.created_at desc,x.id desc,x.kind limit 21 offset p_page*20;
end;
$$;
create function public.remove_owned_community_content(p_kind text,p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid;
begin
 if v_user is null then raise exception 'Not signed in' using errcode='42501'; end if;
 if p_id is null or p_kind is null or p_kind not in ('post','comment') then raise exception 'Invalid content' using errcode='22023'; end if;
 if p_kind='post' then
  select p.id into v_id from public.community_posts p where p.id=p_id and p.user_id=v_user for update;
  if not found then return false; end if;
  update public.community_posts set content='[Removed by author]',is_removed=true,is_anonymous=true,topic_tag='ADVICE',
   resume_link=null,result_card=null,score_card=null,poll_options=null,university_id=null,major_id=null where id=v_id;
  delete from public.community_resume_shares where post_id=v_id and user_id=v_user;
 else
  select c.id into v_id from public.community_comments c where c.id=p_id and c.user_id=v_user for update;
  if not found then return false; end if;
  update public.community_comments set content='[deleted]',is_deleted=true where id=v_id;
 end if;
 return true;
end;
$$;
revoke all on function public.list_owned_community_content(integer) from public,anon,authenticated;
revoke all on function public.remove_owned_community_content(text,uuid) from public,anon,authenticated;
grant execute on function public.list_owned_community_content(integer) to authenticated;
grant execute on function public.remove_owned_community_content(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
