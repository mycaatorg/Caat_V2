-- PROD-150: a student could save a scholarship but not change its status.
-- user_bookmarked_scholarships had owner SELECT, INSERT and DELETE policies and
-- no UPDATE policy, so every status change (Interested -> Applied, ...) was
-- denied by row security. This adds the missing owner-only UPDATE policy and
-- drops table privileges no client needs. Additive and safe to re-run.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_bookmarked_scholarships'
      AND policyname = 'users can update own scholarship bookmarks'
  ) THEN
    CREATE POLICY "users can update own scholarship bookmarks"
      ON public.user_bookmarked_scholarships
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END
$$;

-- Signed-in students read, save, re-status and remove their own rows; nothing
-- else. Anonymous visitors have no policy on this table, so they keep no
-- privileges at all. REVOKE of a privilege that is not held is a no-op.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.user_bookmarked_scholarships FROM authenticated;
REVOKE ALL ON public.user_bookmarked_scholarships FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_bookmarked_scholarships TO authenticated;

-- PostgreSQL 17 adds MAINTAIN (VACUUM, ANALYZE, LOCK, REINDEX); older servers
-- reject the keyword, so revoke it only where it exists.
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 170000 THEN
    EXECUTE 'REVOKE MAINTAIN ON public.user_bookmarked_scholarships FROM authenticated';
  END IF;
END
$$;

COMMIT;
