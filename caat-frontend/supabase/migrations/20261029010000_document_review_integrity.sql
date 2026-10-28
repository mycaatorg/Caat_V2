begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PROD-94: review outcomes belong to trusted service/database reviewers.
-- Authenticated owners can upload/replace files, but cannot manufacture a review.
create or replace function public.guard_document_review_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending_review';
    new.review_notes := null;
    return new;
  end if;
  if new.status is distinct from old.status and new.status is distinct from 'pending_review' then
    raise exception 'Document status is set by review' using errcode = '42501';
  end if;
  if new.review_notes is distinct from old.review_notes then
    raise exception 'Review notes are set by review' using errcode = '42501';
  end if;
  -- Direct API callers must not retain a review after swapping its subject.
  if row(new.file_name, new.storage_path, new.category, new.mime_type,
         new.file_size, new.school_id, new.uploaded_at)
     is distinct from
     row(old.file_name, old.storage_path, old.category, old.mime_type,
         old.file_size, old.school_id, old.uploaded_at) then
    new.status := 'pending_review';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_document_review_fields() from public, anon, authenticated;
create trigger trg_guard_document_review_fields
  before insert or update on public.documents
  for each row execute function public.guard_document_review_fields();

-- A referenced object is immutable to the owner. Otherwise an unchanged row
-- could keep its review badge while Storage update/delete+insert swaps bytes.
-- The app already uploads replacements at a new path and deletes rows before
-- deleting their objects. Restrictive policies AND with all existing policies;
-- other buckets, reads, and trusted service-role operations are unchanged.
create index if not exists documents_owner_storage_path_idx
  on public.documents (user_id, storage_path);

create policy documents_referenced_object_insert_guard on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'user-documents' or not exists (
    select 1 from public.documents d
    where d.user_id = (select auth.uid()) and d.storage_path = objects.name
  ));
create policy documents_referenced_object_update_guard on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'user-documents' or not exists (
    select 1 from public.documents d
    where d.user_id = (select auth.uid()) and d.storage_path = objects.name
  ))
  with check (bucket_id <> 'user-documents' or not exists (
    select 1 from public.documents d
    where d.user_id = (select auth.uid()) and d.storage_path = objects.name
  ));
create policy documents_referenced_object_delete_guard on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'user-documents' or not exists (
    select 1 from public.documents d
    where d.user_id = (select auth.uid()) and d.storage_path = objects.name
  ));

-- Signed upload capabilities can execute with trusted Storage privileges after
-- issuance, bypassing RLS. Invalidate the public review in the same metadata
-- transaction whenever an object version/path/content metadata changes. This
-- trigger does not write to Storage metadata or manipulate backend files.
create index if not exists documents_storage_path_review_idx
  on public.documents (storage_path);
create or replace function public.invalidate_document_review_on_storage_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if row(new.bucket_id, new.name, new.version, new.metadata)
       is not distinct from row(old.bucket_id, old.name, old.version, old.metadata) then
      return null;
    end if;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    if old.bucket_id = 'user-documents' then
      update public.documents set status = 'pending_review', updated_at = now()
      where storage_path = old.name and status is distinct from 'pending_review';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if new.bucket_id = 'user-documents' then
      update public.documents set status = 'pending_review', updated_at = now()
      where storage_path = new.name and status is distinct from 'pending_review';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.invalidate_document_review_on_storage_change() from public, anon, authenticated;
create trigger trg_invalidate_document_review_on_storage_change
  after insert or update or delete on storage.objects
  for each row execute function public.invalidate_document_review_on_storage_change();

commit;
