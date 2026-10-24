-- PROD-77: the RLS EXISTS check alone cannot serialize an attachment against
-- concurrent deletion/movement of its application. Enforce the relationship
-- in PostgreSQL as well. Keep the detach trigger, which preserves bookmarks
-- and ticks while clearing school_id on application deletion or movement.
BEGIN;
SET LOCAL lock_timeout = '5s';

UPDATE public.user_bookmarked_scholarships b
SET school_id = NULL
WHERE school_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM public.user_school_applications a
  WHERE a.user_id = b.user_id AND a.school_id = b.school_id
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_bookmarked_scholarships'::regclass
      AND conname = 'scholarship_bookmark_owned_application_fkey'
  ) THEN
    ALTER TABLE public.user_bookmarked_scholarships
      ADD CONSTRAINT scholarship_bookmark_owned_application_fkey
      FOREIGN KEY (user_id, school_id)
      REFERENCES public.user_school_applications (user_id, school_id)
      ON DELETE NO ACTION ON UPDATE NO ACTION
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Deferred checking lets the existing AFTER trigger detach first, but a
-- concurrent attach cannot commit after the parent row is removed/moved.
-- With MATCH SIMPLE, an unattached bookmark (school_id NULL) remains valid.
COMMIT;
