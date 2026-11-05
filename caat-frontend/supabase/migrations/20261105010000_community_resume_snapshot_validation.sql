-- PROD-186: validate new published copies without rewriting historical shares.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION public.community_validate_resume_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_snapshot jsonb := NEW.snapshot;
 v_section jsonb;
 v_title text;
 v_label text;
 v_html text;
 v_serialized text;
 v_separator text := '';
BEGIN
 -- Existing historical copies can still be revoked; unchanged updates do not
 -- retrospectively validate copies made before this boundary existed.
 IF TG_OP = 'UPDATE' AND NEW.snapshot IS NOT DISTINCT FROM OLD.snapshot THEN
  RETURN NEW;
 END IF;
 IF pg_catalog.jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
    OR v_snapshot - ARRAY['title','sections']::text[] <> '{}'::jsonb THEN
  RAISE EXCEPTION 'Invalid shared resume' USING ERRCODE = '23514';
 END IF;
 v_title := public.community_post_field_text(v_snapshot->'title',1,200,true);
 IF pg_catalog.jsonb_typeof(v_snapshot->'sections') IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION 'Invalid shared resume sections' USING ERRCODE = '23514';
 END IF;
 IF pg_catalog.jsonb_array_length(v_snapshot->'sections') NOT BETWEEN 1 AND 20 THEN
  RAISE EXCEPTION 'Invalid shared resume sections' USING ERRCODE = '23514';
 END IF;
 -- Count the same compact DTO that JSON.stringify sees after title trimming.
 -- jsonb::text alone includes structural spaces and counts Unicode code points,
 -- which differs from the application's serialized UTF-16 length limit.
 v_serialized := '{"title":' || pg_catalog.to_jsonb(v_title)::text || ',"sections":[';
 FOR v_section IN SELECT value FROM pg_catalog.jsonb_array_elements(v_snapshot->'sections') LOOP
  IF pg_catalog.jsonb_typeof(v_section) IS DISTINCT FROM 'object'
     OR v_section - ARRAY['label','html']::text[] <> '{}'::jsonb THEN
   RAISE EXCEPTION 'Invalid shared resume section' USING ERRCODE = '23514';
  END IF;
  v_label := public.community_post_field_text(v_section->'label',0,100,false);
  v_html := public.community_post_field_text(v_section->'html',0,20000,false);
  v_serialized := v_serialized || v_separator || '{"label":' || pg_catalog.to_jsonb(v_label)::text
    || ',"html":' || pg_catalog.to_jsonb(v_html)::text || '}';
  v_separator := ',';
 END LOOP;
 v_serialized := v_serialized || ']}';
 PERFORM public.community_post_field_text(pg_catalog.to_jsonb(v_serialized),0,100000,false);
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.community_validate_resume_snapshot() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER community_resume_snapshot_validation
 BEFORE INSERT OR UPDATE OF snapshot ON public.community_resume_shares
 FOR EACH ROW EXECUTE FUNCTION public.community_validate_resume_snapshot();
NOTIFY pgrst, 'reload schema';
COMMIT;
