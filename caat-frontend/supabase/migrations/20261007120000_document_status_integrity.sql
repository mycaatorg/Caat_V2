-- PROD-94: students cannot set their own document verification status.
-- The owner-only RLS policies let a signed-in student update any column of
-- their own documents, including status and review_notes. Review fields now
-- belong to reviewers (service role or direct database sessions). Students
-- may still replace a file, which resets the document to pending review.
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.guard_document_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- New uploads always start unreviewed, whatever the client sent.
    NEW.status := 'pending_review';
    NEW.review_notes := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Document status is set by review'
      USING ERRCODE = '42501', HINT = 'Replace the file to send it for review again.';
  END IF;
  IF NEW.review_notes IS DISTINCT FROM OLD.review_notes THEN
    RAISE EXCEPTION 'Review notes are set by review' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_document_review_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_document_review_fields ON public.documents;
CREATE TRIGGER trg_guard_document_review_fields
  BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_document_review_fields();
