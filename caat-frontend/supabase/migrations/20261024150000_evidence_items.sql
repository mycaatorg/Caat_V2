-- PROD-153: stable reusable activities, awards and experience. Additive to
-- document links; explicit imports never write back to profiles or resumes.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('activity','award','experience')),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  organisation text CHECK (char_length(organisation) <= 200),
  role text CHECK (char_length(role) <= 200),
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000),
  origin_key text CHECK (char_length(origin_key) <= 500),
  revision uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_items_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT evidence_items_current CHECK (NOT is_current OR end_date IS NULL),
  UNIQUE(id,user_id),
  UNIQUE(user_id,origin_key)
);
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.evidence_items TO authenticated;
GRANT INSERT (user_id,kind,title,organisation,role,start_date,end_date,is_current,description,origin_key) ON public.evidence_items TO authenticated;
GRANT UPDATE (kind,title,organisation,role,start_date,end_date,is_current,description) ON public.evidence_items TO authenticated;
GRANT ALL ON public.evidence_items TO service_role;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='evidence_items' AND policyname='owner evidence items') THEN
    CREATE POLICY "owner evidence items" ON public.evidence_items FOR ALL TO authenticated
      USING ((select auth.uid())=user_id) WITH CHECK ((select auth.uid())=user_id);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.stamp_evidence_item_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF ROW(NEW.kind,NEW.title,NEW.organisation,NEW.role,NEW.start_date,NEW.end_date,NEW.is_current,NEW.description)
     IS DISTINCT FROM ROW(OLD.kind,OLD.title,OLD.organisation,OLD.role,OLD.start_date,OLD.end_date,OLD.is_current,OLD.description) THEN
    NEW.revision := gen_random_uuid();
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stamp_evidence_item_revision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_evidence_item_revision ON public.evidence_items;
CREATE TRIGGER trg_evidence_item_revision BEFORE UPDATE ON public.evidence_items
FOR EACH ROW EXECUTE FUNCTION public.stamp_evidence_item_revision();

ALTER TABLE public.application_evidence_links
  ADD COLUMN IF NOT EXISTS source_revision uuid,
  ADD COLUMN IF NOT EXISTS revision uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.application_evidence_links DROP CONSTRAINT IF EXISTS application_evidence_links_kind_check;
ALTER TABLE public.application_evidence_links ADD CONSTRAINT application_evidence_links_kind_check CHECK (kind IN ('document','item'));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.application_evidence_links'::regclass AND conname='application_evidence_links_item_fkey') THEN
    ALTER TABLE public.application_evidence_links ADD CONSTRAINT application_evidence_links_item_fkey
      FOREIGN KEY (evidence_item_id,user_id) REFERENCES public.evidence_items(id,user_id)
      ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS application_evidence_links_application_item_key
  ON public.application_evidence_links(application_id,evidence_item_id) WHERE evidence_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS application_evidence_links_user_item_idx
  ON public.application_evidence_links(user_id,evidence_item_id);
GRANT INSERT(evidence_item_id) ON public.application_evidence_links TO authenticated;
GRANT UPDATE(source_revision) ON public.application_evidence_links TO authenticated;
-- Preserve document semantics and add a UUID concurrency guard for item links.
CREATE OR REPLACE FUNCTION public.stamp_evidence_tailoring()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.revision := gen_random_uuid();
  IF NEW.tailored_title IS NULL AND NEW.tailored_body IS NULL THEN
    NEW.tailored_at := NULL;
    NEW.source_uploaded_at := NULL;
    NEW.source_revision := NULL;
  ELSE
    NEW.tailored_at := clock_timestamp();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stamp_evidence_tailoring() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
