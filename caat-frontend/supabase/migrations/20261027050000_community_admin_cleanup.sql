-- PROD-196: Auth Admin deletes run without public on the caller's search_path.
-- Keep the existing trigger contract/privileges and exact post-child scope.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.delete_post_children()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
BEGIN
 DELETE FROM public.community_comment_likes
 WHERE comment_id IN (SELECT id FROM public.community_comments WHERE post_id=OLD.id);
 DELETE FROM public.community_comments WHERE post_id=OLD.id;
 DELETE FROM public.community_likes WHERE post_id=OLD.id;
 DELETE FROM public.community_saves WHERE post_id=OLD.id;
 DELETE FROM public.community_reports WHERE post_id=OLD.id;
 DELETE FROM public.community_poll_votes WHERE post_id=OLD.id;
 DELETE FROM public.notifications WHERE post_id=OLD.id;
 RETURN OLD;
END;
$$;
COMMIT;
