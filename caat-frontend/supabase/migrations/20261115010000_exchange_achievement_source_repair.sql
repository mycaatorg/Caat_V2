-- PROD-277: exact award identity confirmed on the official 2027 exchange page.
-- Link repair only: recorded award facts and verification/import dates stay intact.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $repair$
DECLARE
  target constant uuid := '1b720943-1f37-49e5-b45d-8877d79a483e';
  old_url constant text := 'https://www.scholarships.unsw.edu.au/scholarships/id/1899/7088#UGTR1048';
  new_url constant text := 'https://www.scholarships.unsw.edu.au/scholarships/id/2001';
  current_row public.scholarships%ROWTYPE;
BEGIN
  SELECT * INTO current_row FROM public.scholarships WHERE id=target FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF; -- No production target in fresh local databases.
  IF current_row.source_id IS DISTINCT FROM 'c2d4e6f8-1a3b-5c7d-9e0f-2b4c6d8e0f1a'::uuid
     OR current_row.external_id IS DISTINCT FROM 'UGTR1048'
     OR current_row.title IS DISTINCT FROM 'UNSW Student Exchange Achievement Award'
     OR current_row.is_active IS DISTINCT FROM true
     OR current_row.external_url IS NULL
     OR current_row.external_url NOT IN (old_url,new_url)
     OR (current_row.raw_payload IS NOT NULL AND jsonb_typeof(current_row.raw_payload)<>'object') THEN
    RAISE EXCEPTION 'PROD-277 source identity drift';
  END IF;
  IF current_row.external_url=new_url THEN
    IF (current_row.raw_payload->'source_url_repair'->>'issue'='PROD-277'
        AND current_row.raw_payload->'source_url_repair'->>'previous_url'=old_url
        AND current_row.raw_payload->'source_url_repair'->>'replacement_url'=new_url) IS NOT TRUE THEN
      RAISE EXCEPTION 'PROD-277 repaired audit drift';
    END IF;
    RETURN;
  END IF;
  IF current_row.raw_payload ? 'source_url_repair' THEN
    RAISE EXCEPTION 'PROD-277 prior audit drift';
  END IF;
  UPDATE public.scholarships
     SET external_url=new_url,
         raw_payload=coalesce(raw_payload,'{}'::jsonb) || jsonb_build_object('source_url_repair',jsonb_build_object(
           'issue','PROD-277','previous_url',old_url,'replacement_url',new_url,
           'reason','Exact UGTR1048 award identity confirmed on official replacement source; recorded fields not re-verified'))
   WHERE id=target;
END;
$repair$;
COMMIT;
