-- PROD-269: identical concurrent deliveries must handle both task unique keys.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.create_application_task(p_task_id uuid,p_application_id uuid,p_text text,p_due_date date)
RETURNS TABLE(id uuid,text text,due_date date,done boolean,priority smallint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_user uuid := auth.uid();
 v_text text;
 v_units integer;
 v_inserted uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_task_id IS NULL OR p_application_id IS NULL THEN RAISE EXCEPTION 'Task and application required' USING ERRCODE='22023'; END IF;
 -- Same ECMAScript trim and UTF-16 length contract as edit_personal_task.
 v_text:=btrim(p_text,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 IF v_text IS NULL OR char_length(v_text) NOT BETWEEN 1 AND 1000 THEN
  RAISE EXCEPTION 'Task text must contain 1 to 1000 UTF-16 code units' USING ERRCODE='22023';
 END IF;
 SELECT char_length(v_text)+count(*) FILTER(WHERE ascii(c)>65535) INTO v_units FROM regexp_split_to_table(v_text,'') AS c;
 IF v_units>1000 OR p_due_date<DATE '0001-01-01' OR p_due_date>DATE '9999-12-31' THEN
  RAISE EXCEPTION 'Task text or date is invalid' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.user_todos AS t(id,user_id,text,due_date,done,priority)
 VALUES(p_task_id,v_user,v_text,p_due_date,false,2)
 -- Both the primary key and the ownership unique key may arbitrate an
 -- identical speculative insert. Handle every usable unique constraint.
 ON CONFLICT DO NOTHING RETURNING t.id INTO v_inserted;
 IF v_inserted IS NOT NULL THEN
  -- Composite foreign keys enforce ownership of both objects, including for
  -- privileged callers. A failed link rolls back the task insert atomically.
  INSERT INTO public.application_task_links(task_id,application_id,user_id) VALUES(p_task_id,p_application_id,v_user);
 END IF;
 -- Stable request IDs allow identical retries after uncertain delivery. Never
 -- overwrite another task, changed content, or an existing general task.
 RETURN QUERY SELECT t.id,t.text,t.due_date,t.done,t.priority
 FROM public.user_todos t JOIN public.application_task_links l ON l.task_id=t.id AND l.user_id=t.user_id
 WHERE t.id=p_task_id AND t.user_id=v_user AND l.application_id=p_application_id
  AND t.text=v_text AND t.due_date IS NOT DISTINCT FROM p_due_date;
 IF NOT FOUND THEN RAISE EXCEPTION 'Task changed or request conflicts. Refresh before retrying.' USING ERRCODE='PT409'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.create_application_task(uuid,uuid,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_application_task(uuid,uuid,text,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
