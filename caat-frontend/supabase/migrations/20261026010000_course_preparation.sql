-- PROD-175: manual review of recorded course facts, never an eligibility decision.
BEGIN;
CREATE TABLE public.course_preparation_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 application_id uuid NOT NULL,
 school_id bigint NOT NULL,
 course_id text NOT NULL REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
 item_key text NOT NULL CHECK (item_key IN ('prerequisites','assumed_knowledge','application_route')),
 snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object'),
 reviewed boolean NOT NULL DEFAULT false,
 revision uuid NOT NULL DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT course_prep_application_fkey FOREIGN KEY(application_id,user_id,school_id)
  REFERENCES public.user_school_applications(id,user_id,school_id) ON DELETE CASCADE,
 UNIQUE(application_id,course_id,item_key),
 UNIQUE(id,user_id,application_id)
);
CREATE INDEX course_prep_owner_idx ON public.course_preparation_checks(user_id,application_id);
CREATE INDEX course_prep_course_idx ON public.course_preparation_checks(course_id);
ALTER TABLE public.course_preparation_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_preparation_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.course_preparation_checks TO authenticated;
GRANT ALL ON public.course_preparation_checks TO service_role;
CREATE POLICY course_prep_select ON public.course_preparation_checks FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE TABLE public.course_preparation_work (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 application_id uuid NOT NULL,
 check_id uuid NOT NULL,
 evidence_link_id uuid,
 essay_draft_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(evidence_link_id,essay_draft_id)=1),
 FOREIGN KEY(check_id,user_id,application_id) REFERENCES public.course_preparation_checks(id,user_id,application_id) ON DELETE CASCADE,
 FOREIGN KEY(evidence_link_id,user_id,application_id) REFERENCES public.application_evidence_links(id,user_id,application_id) ON DELETE CASCADE,
 FOREIGN KEY(essay_draft_id,user_id) REFERENCES public.essay_drafts(id,user_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX course_prep_work_evidence_key ON public.course_preparation_work(check_id,evidence_link_id) WHERE evidence_link_id IS NOT NULL;
CREATE UNIQUE INDEX course_prep_work_draft_key ON public.course_preparation_work(check_id,essay_draft_id) WHERE essay_draft_id IS NOT NULL;
CREATE INDEX course_prep_work_owner_idx ON public.course_preparation_work(user_id,application_id);
CREATE INDEX course_prep_work_evidence_idx ON public.course_preparation_work(evidence_link_id);
CREATE INDEX course_prep_work_draft_idx ON public.course_preparation_work(essay_draft_id);
ALTER TABLE public.course_preparation_work ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_preparation_work FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.course_preparation_work TO authenticated;
GRANT INSERT(user_id,application_id,check_id,evidence_link_id,essay_draft_id) ON public.course_preparation_work TO authenticated;
GRANT ALL ON public.course_preparation_work TO service_role;
CREATE POLICY course_prep_work_select ON public.course_preparation_work FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY course_prep_work_insert ON public.course_preparation_work FOR INSERT TO authenticated WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY course_prep_work_delete ON public.course_preparation_work FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

CREATE FUNCTION public.save_course_preparation(p_application_id uuid,p_course_id text,p_item_key text,p_action text,p_expected_revision uuid,p_expected_snapshot jsonb)
RETURNS SETOF public.course_preparation_checks
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 caller uuid := auth.uid();
 course public.course_offerings%ROWTYPE;
 saved public.course_preparation_checks%ROWTYPE;
 app_school bigint;
 current_snapshot jsonb;
BEGIN
 IF caller IS NULL OR p_item_key IS NULL OR p_item_key NOT IN ('prerequisites','assumed_knowledge','application_route') OR p_action IS NULL OR p_action NOT IN ('start','reviewed','reopen','acknowledge') THEN
  RAISE EXCEPTION 'Invalid preparation action' USING ERRCODE='22023';
 END IF;
 SELECT school_id INTO app_school FROM public.user_school_applications WHERE id=p_application_id AND user_id=caller FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application unavailable' USING ERRCODE='42501'; END IF;
 -- SHARE conflicts with catalogue updates, including non-key field changes.
 SELECT * INTO course FROM public.course_offerings WHERE id=p_course_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Course unavailable' USING ERRCODE='22023'; END IF;
 current_snapshot := jsonb_build_object('name',course.name,'program_code',course.program_code,'campus',course.campus,'school_id',course.school_id,'active',course.active,
 'text',CASE p_item_key WHEN 'prerequisites' THEN course.prerequisites WHEN 'assumed_knowledge' THEN course.assumed_knowledge ELSE course.application_route END,
 'url',CASE p_item_key WHEN 'prerequisites' THEN course.prerequisites_url WHEN 'application_route' THEN course.application_url ELSE NULL END,
 'source_url',course.source_url,'source_year',course.source_year,'verified_at',course.verified_at);
 IF p_expected_snapshot IS DISTINCT FROM current_snapshot THEN RAISE EXCEPTION 'Course information changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 IF p_action <> 'reopen' AND (NOT course.active OR course.school_id IS DISTINCT FROM app_school) THEN
  RAISE EXCEPTION 'Course is no longer available for this application' USING ERRCODE='22023';
 END IF;
 SELECT * INTO saved FROM public.course_preparation_checks WHERE application_id=p_application_id AND course_id=p_course_id AND item_key=p_item_key AND user_id=caller FOR UPDATE;
 IF p_action='start' THEN
  IF FOUND OR p_expected_revision IS NOT NULL THEN RAISE EXCEPTION 'Preparation already started. Refresh.' USING ERRCODE='40001'; END IF;
  PERFORM 1 FROM public.user_course_bookmarks WHERE user_id=caller AND course_id=p_course_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Save this course before starting preparation' USING ERRCODE='22023'; END IF;
  RETURN QUERY INSERT INTO public.course_preparation_checks(user_id,application_id,school_id,course_id,item_key,snapshot)
   VALUES(caller,p_application_id,app_school,p_course_id,p_item_key,current_snapshot) RETURNING *;
 ELSE
  IF NOT FOUND OR saved.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Preparation changed elsewhere. Refresh.' USING ERRCODE='40001'; END IF;
  IF p_action='reviewed' AND saved.snapshot IS DISTINCT FROM current_snapshot THEN RAISE EXCEPTION 'Review the changed information first' USING ERRCODE='40001'; END IF;
  RETURN QUERY UPDATE public.course_preparation_checks SET
   snapshot=CASE WHEN p_action='acknowledge' THEN current_snapshot ELSE saved.snapshot END,
   reviewed=(p_action='reviewed'),revision=gen_random_uuid(),updated_at=clock_timestamp()
   WHERE id=saved.id RETURNING *;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_course_preparation(uuid,text,text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_course_preparation(uuid,text,text,text,uuid,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
