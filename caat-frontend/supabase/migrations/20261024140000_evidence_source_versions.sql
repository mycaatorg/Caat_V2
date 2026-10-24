-- PROD-78: acknowledge the exact file version the student saw, independently
-- of device clock skew. The server assigns concurrency tokens for tailoring.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.application_evidence_links
  ADD COLUMN IF NOT EXISTS source_uploaded_at timestamptz;
GRANT UPDATE (source_uploaded_at) ON public.application_evidence_links TO authenticated;

CREATE OR REPLACE FUNCTION public.stamp_evidence_tailoring()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.tailored_title IS NULL AND NEW.tailored_body IS NULL THEN
    NEW.tailored_at := NULL;
    NEW.source_uploaded_at := NULL;
  ELSE
    NEW.tailored_at := clock_timestamp();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stamp_evidence_tailoring() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_stamp_evidence_tailoring ON public.application_evidence_links;
CREATE TRIGGER trg_stamp_evidence_tailoring
BEFORE UPDATE ON public.application_evidence_links
FOR EACH ROW EXECUTE FUNCTION public.stamp_evidence_tailoring();
COMMIT;
