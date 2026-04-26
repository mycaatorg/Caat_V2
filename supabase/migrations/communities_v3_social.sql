-- ─── community_profile_settings (create if not already applied) ───────────────
CREATE TABLE IF NOT EXISTS public.community_profile_settings (
  user_id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_graduation_year      BOOLEAN NOT NULL DEFAULT TRUE,
  show_school_name          BOOLEAN NOT NULL DEFAULT TRUE,
  show_preferred_countries  BOOLEAN NOT NULL DEFAULT FALSE,
  show_target_majors        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_profile_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_profile_settings' AND policyname = 'cps_select') THEN
    CREATE POLICY "cps_select" ON public.community_profile_settings FOR SELECT TO authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_profile_settings' AND policyname = 'cps_insert') THEN
    CREATE POLICY "cps_insert" ON public.community_profile_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_profile_settings' AND policyname = 'cps_update') THEN
    CREATE POLICY "cps_update" ON public.community_profile_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── Pinned Post ──────────────────────────────────────────────────────────────
ALTER TABLE public.community_profile_settings
  ADD COLUMN IF NOT EXISTS pinned_post_id UUID REFERENCES public.community_posts(id) ON DELETE SET NULL;

-- ─── Comment Likes ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_comment_likes (
  comment_id UUID REFERENCES public.community_comments(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id)               ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);
ALTER TABLE public.community_comment_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_comment_likes' AND policyname = 'Anyone can read comment likes') THEN
    CREATE POLICY "Anyone can read comment likes" ON public.community_comment_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_comment_likes' AND policyname = 'Users manage own comment likes') THEN
    CREATE POLICY "Users manage own comment likes" ON public.community_comment_likes USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ─── User Blocks ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_blocks (
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_blocks' AND policyname = 'Users manage own blocks') THEN
    CREATE POLICY "Users manage own blocks" ON public.community_blocks USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);
  END IF;
END $$;

-- ─── Notifications: allow follow type + nullable post_id ─────────────────────

-- Drop the old NOT NULL constraint on post_id
ALTER TABLE public.notifications ALTER COLUMN post_id DROP NOT NULL;

-- Replace the type check constraint to include 'follow'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'reply', 'follow'));
