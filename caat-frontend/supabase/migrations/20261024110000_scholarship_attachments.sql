-- PROD-77 (minimal): attach a saved scholarship to one of the student's
-- applications, and keep preparation ticks for its requirements checklist.
--
-- 1. The owner-only INSERT and UPDATE policies on user_bookmarked_scholarships
--    (UPDATE from PROD-150) also require that school_id is null or a university
--    the student has their own user_school_applications row for. The check is a
--    plain EXISTS under the caller's own row security, so it can only see the
--    caller's applications.
-- 2. Deleting an application, or moving it to another university, sets
--    school_id to null on that student's saved scholarships for the old
--    university. The bookmark itself is never deleted.
-- 3. user_scholarship_prep_checks stores checklist keys only (no text), owner
--    only, and goes away with the saved scholarship it belongs to.
-- No change to public.scholarships. Additive and safe to re-run.
BEGIN;

-- 0. Detach anything the new checks would reject -------------------------
-- A saved scholarship may only point at a university the student has an
-- application for. Clear any that do not, so later status changes are not
-- refused by the WITH CHECK below. Production had 0 such rows (0 bookmarks
-- with school_id set at all) on 23 October 2026, so this is a no-op there.
UPDATE public.user_bookmarked_scholarships b
   SET school_id = NULL
 WHERE b.school_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.user_school_applications a
     WHERE a.user_id = b.user_id AND a.school_id = b.school_id
   );

-- 1. Attach only to your own application's university --------------------
DROP POLICY IF EXISTS "users can update own scholarship bookmarks" ON public.user_bookmarked_scholarships;
CREATE POLICY "users can update own scholarship bookmarks"
  ON public.user_bookmarked_scholarships
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (
      school_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_school_applications a
        WHERE a.user_id = (select auth.uid())
          AND a.school_id = user_bookmarked_scholarships.school_id
      )
    )
  );

DROP POLICY IF EXISTS "users can insert own scholarship bookmarks" ON public.user_bookmarked_scholarships;
CREATE POLICY "users can insert own scholarship bookmarks"
  ON public.user_bookmarked_scholarships
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND (
      school_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.user_school_applications a
        WHERE a.user_id = (select auth.uid())
          AND a.school_id = user_bookmarked_scholarships.school_id
      )
    )
  );

-- 2. Detach when the application goes away ------------------------------
-- SECURITY DEFINER so the detach also runs when the delete is not made by the
-- student (account deletion cascading from auth.users, a school removed by an
-- admin). It touches only the deleted application's owner and university.
CREATE OR REPLACE FUNCTION public.detach_scholarships_from_application()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.school_id IS NOT DISTINCT FROM OLD.school_id AND NEW.user_id = OLD.user_id THEN
    RETURN NULL;
  END IF;
  UPDATE public.user_bookmarked_scholarships
     SET school_id = NULL
   WHERE user_id = OLD.user_id
     AND school_id = OLD.school_id;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.detach_scholarships_from_application() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_detach_scholarships_from_application ON public.user_school_applications;
CREATE TRIGGER trg_detach_scholarships_from_application
  AFTER DELETE OR UPDATE OF school_id, user_id ON public.user_school_applications
  FOR EACH ROW EXECUTE FUNCTION public.detach_scholarships_from_application();

-- 3. Preparation ticks (keys only) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_scholarship_prep_checks (
  user_id uuid NOT NULL,
  scholarship_id uuid NOT NULL,
  item_key text NOT NULL
    CHECK (item_key ~ '^(separate-application|essay|deadline|official-link|rule:[a-z0-9]{8,64})$'),
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scholarship_id, item_key),
  FOREIGN KEY (user_id, scholarship_id)
    REFERENCES public.user_bookmarked_scholarships (user_id, scholarship_id) ON DELETE CASCADE
);

ALTER TABLE public.user_scholarship_prep_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scholarship_prep_checks' AND policyname = 'users can read own scholarship prep checks') THEN
    CREATE POLICY "users can read own scholarship prep checks" ON public.user_scholarship_prep_checks
      AS PERMISSIVE FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scholarship_prep_checks' AND policyname = 'users can insert own scholarship prep checks') THEN
    CREATE POLICY "users can insert own scholarship prep checks" ON public.user_scholarship_prep_checks
      AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scholarship_prep_checks' AND policyname = 'users can update own scholarship prep checks') THEN
    CREATE POLICY "users can update own scholarship prep checks" ON public.user_scholarship_prep_checks
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scholarship_prep_checks' AND policyname = 'users can delete own scholarship prep checks') THEN
    CREATE POLICY "users can delete own scholarship prep checks" ON public.user_scholarship_prep_checks
      AS PERMISSIVE FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
  END IF;
END
$$;

-- Signed-in students read and write their own ticks; anonymous visitors get
-- nothing. Supabase's default privileges grant everything on new tables, so
-- revoke first and grant back only what the app uses.
REVOKE ALL ON public.user_scholarship_prep_checks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_scholarship_prep_checks TO authenticated;
GRANT ALL ON public.user_scholarship_prep_checks TO service_role;

-- Guard: permissive policies are OR-ed, so an older INSERT or UPDATE policy
-- under another name would let the unchecked school_id write through. Refuse
-- to commit unless exactly one of each applies to signed-in students.
DO $$
DECLARE
  n_insert int;
  n_update int;
BEGIN
  SELECT count(*) FILTER (WHERE cmd IN ('INSERT', 'ALL')),
         count(*) FILTER (WHERE cmd IN ('UPDATE', 'ALL'))
    INTO n_insert, n_update
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'user_bookmarked_scholarships'
     AND permissive = 'PERMISSIVE'
     AND roles && ARRAY['authenticated', 'public']::name[];
  IF n_insert <> 1 OR n_update <> 1 THEN
    RAISE EXCEPTION 'user_bookmarked_scholarships must have exactly one permissive INSERT and one UPDATE policy for authenticated (found % INSERT, % UPDATE)', n_insert, n_update;
  END IF;
END
$$;

COMMIT;
