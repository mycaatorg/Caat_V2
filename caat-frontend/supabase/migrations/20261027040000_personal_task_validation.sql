-- PROD-172: match String.trim() and the editor's UTF-16 maxlength boundary.
-- No existing rows are rewritten; owner/CAS guards and invoker RLS stay intact.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.edit_personal_task(
 p_id uuid, p_original_text text, p_original_due_date date,
 p_text text, p_due_date date
) RETURNS TABLE(id uuid,text text,due_date date,done boolean,priority smallint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_text text;
 v_units integer;
BEGIN
 -- ECMAScript WhiteSpace and LineTerminator set (not locale-dependent \s).
 v_text := btrim(p_text, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 IF v_text IS NULL OR char_length(v_text) NOT BETWEEN 1 AND 1000 THEN
  RAISE EXCEPTION 'Task text must contain 1 to 1000 UTF-16 code units' USING ERRCODE='22023';
 END IF;
 -- PostgreSQL counts Unicode code points. UTF-16 adds a unit per non-BMP point.
 SELECT char_length(v_text) + count(*) FILTER (WHERE ascii(c) > 65535)
 INTO v_units FROM regexp_split_to_table(v_text, '') AS c;
 IF v_units > 1000 THEN
  RAISE EXCEPTION 'Task text must contain 1 to 1000 UTF-16 code units' USING ERRCODE='22023';
 END IF;
 RETURN QUERY
 UPDATE public.user_todos AS t SET text=v_text, due_date=p_due_date
 WHERE t.id=p_id AND t.user_id=(select auth.uid())
  AND t.text=p_original_text AND t.due_date IS NOT DISTINCT FROM p_original_due_date
 RETURNING t.id,t.text,t.due_date,t.done,t.priority;
END $$;
REVOKE ALL ON FUNCTION public.edit_personal_task(uuid,text,date,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_personal_task(uuid,text,date,text,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
