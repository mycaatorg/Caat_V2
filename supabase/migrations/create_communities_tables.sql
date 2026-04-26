-- Migration: CAAT Communities — all tables, indexes, and RLS policies
-- Run this in the Supabase SQL editor.

-- ─────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_posts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content          TEXT NOT NULL CHECK (char_length(content) <= 2000),
  topic_tag        TEXT NOT NULL CHECK (topic_tag IN ('APPLICATION_RESULTS','ESSAYS','TEST_SCORES','EXTRACURRICULARS','ADVICE','SCHOLARSHIPS')),
  university_id    BIGINT REFERENCES schools(id) ON DELETE SET NULL,
  major_id         UUID REFERENCES majors(id) ON DELETE SET NULL,
  result_card      JSONB,
  score_card       JSONB,
  resume_link      UUID,
  is_hidden        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_comments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id             UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id   UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  content             TEXT NOT NULL CHECK (char_length(content) <= 1000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_likes (
  post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_saves (
  post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_follows (
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE IF NOT EXISTS community_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  reporter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('like','comment','reply')),
  post_id     UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────

-- Feed pagination (cursor on created_at + id)
CREATE INDEX IF NOT EXISTS idx_community_posts_cursor
  ON community_posts (created_at DESC, id DESC)
  WHERE is_hidden = FALSE;

-- Filter feed by topic
CREATE INDEX IF NOT EXISTS idx_community_posts_topic
  ON community_posts (topic_tag)
  WHERE is_hidden = FALSE;

-- Following feed — find posts by users I follow
CREATE INDEX IF NOT EXISTS idx_community_posts_user
  ON community_posts (user_id, created_at DESC)
  WHERE is_hidden = FALSE;

-- Comments per post
CREATE INDEX IF NOT EXISTS idx_community_comments_post
  ON community_comments (post_id, created_at ASC);

-- Notifications per user (unread first)
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id, is_read, created_at DESC);

-- ─────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_community_comments_updated_at
  BEFORE UPDATE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────
-- AUTO-HIDE: hide post after 3 unique reports
-- ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_post_reports()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM community_reports WHERE post_id = NEW.post_id
  ) >= 3 THEN
    UPDATE community_posts SET is_hidden = TRUE WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_auto_hide_post
  AFTER INSERT ON community_reports
  FOR EACH ROW EXECUTE FUNCTION check_post_reports();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

ALTER TABLE community_posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_saves     ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_follows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_reports   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications       ENABLE ROW LEVEL SECURITY;

-- community_posts
CREATE POLICY "posts_select" ON community_posts
  FOR SELECT TO authenticated
  USING (is_hidden = FALSE);

CREATE POLICY "posts_insert" ON community_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update" ON community_posts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_delete" ON community_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- community_comments
CREATE POLICY "comments_select" ON community_comments
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "comments_insert" ON community_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update" ON community_comments
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete" ON community_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- community_likes
CREATE POLICY "likes_select" ON community_likes
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "likes_insert" ON community_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes_delete" ON community_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- community_saves
CREATE POLICY "saves_select" ON community_saves
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saves_insert" ON community_saves
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saves_delete" ON community_saves
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- community_follows
CREATE POLICY "follows_select" ON community_follows
  FOR SELECT TO authenticated
  USING (TRUE);

CREATE POLICY "follows_insert" ON community_follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete" ON community_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- community_reports
CREATE POLICY "reports_insert" ON community_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

-- notifications
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
