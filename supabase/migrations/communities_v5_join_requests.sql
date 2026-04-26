-- Extend notifications type to include join_request
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'reply', 'follow', 'join_request'));

-- Join requests for private community groups
CREATE TABLE IF NOT EXISTS public.community_group_requests (
  group_id   UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.community_group_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_group_requests' AND policyname = 'users_view_own_requests'
  ) THEN
    CREATE POLICY "users_view_own_requests" ON public.community_group_requests
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- Authenticated users can insert a request for themselves
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_group_requests' AND policyname = 'users_insert_requests'
  ) THEN
    CREATE POLICY "users_insert_requests" ON public.community_group_requests
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Community creator can view and update requests for their groups
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'community_group_requests' AND policyname = 'owner_manage_requests'
  ) THEN
    CREATE POLICY "owner_manage_requests" ON public.community_group_requests
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.community_groups
          WHERE id = group_id AND creator_id = auth.uid()
        )
      );
  END IF;
END $$;
