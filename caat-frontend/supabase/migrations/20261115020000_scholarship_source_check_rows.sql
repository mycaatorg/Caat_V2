-- PROD-278: private, atomic evidence of which rows a provider check covered.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE public.scholarship_source_check_rows (
  check_id bigint NOT NULL REFERENCES public.scholarship_source_checks(id) ON DELETE RESTRICT,
  scholarship_id uuid NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  PRIMARY KEY (check_id, scholarship_id)
);
CREATE INDEX scholarship_source_check_rows_scholarship ON public.scholarship_source_check_rows(scholarship_id,check_id DESC);
ALTER TABLE public.scholarship_source_check_rows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scholarship_source_check_rows FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.scholarship_source_check_rows TO service_role;

CREATE FUNCTION public.record_scholarship_source_check(p_check jsonb,p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  item jsonb;
  current_url text;
  current_active boolean;
  recorded public.scholarship_source_checks%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_check) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Source check and covered rows must be objects and an array' USING ERRCODE='22023';
  END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Source checks require 1..5000 covered rows' USING ERRCODE='22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE
      jsonb_typeof(r) IS DISTINCT FROM 'object'
      OR jsonb_typeof(r->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(r->'source_url') IS DISTINCT FROM 'string'
      OR r->>'source_url'='') THEN
    RAISE EXCEPTION 'Covered rows require an id and source URL' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(DISTINCT (r->>'id')::uuid) FROM jsonb_array_elements(p_rows) r)<>jsonb_array_length(p_rows) THEN
    RAISE EXCEPTION 'Duplicate covered scholarship rows' USING ERRCODE='22023';
  END IF;
  -- The service runner uses its existing URL normaliser before this call.
  -- Lock in UUID order and compare the exact captured raw URL, retaining fragments.
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) ORDER BY (value->>'id')::uuid LOOP
    SELECT s.external_url,s.is_active INTO current_url,current_active
      FROM public.scholarships s WHERE s.id=(item->>'id')::uuid FOR SHARE;
    IF NOT FOUND OR current_active IS DISTINCT FROM true OR current_url IS DISTINCT FROM item->>'source_url' THEN
      RAISE EXCEPTION 'Covered scholarship changed or disappeared; rerun the source check' USING ERRCODE='23514';
    END IF;
  END LOOP;
  INSERT INTO public.scholarship_source_checks(run_id,url,http_status,final_url,content_hash,outcome,detail)
    VALUES ((p_check->>'run_id')::uuid,p_check->>'url',(p_check->>'http_status')::integer,
      p_check->>'final_url',p_check->>'content_hash',p_check->>'outcome',p_check->>'detail')
    RETURNING * INTO recorded;
  INSERT INTO public.scholarship_source_check_rows(check_id,scholarship_id,source_url)
    SELECT recorded.id,(r->>'id')::uuid,r->>'source_url' FROM jsonb_array_elements(p_rows) r;
  RETURN jsonb_build_object('id',recorded.id,'checked_at',recorded.checked_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.record_scholarship_source_check(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_scholarship_source_check(jsonb,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
