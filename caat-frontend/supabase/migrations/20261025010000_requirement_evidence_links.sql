-- PROD-161: immutable, owner-scoped supporting work for attached requirements.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_school_applications'::regclass AND conname='application_id_owner_school_key') THEN
  ALTER TABLE public.user_school_applications ADD CONSTRAINT application_id_owner_school_key UNIQUE(id,user_id,school_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.user_bookmarked_scholarships'::regclass AND conname='bookmark_owner_scholarship_school_key') THEN
  ALTER TABLE public.user_bookmarked_scholarships ADD CONSTRAINT bookmark_owner_scholarship_school_key UNIQUE(user_id,scholarship_id,school_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.application_evidence_links'::regclass AND conname='evidence_id_owner_application_key') THEN
  ALTER TABLE public.application_evidence_links ADD CONSTRAINT evidence_id_owner_application_key UNIQUE(id,user_id,application_id);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.essay_drafts'::regclass AND conname='essay_draft_id_owner_key') THEN
  ALTER TABLE public.essay_drafts ADD CONSTRAINT essay_draft_id_owner_key UNIQUE(id,user_id);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.requirement_evidence_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 application_id uuid NOT NULL,
 school_id bigint NOT NULL,
 scholarship_id uuid NOT NULL,
 item_key text NOT NULL CHECK(item_key ~ '^(separate-application|essay|deadline|official-link|rule:[a-z0-9]{8,64})$'),
 requirement_label text NOT NULL CHECK(length(btrim(requirement_label)) BETWEEN 1 AND 10000),
 evidence_link_id uuid,
 essay_draft_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(evidence_link_id,essay_draft_id)=1),
 CONSTRAINT requirement_application_fkey FOREIGN KEY(application_id,user_id,school_id)
  REFERENCES public.user_school_applications(id,user_id,school_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT requirement_attachment_fkey FOREIGN KEY(user_id,scholarship_id,school_id)
  REFERENCES public.user_bookmarked_scholarships(user_id,scholarship_id,school_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT requirement_evidence_fkey FOREIGN KEY(evidence_link_id,user_id,application_id)
  REFERENCES public.application_evidence_links(id,user_id,application_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT requirement_draft_fkey FOREIGN KEY(essay_draft_id,user_id)
  REFERENCES public.essay_drafts(id,user_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX IF NOT EXISTS requirement_evidence_source_key ON public.requirement_evidence_links(application_id,scholarship_id,item_key,evidence_link_id) WHERE evidence_link_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS requirement_draft_source_key ON public.requirement_evidence_links(application_id,scholarship_id,item_key,essay_draft_id) WHERE essay_draft_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS requirement_owner_application_idx ON public.requirement_evidence_links(user_id,application_id);
CREATE INDEX IF NOT EXISTS requirement_attachment_idx ON public.requirement_evidence_links(user_id,scholarship_id,school_id);
CREATE INDEX IF NOT EXISTS requirement_evidence_idx ON public.requirement_evidence_links(evidence_link_id);
CREATE INDEX IF NOT EXISTS requirement_draft_idx ON public.requirement_evidence_links(essay_draft_id);

-- Clear associations before attachment movement, including the existing
-- application-delete/move trigger. Sources and preparation ticks survive.
-- The deferred composite FK also serializes concurrent insert vs movement.
CREATE OR REPLACE FUNCTION public.clear_moved_requirement_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.school_id IS DISTINCT FROM OLD.school_id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.scholarship_id IS DISTINCT FROM OLD.scholarship_id THEN
  DELETE FROM public.requirement_evidence_links WHERE user_id=OLD.user_id AND scholarship_id=OLD.scholarship_id AND school_id=OLD.school_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.clear_moved_requirement_evidence() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS clear_moved_requirement_evidence ON public.user_bookmarked_scholarships;
CREATE TRIGGER clear_moved_requirement_evidence BEFORE UPDATE OF school_id,user_id,scholarship_id ON public.user_bookmarked_scholarships FOR EACH ROW EXECUTE FUNCTION public.clear_moved_requirement_evidence();
ALTER TABLE public.requirement_evidence_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS requirement_owner_read ON public.requirement_evidence_links;
CREATE POLICY requirement_owner_read ON public.requirement_evidence_links FOR SELECT TO authenticated USING((select auth.uid())=user_id);
DROP POLICY IF EXISTS requirement_owner_insert ON public.requirement_evidence_links;
CREATE POLICY requirement_owner_insert ON public.requirement_evidence_links FOR INSERT TO authenticated WITH CHECK((select auth.uid())=user_id);
DROP POLICY IF EXISTS requirement_owner_delete ON public.requirement_evidence_links;
CREATE POLICY requirement_owner_delete ON public.requirement_evidence_links FOR DELETE TO authenticated USING((select auth.uid())=user_id);
REVOKE ALL ON public.requirement_evidence_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.requirement_evidence_links TO authenticated;
GRANT INSERT(user_id,application_id,school_id,scholarship_id,item_key,requirement_label,evidence_link_id,essay_draft_id) ON public.requirement_evidence_links TO authenticated;
GRANT ALL ON public.requirement_evidence_links TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
