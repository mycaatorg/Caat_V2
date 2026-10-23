-- PROD-143: record real checks of each scholarship's source page.
-- Additive only. One row per URL per run, written by
-- scripts/refresh-scholarship-sources.mjs with the service role. Students never
-- read this table; the eligibility panel keeps reading scholarships.last_verified_at,
-- which the runner advances only when a check finds the page unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- A verification date can never be in the future. Five minutes of tolerance keep
-- an importer whose clock runs slightly ahead of the database from failing a load.
-- If any existing row is beyond that, stop: a person fixes those rows first.
DO $$
DECLARE
 future_rows bigint;
BEGIN
 SELECT count(*) INTO future_rows FROM public.scholarships WHERE last_verified_at > now() + interval '5 minutes';
 IF future_rows > 0 THEN
  RAISE EXCEPTION '% scholarships rows have last_verified_at in the future; fix them before applying this migration', future_rows;
 END IF;
END
$$;
ALTER TABLE public.scholarships ADD CONSTRAINT scholarships_last_verified_not_future
 CHECK (last_verified_at IS NULL OR last_verified_at <= now() + interval '5 minutes');

-- Per-outcome counts for a refresh run. The existing count columns cannot hold them.
ALTER TABLE public.scholarship_import_runs ADD COLUMN IF NOT EXISTS check_counts jsonb;

-- Runs are never pruned: a run with checks cannot be deleted.
CREATE TABLE public.scholarship_source_checks (
 id bigserial PRIMARY KEY,
 run_id uuid NOT NULL REFERENCES public.scholarship_import_runs(id) ON DELETE RESTRICT,
 url text NOT NULL CHECK (url ~ '^https?://'),
 checked_at timestamptz NOT NULL DEFAULT now(),
 http_status integer,
 final_url text,
 content_hash text,
 outcome text NOT NULL CHECK (outcome IN ('unchanged', 'changed', 'unreachable', 'gone', 'baseline', 'unanchored')),
 detail text
);
CREATE INDEX scholarship_source_checks_url_checked ON public.scholarship_source_checks (url, checked_at DESC);
CREATE INDEX scholarship_source_checks_run ON public.scholarship_source_checks (run_id);

ALTER TABLE public.scholarship_source_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.scholarship_source_checks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.scholarship_source_checks_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.scholarship_source_checks TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.scholarship_source_checks_id_seq TO service_role;
-- No policies: with RLS on and no grants, anon and authenticated get nothing.

-- updated_at feeds the sitemap's lastModified. A source check that only moves
-- last_verified_at or source_last_synced_at is not a content change, so it keeps
-- the old updated_at. Any other column change still bumps it.
CREATE FUNCTION public.scholarships_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
 IF (to_jsonb(NEW) - ARRAY['updated_at', 'last_verified_at', 'source_last_synced_at'])
    = (to_jsonb(OLD) - ARRAY['updated_at', 'last_verified_at', 'source_last_synced_at']) THEN
  NEW.updated_at = OLD.updated_at;
 ELSE
  NEW.updated_at = pg_catalog.now();
 END IF;
 RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_scholarships_updated_at ON public.scholarships;
CREATE TRIGGER trg_scholarships_updated_at BEFORE UPDATE ON public.scholarships
 FOR EACH ROW EXECUTE FUNCTION public.scholarships_set_updated_at();

-- Deactivate a row whose source page is gone, merging the reason into raw_payload
-- in one statement so a concurrent raw_payload write cannot be lost. Returns the id,
-- or NULL when the row was already inactive. Service role only.
CREATE FUNCTION public.scholarship_mark_gone(p_id uuid, p_check jsonb)
 RETURNS uuid
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path = ''
AS $function$
 UPDATE public.scholarships
    SET is_active = false,
        raw_payload = coalesce(raw_payload, '{}'::jsonb) || jsonb_build_object('source_check', p_check)
  WHERE id = p_id AND is_active
  RETURNING id;
$function$;
REVOKE ALL ON FUNCTION public.scholarship_mark_gone(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scholarship_mark_gone(uuid, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
