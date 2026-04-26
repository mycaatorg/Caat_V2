CREATE TABLE IF NOT EXISTS public.custom_essay_prompts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_essay_prompts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'custom_essay_prompts' AND policyname = 'users_manage_own_custom_prompts'
  ) THEN
    CREATE POLICY "users_manage_own_custom_prompts" ON public.custom_essay_prompts
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;
