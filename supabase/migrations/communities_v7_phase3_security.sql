-- Phase 3 security remediation — corresponds to SECURITY_REMEDIATION_PLAN.md
-- items J3 (hidden post visibility) and E5 (storage bucket policies in code).

-- ─────────────────────────────────────────
-- J3 — Allow post authors to see their own hidden posts.
--      Previously, once a post was auto-hidden by the report trigger, the
--      author could no longer SELECT it (the policy was `is_hidden = FALSE`
--      with no exception for ownership) — so they had no way to know what
--      had been removed and no way to delete it from the UI.
-- ─────────────────────────────────────────

DROP POLICY IF EXISTS "posts_select" ON public.community_posts;

CREATE POLICY "posts_select" ON public.community_posts
  FOR SELECT TO authenticated
  USING (
    is_hidden = FALSE
    OR auth.uid() = user_id
  );

-- ─────────────────────────────────────────
-- E5 — Codify expected storage-bucket RLS policies. These mirror the
--      Supabase dashboard config and must stay in sync.
--
--      `user-documents`  — private; user can only access objects under
--                          their own UID prefix.
--      `profile-avatars` — public read; user can only write under their
--                          own UID prefix.
--
--      Storage RLS lives on `storage.objects`. The `name` column holds the
--      full object path; the convention `<user_id>/...` is enforced here.
-- ─────────────────────────────────────────

-- user-documents — read
DROP POLICY IF EXISTS "user_documents_select_own" ON storage.objects;
CREATE POLICY "user_documents_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- user-documents — insert
DROP POLICY IF EXISTS "user_documents_insert_own" ON storage.objects;
CREATE POLICY "user_documents_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- user-documents — update
DROP POLICY IF EXISTS "user_documents_update_own" ON storage.objects;
CREATE POLICY "user_documents_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- user-documents — delete
DROP POLICY IF EXISTS "user_documents_delete_own" ON storage.objects;
CREATE POLICY "user_documents_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- profile-avatars — public read
DROP POLICY IF EXISTS "profile_avatars_public_read" ON storage.objects;
CREATE POLICY "profile_avatars_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profile-avatars');

-- profile-avatars — upload only your own
DROP POLICY IF EXISTS "profile_avatars_insert_own" ON storage.objects;
CREATE POLICY "profile_avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- profile-avatars — replace only your own
DROP POLICY IF EXISTS "profile_avatars_update_own" ON storage.objects;
CREATE POLICY "profile_avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- profile-avatars — delete only your own
DROP POLICY IF EXISTS "profile_avatars_delete_own" ON storage.objects;
CREATE POLICY "profile_avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
