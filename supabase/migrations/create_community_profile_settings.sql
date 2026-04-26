-- Migration: community_profile_settings table
-- Controls which CAAT profile fields appear on a user's community profile.

CREATE TABLE IF NOT EXISTS community_profile_settings (
  user_id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_graduation_year      BOOLEAN NOT NULL DEFAULT TRUE,
  show_school_name          BOOLEAN NOT NULL DEFAULT TRUE,
  show_preferred_countries  BOOLEAN NOT NULL DEFAULT FALSE,
  show_target_majors        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE community_profile_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings (needed to render other users' profiles)
CREATE POLICY "cps_select" ON community_profile_settings
  FOR SELECT TO authenticated USING (TRUE);

-- Users can only write their own settings
CREATE POLICY "cps_insert" ON community_profile_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cps_update" ON community_profile_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
