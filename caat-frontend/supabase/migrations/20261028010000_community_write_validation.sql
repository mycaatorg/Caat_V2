-- PROD-187: authenticated direct writes share the existing publication limits.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Internal JSON string validator: match the action's ECMAScript trim and UTF-16 bounds.
CREATE FUNCTION public.community_post_field_text(p_value jsonb, p_min integer, p_max integer, p_trim boolean DEFAULT true)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v_text text; v_units integer;
BEGIN
 IF pg_catalog.jsonb_typeof(p_value) IS DISTINCT FROM 'string' THEN
  RAISE EXCEPTION 'Invalid community attachment field' USING ERRCODE = '23514';
 END IF;
 v_text := p_value #>> '{}';
 IF p_trim THEN
  v_text := pg_catalog.btrim(v_text, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 END IF;
 IF pg_catalog.char_length(v_text) NOT BETWEEN p_min AND p_max THEN
  RAISE EXCEPTION 'Invalid community attachment field' USING ERRCODE = '23514';
 END IF;
 SELECT pg_catalog.char_length(v_text) + count(*) FILTER (WHERE pg_catalog.ascii(c) > 65535)
 INTO v_units FROM pg_catalog.regexp_split_to_table(v_text, '') AS c;
 IF v_units > p_max THEN
  RAISE EXCEPTION 'Invalid community attachment field' USING ERRCODE = '23514';
 END IF;
 RETURN v_text;
END $$;
REVOKE ALL ON FUNCTION public.community_post_field_text(jsonb,integer,integer,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.community_validate_post_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_user uuid := auth.uid(); v_total bigint; v_daily bigint;
 v_card jsonb; v_option jsonb; v_options jsonb;
BEGIN
 -- Trusted maintenance/imports retain historical timestamps and legacy shapes.
 -- Both authenticated REST and SECURITY DEFINER publication RPCs retain auth.uid().
 IF v_user IS NULL THEN RETURN NEW; END IF;
 IF TG_OP = 'INSERT' THEN
  IF NEW.user_id IS DISTINCT FROM v_user THEN
   RAISE EXCEPTION 'Invalid post author' USING ERRCODE = '23514';
  END IF;
  -- Same author lock as create_community_resume_post; its retries return before INSERT.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 97));
  NEW.created_at := pg_catalog.statement_timestamp();
  SELECT count(*), count(*) FILTER (WHERE created_at >= NEW.created_at - interval '24 hours')
  INTO v_total, v_daily FROM public.community_posts WHERE user_id = v_user;
  IF v_total >= 5000 OR v_daily >= 100 THEN
   RAISE EXCEPTION 'Post limit reached' USING ERRCODE = '23514';
  END IF;
 ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
  RAISE EXCEPTION 'Post author and creation time cannot change' USING ERRCODE = '23514';
 END IF;

 -- Validate only new/changed fields; legacy malformed cards must not prevent edits,
 -- moderation or the existing owner-removal RPC clearing attachments.
 IF (TG_OP = 'INSERT' OR NEW.result_card IS DISTINCT FROM OLD.result_card) AND NEW.result_card IS NOT NULL THEN
  v_card := NEW.result_card;
  IF pg_catalog.jsonb_typeof(v_card) IS DISTINCT FROM 'object'
   OR coalesce(v_card->>'outcome' NOT IN ('accepted','waitlisted','rejected'), true) THEN
   RAISE EXCEPTION 'Invalid result card' USING ERRCODE = '23514';
  END IF;
  NEW.result_card := pg_catalog.jsonb_build_object('outcome',v_card->>'outcome',
   'university_name',public.community_post_field_text(v_card->'university_name',1,200));
  IF v_card ? 'program' THEN
   NEW.result_card := NEW.result_card || pg_catalog.jsonb_build_object('program',public.community_post_field_text(v_card->'program',0,200));
  END IF;
 END IF;
 IF (TG_OP = 'INSERT' OR NEW.score_card IS DISTINCT FROM OLD.score_card) AND NEW.score_card IS NOT NULL THEN
  v_card := NEW.score_card;
  IF pg_catalog.jsonb_typeof(v_card) IS DISTINCT FROM 'object'
   OR coalesce(v_card->>'exam' NOT IN ('SAT','ACT','IB','A-Levels','ATAR','AP'), true) THEN
   RAISE EXCEPTION 'Invalid score card' USING ERRCODE = '23514';
  END IF;
  NEW.score_card := pg_catalog.jsonb_build_object('exam',v_card->>'exam',
   'score',public.community_post_field_text(v_card->'score',1,50));
 END IF;
 IF (TG_OP = 'INSERT' OR NEW.poll_options IS DISTINCT FROM OLD.poll_options) AND NEW.poll_options IS NOT NULL THEN
  IF pg_catalog.jsonb_typeof(NEW.poll_options) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Invalid poll options' USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.jsonb_array_length(NEW.poll_options) NOT BETWEEN 2 AND 10 THEN
   RAISE EXCEPTION 'Invalid poll options' USING ERRCODE = '23514';
  END IF;
  v_options := '[]'::jsonb;
  FOR v_option IN SELECT value FROM pg_catalog.jsonb_array_elements(NEW.poll_options) LOOP
   IF pg_catalog.jsonb_typeof(v_option) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid poll option' USING ERRCODE = '23514';
   END IF;
   v_options := v_options || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'id',public.community_post_field_text(v_option->'id',1,64,false),
    'text',public.community_post_field_text(v_option->'text',1,120)));
  END LOOP;
  NEW.poll_options := v_options;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.community_validate_post_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_community_validate_post_write BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_validate_post_write();
NOTIFY pgrst, 'reload schema';
COMMIT;
