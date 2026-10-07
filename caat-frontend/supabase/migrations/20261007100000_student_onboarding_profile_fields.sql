-- PROD-73: progressive onboarding for Australian students.
-- Additive and nullable: existing profiles are unaffected, and the existing
-- owner-only profiles RLS policies cover the new columns.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS year_level text,
  ADD COLUMN IF NOT EXISTS student_status text,
  ADD COLUMN IF NOT EXISTS journey_stage text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_year_level_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_year_level_check
      CHECK (year_level IS NULL OR year_level IN ('year_10', 'year_11', 'year_12', 'finished', 'not_sure'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_student_status_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_student_status_check
      CHECK (student_status IS NULL OR student_status IN ('domestic', 'international', 'not_sure'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_journey_stage_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_journey_stage_check
      CHECK (journey_stage IS NULL OR journey_stage IN ('exploring', 'shortlisting', 'applying', 'waiting'));
  END IF;
END $$;
