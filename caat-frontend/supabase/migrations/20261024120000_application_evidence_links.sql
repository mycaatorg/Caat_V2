-- PROD-78 (first slice, documents only): link a document from the student's
-- library to one of their university applications, optionally tailored for that
-- application. Design: docs/superpowers/specs/2026-10-23-evidence-library-design.md
--
-- 1. UNIQUE (id, user_id) on user_school_applications and documents, so links
--    can use composite foreign keys. id is already the primary key, so these
--    cannot fail on existing rows.
-- 2. application_evidence_links: one row per (application, document). Composite
--    foreign keys make the link, its application and its document share one
--    owner, whatever the caller. Deleting the application removes its links;
--    deleting a document that is still linked is refused (RESTRICT). Unlinking
--    deletes the link row only; nothing cascades from a link to a source.
-- 3. Owner-only row security for all four verbs. Clients may INSERT only the
--    link columns (so a link never arrives tailored) and UPDATE only the
--    tailored_* columns, enforced with column-level grants (no trigger): a link
--    cannot be re-pointed to another application, document or student.
-- evidence_item_id is reserved for the evidence_items table of a later slice:
-- it has no foreign key yet, clients cannot write it, and kind must be
-- 'document' until that slice relaxes the CHECK.
-- No change to existing policies. Additive and safe to re-run.
BEGIN;
-- Fail fast instead of queueing behind a long transaction while the two
-- UNIQUE constraints below take their ACCESS EXCLUSIVE locks.
SET LOCAL lock_timeout = '5s';

-- 1. Composite keys for same-owner foreign keys ---------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_school_applications'::regclass
      AND contype IN ('u', 'p')
      AND pg_get_constraintdef(oid) = 'UNIQUE (id, user_id)'
  ) THEN
    ALTER TABLE public.user_school_applications
      ADD CONSTRAINT user_school_applications_id_user_id_key UNIQUE (id, user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.documents'::regclass
      AND contype IN ('u', 'p')
      AND pg_get_constraintdef(oid) = 'UNIQUE (id, user_id)'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_id_user_id_key UNIQUE (id, user_id);
  END IF;
END
$$;

-- 2. Links ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  application_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'document',
  document_id uuid,
  evidence_item_id uuid,
  tailored_title text,
  tailored_body text,
  tailored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_evidence_links_kind_check CHECK (kind = 'document'),
  CONSTRAINT application_evidence_links_one_source CHECK (num_nonnulls(document_id, evidence_item_id) = 1),
  CONSTRAINT application_evidence_links_kind_source CHECK ((kind = 'document') = (document_id IS NOT NULL)),
  CONSTRAINT application_evidence_links_title_check
    CHECK (tailored_title IS NULL OR char_length(btrim(tailored_title)) BETWEEN 1 AND 200),
  CONSTRAINT application_evidence_links_body_check
    CHECK (tailored_body IS NULL OR char_length(tailored_body) BETWEEN 1 AND 10000),
  -- tailored_at is set exactly when the link carries tailored text.
  CONSTRAINT application_evidence_links_tailored_check
    CHECK ((tailored_at IS NULL) = (tailored_title IS NULL AND tailored_body IS NULL)),
  CONSTRAINT application_evidence_links_application_fkey
    FOREIGN KEY (application_id, user_id)
    REFERENCES public.user_school_applications (id, user_id) ON DELETE CASCADE,
  CONSTRAINT application_evidence_links_document_fkey
    FOREIGN KEY (document_id, user_id)
    REFERENCES public.documents (id, user_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS application_evidence_links_application_document_key
  ON public.application_evidence_links (application_id, document_id)
  WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS application_evidence_links_user_document_idx
  ON public.application_evidence_links (user_id, document_id);
CREATE INDEX IF NOT EXISTS application_evidence_links_application_idx
  ON public.application_evidence_links (application_id);

ALTER TABLE public.application_evidence_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'application_evidence_links' AND policyname = 'users can read own evidence links') THEN
    CREATE POLICY "users can read own evidence links" ON public.application_evidence_links
      AS PERMISSIVE FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'application_evidence_links' AND policyname = 'users can insert own evidence links') THEN
    CREATE POLICY "users can insert own evidence links" ON public.application_evidence_links
      AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'application_evidence_links' AND policyname = 'users can update own evidence links') THEN
    CREATE POLICY "users can update own evidence links" ON public.application_evidence_links
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'application_evidence_links' AND policyname = 'users can delete own evidence links') THEN
    CREATE POLICY "users can delete own evidence links" ON public.application_evidence_links
      AS PERMISSIVE FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
  END IF;
END
$$;

-- 3. Grants: anonymous visitors get nothing. Supabase's default privileges
-- grant everything on new tables, so revoke first and grant back only what the
-- app uses. Column-level INSERT and UPDATE are the re-pointing guard.
REVOKE ALL ON public.application_evidence_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.application_evidence_links TO authenticated;
GRANT INSERT (user_id, application_id, kind, document_id) ON public.application_evidence_links TO authenticated;
GRANT UPDATE (tailored_title, tailored_body, tailored_at) ON public.application_evidence_links TO authenticated;
GRANT ALL ON public.application_evidence_links TO service_role;

COMMIT;
