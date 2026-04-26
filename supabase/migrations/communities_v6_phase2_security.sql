-- Phase 2 security remediation — corresponds to SECURITY_REMEDIATION_PLAN.md
-- items P2.2, P2.3, P2.5.

-- ─────────────────────────────────────────
-- P2.2 — Add `message` column to notifications so join-request and
--        approval/rejection notifications can carry context. Also extend the
--        type CHECK to include the new `request_approved` / `request_rejected`
--        types used by approveJoinRequestAction / rejectJoinRequestAction.
-- ─────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like','comment','reply','follow','join_request','request_approved','request_rejected'));

-- ─────────────────────────────────────────
-- P2.3 — Notification deduplication. Repeated like-toggles or follow-toggles no
--        longer create new rows; the application uses ON CONFLICT DO NOTHING.
-- ─────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (
    user_id,
    actor_id,
    type,
    COALESCE(post_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ─────────────────────────────────────────
-- P2.5 — Tighten the auto-hide threshold so a Sybil cluster can't censor any
--        post with three throwaway accounts. Now requires either:
--          • 5+ unique reports total, OR
--          • 3+ reports from accounts older than 7 days
--        Both conditions are evaluated; either being true triggers the hide.
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_post_reports()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_count INT;
  trusted_count INT;
BEGIN
  SELECT COUNT(*) INTO total_count
    FROM public.community_reports
    WHERE post_id = NEW.post_id;

  SELECT COUNT(*) INTO trusted_count
    FROM public.community_reports r
    JOIN auth.users u ON u.id = r.reporter_id
    WHERE r.post_id = NEW.post_id
      AND u.created_at < (now() - interval '7 days');

  IF total_count >= 5 OR trusted_count >= 3 THEN
    UPDATE public.community_posts SET is_hidden = TRUE WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-attach trigger if it was somehow dropped (no-op if it already exists).
DROP TRIGGER IF EXISTS trg_auto_hide_post ON public.community_reports;
CREATE TRIGGER trg_auto_hide_post
  AFTER INSERT ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.check_post_reports();
