-- Communities v2 feature additions

-- Anonymous posting
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;

-- Post editing timestamp
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Polls (array of {id, text} stored as JSONB)
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS poll_options JSONB;

-- Poll votes
CREATE TABLE IF NOT EXISTS community_poll_votes (
  post_id   UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  option_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE community_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own vote"   ON community_poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read all votes"    ON community_poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can delete own vote"   ON community_poll_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own vote"   ON community_poll_votes FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Verified admits badge (set manually by admin via Supabase dashboard)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
