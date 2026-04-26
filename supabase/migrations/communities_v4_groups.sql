-- ─── Community Groups ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  description TEXT,
  creator_id  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_private  BOOLEAN     NOT NULL DEFAULT false,
  icon_url    TEXT,
  banner_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$')
);

-- ─── Group Members (created BEFORE policies that reference it) ────────────────
CREATE TABLE IF NOT EXISTS public.community_group_members (
  group_id  UUID        NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'owner')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- ─── RLS — groups ─────────────────────────────────────────────────────────────
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select" ON public.community_groups
  FOR SELECT TO authenticated
  USING (
    is_private = false
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.community_group_members
      WHERE group_id = community_groups.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "groups_insert" ON public.community_groups
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "groups_update" ON public.community_groups
  FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "groups_delete" ON public.community_groups
  FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- ─── RLS — members ────────────────────────────────────────────────────────────
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select" ON public.community_group_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "members_insert" ON public.community_group_members
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members_delete" ON public.community_group_members
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── Add group_id to community_posts ─────────────────────────────────────────
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.community_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_community_posts_group
  ON public.community_posts (group_id, created_at DESC)
  WHERE is_hidden = false;
