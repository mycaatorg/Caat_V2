-- PROD-170: keep original text in a POST body, not a length-limited URL filter.
-- Invoker rights retain the caller's existing user_todos grants and RLS.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.edit_personal_task(
 p_id uuid, p_original_text text, p_original_due_date date,
 p_text text, p_due_date date
) RETURNS TABLE(id uuid,text text,due_date date,done boolean,priority smallint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_text IS NULL OR length(btrim(p_text)) NOT BETWEEN 1 AND 1000 THEN
  RAISE EXCEPTION 'Task text must contain 1 to 1000 characters' USING ERRCODE='22023';
 END IF;
 RETURN QUERY
 UPDATE public.user_todos AS t SET text=btrim(p_text), due_date=p_due_date
 WHERE t.id=p_id AND t.user_id=(select auth.uid())
  AND t.text=p_original_text AND t.due_date IS NOT DISTINCT FROM p_original_due_date
 RETURNING t.id,t.text,t.due_date,t.done,t.priority;
END $$;
REVOKE ALL ON FUNCTION public.edit_personal_task(uuid,text,date,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_personal_task(uuid,text,date,text,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
