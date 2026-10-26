BEGIN;
CREATE TABLE public.shortlist_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 items jsonb NOT NULL CHECK(jsonb_typeof(items)='array' AND jsonb_array_length(items) BETWEEN 1 AND 20),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '30 days'),
 revoked_at timestamptz,
 revision uuid NOT NULL DEFAULT gen_random_uuid()
);
CREATE INDEX shortlist_shares_owner ON public.shortlist_shares(user_id,created_at DESC);
ALTER TABLE public.shortlist_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shortlist_shares FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.shortlist_shares TO authenticated;
GRANT ALL ON public.shortlist_shares TO service_role;
CREATE POLICY shortlist_shares_owner_read ON public.shortlist_shares FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
CREATE POLICY shortlist_shares_owner_delete ON public.shortlist_shares FOR DELETE TO authenticated USING(user_id=(SELECT auth.uid()));

-- Never accept rendered recipient data from a caller. Build the whitelist from
-- their own bookmarks and catalogue fields, independent of application work.
CREATE FUNCTION public.preview_shortlist_share(p_selection jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=auth.uid(); chosen jsonb; item jsonb; result jsonb:='[]';
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION 'Sign in to share' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_selection) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose saved items' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_selection) NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Choose 1 to 20 items' USING ERRCODE='22023'; END IF;
 IF (SELECT count(DISTINCT (e->>'kind',e->>'id')) FROM jsonb_array_elements(p_selection)e) <> jsonb_array_length(p_selection) THEN
  RAISE EXCEPTION 'Choose each item once' USING ERRCODE='22023';
 END IF;
 FOR chosen IN SELECT value FROM jsonb_array_elements(p_selection) LOOP
  IF jsonb_typeof(chosen->'kind') IS DISTINCT FROM 'string' OR jsonb_typeof(chosen->'id') IS DISTINCT FROM 'string' OR length(chosen->>'id') NOT BETWEEN 1 AND 200 THEN
   RAISE EXCEPTION 'Invalid selection' USING ERRCODE='22023';
  END IF;
  item:=NULL;
  CASE chosen->>'kind'
   WHEN 'course' THEN
    SELECT jsonb_build_object('kind','course','id',c.id,'title',c.name,'details',array_remove(ARRAY[c.institution_name,c.program_code,c.campus,'Source year '||c.source_year::text],NULL),'sourceUrl',c.source_url)
    INTO item FROM public.user_course_bookmarks b JOIN public.course_offerings c ON c.id=b.course_id
    WHERE b.user_id=caller AND c.id=chosen->>'id' AND c.active;
   WHEN 'school' THEN
    SELECT jsonb_build_object('kind','school','id',s.id::text,'title',s.name,'details',array_remove(ARRAY[s.country],NULL),'sourceUrl',NULL)
    INTO item FROM public.user_bookmarked_schools b JOIN public.schools s ON s.id=b.school_id
    WHERE b.user_id=caller AND s.id::text=chosen->>'id';
   WHEN 'major' THEN
    SELECT jsonb_build_object('kind','major','id',m.id::text,'title',m.name,'details',array_remove(ARRAY[m.category],NULL),'sourceUrl',NULL)
    INTO item FROM public.user_bookmarked_majors b JOIN public.majors m ON m.id=b.major_id
    WHERE b.user_id=caller AND m.id::text=chosen->>'id';
   WHEN 'scholarship' THEN
    SELECT jsonb_build_object('kind','scholarship','id',s.id::text,'title',s.title,'details',array_remove(ARRAY[s.provider_name,s.amount_display,'Closing date '||to_char(s.deadline_at AT TIME ZONE 'UTC','YYYY-MM-DD')],NULL),'sourceUrl',s.external_url)
    INTO item FROM public.user_bookmarked_scholarships b JOIN public.scholarships s ON s.id=b.scholarship_id
    WHERE b.user_id=caller AND s.id::text=chosen->>'id' AND s.is_active;
   ELSE RAISE EXCEPTION 'Invalid item type' USING ERRCODE='22023';
  END CASE;
  IF item IS NULL THEN RAISE EXCEPTION 'An item is no longer saved or available. Refresh your selection.' USING ERRCODE='PT409'; END IF;
  result:=result||jsonb_build_array(item);
 END LOOP;
 RETURN result;
END;
$$;
CREATE FUNCTION public.create_shortlist_share(p_selection jsonb,p_expected_items jsonb,p_token text)
RETURNS SETOF public.shortlist_shares LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE caller uuid:=auth.uid(); digest text; saved public.shortlist_shares%ROWTYPE; current_items jsonb;
BEGIN
 IF caller IS NULL THEN RAISE EXCEPTION 'Sign in to share' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid link' USING ERRCODE='22023'; END IF;
 digest:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 -- Serialize all creation for this owner, including duplicate request retries.
 PERFORM 1 FROM auth.users WHERE id=caller FOR UPDATE;
 SELECT * INTO saved FROM public.shortlist_shares WHERE token_hash=digest FOR UPDATE;
 IF FOUND THEN
  IF saved.user_id=caller AND saved.items=p_expected_items AND saved.revoked_at IS NULL AND saved.expires_at>now() THEN RETURN NEXT saved; RETURN; END IF;
  RAISE EXCEPTION 'Link changed. Refresh your links.' USING ERRCODE='PT409';
 END IF;
 IF (SELECT count(*) FROM public.shortlist_shares WHERE user_id=caller)>=50 THEN RAISE EXCEPTION 'Remove an old shared link before creating another.' USING ERRCODE='54000'; END IF;
 current_items:=public.preview_shortlist_share(p_selection);
 IF current_items IS DISTINCT FROM p_expected_items THEN RAISE EXCEPTION 'Selected information changed. Preview it again.' USING ERRCODE='PT409'; END IF;
 RETURN QUERY INSERT INTO public.shortlist_shares(user_id,token_hash,items) VALUES(caller,digest,current_items) RETURNING *;
END;
$$;
CREATE FUNCTION public.replace_shortlist_share(p_id uuid,p_expected_revision uuid,p_token text)
RETURNS SETOF public.shortlist_shares LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved public.shortlist_shares%ROWTYPE; digest text;
BEGIN
 SELECT * INTO saved FROM public.shortlist_shares WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Link unavailable' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid link' USING ERRCODE='22023'; END IF;
 IF saved.revoked_at IS NOT NULL OR saved.expires_at<=now() THEN RAISE EXCEPTION 'Link is no longer active' USING ERRCODE='PT409'; END IF;
 digest:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 IF saved.token_hash=digest THEN RETURN NEXT saved; RETURN; END IF;
 IF saved.revision IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Link changed. Refresh your links.' USING ERRCODE='PT409'; END IF;
 RETURN QUERY UPDATE public.shortlist_shares SET token_hash=digest,revision=gen_random_uuid() WHERE id=p_id RETURNING *;
END;
$$;
CREATE FUNCTION public.revoke_shortlist_share(p_id uuid) RETURNS SETOF public.shortlist_shares
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY UPDATE public.shortlist_shares SET revoked_at=coalesce(revoked_at,clock_timestamp()),revision=gen_random_uuid()
 WHERE id=p_id AND user_id=auth.uid() RETURNING *;
 IF NOT FOUND THEN RAISE EXCEPTION 'Link unavailable' USING ERRCODE='42501'; END IF;
END;
$$;
CREATE FUNCTION public.read_shortlist_share(p_token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('items',s.items,'created_at',s.created_at,'expires_at',s.expires_at)
 FROM public.shortlist_shares s
 WHERE p_token ~ '^[a-f0-9]{64}$' AND s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')
 AND s.revoked_at IS NULL AND s.expires_at>now();
$$;
REVOKE ALL ON FUNCTION public.preview_shortlist_share(jsonb),public.create_shortlist_share(jsonb,jsonb,text),public.replace_shortlist_share(uuid,uuid,text),public.revoke_shortlist_share(uuid),public.read_shortlist_share(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preview_shortlist_share(jsonb),public.create_shortlist_share(jsonb,jsonb,text),public.replace_shortlist_share(uuid,uuid,text),public.revoke_shortlist_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_shortlist_share(text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
