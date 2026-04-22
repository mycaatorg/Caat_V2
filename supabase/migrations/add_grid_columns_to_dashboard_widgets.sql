-- Migration: add grid position columns to user_dashboard_widgets
--
-- Run this in the Supabase SQL editor (or via supabase db push).
-- All four columns are nullable so existing rows are unaffected;
-- the front-end auto-assigns positions on first load and then persists them.

ALTER TABLE user_dashboard_widgets
  ADD COLUMN IF NOT EXISTS grid_x INTEGER,
  ADD COLUMN IF NOT EXISTS grid_y INTEGER,
  ADD COLUMN IF NOT EXISTS grid_w INTEGER,
  ADD COLUMN IF NOT EXISTS grid_h INTEGER;
