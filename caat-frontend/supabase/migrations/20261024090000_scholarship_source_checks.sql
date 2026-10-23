-- PROD-143: record real checks of each scholarship's source page.
-- Additive only. One row per URL per run, written by
-- scripts/refresh-scholarship-sources.mjs with the service role. Students never
-- read this table; the eligibility panel keeps reading scholarships.last_verified_at,
-- which the runner advances only when a check finds the page unchanged.
BEGIN;

-- Per-outcome counts for a refresh run. The existing count columns cannot hold them.
ALTER TABLE public.scholarship_import_runs ADD COLUMN IF NOT EXISTS check_counts jsonb;

CREATE TABLE public.scholarship_source_checks (
 id bigserial PRIMARY KEY,
 run_id uuid NOT NULL REFERENCES public.scholarship_import_runs(id) ON DELETE CASCADE,
 url text NOT NULL CHECK (url ~ '^https?://'),
 checked_at timestamptz NOT NULL DEFAULT now(),
 http_status integer,
 final_url text,
 content_hash text,
 outcome text NOT NULL CHECK (outcome IN ('unchanged', 'changed', 'unreachable', 'gone', 'baseline')),
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

-- A verification date can never be in the future. Validate it when the existing
-- rows allow; otherwise add it NOT VALID so new writes are still checked and the
-- old rows are left for a separate, reviewed fix.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.scholarships WHERE last_verified_at > now()) THEN
  ALTER TABLE public.scholarships ADD CONSTRAINT scholarships_last_verified_not_future
   CHECK (last_verified_at IS NULL OR last_verified_at <= now()) NOT VALID;
  RAISE NOTICE 'scholarships_last_verified_not_future added NOT VALID: existing rows have a future last_verified_at';
 ELSE
  ALTER TABLE public.scholarships ADD CONSTRAINT scholarships_last_verified_not_future
   CHECK (last_verified_at IS NULL OR last_verified_at <= now());
 END IF;
END
$$;

COMMIT;
