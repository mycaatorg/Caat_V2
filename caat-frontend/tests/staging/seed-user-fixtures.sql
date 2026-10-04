-- User-owned community fixture; run after seed-users.mjs has created local Auth accounts.
INSERT INTO public.community_groups (id, slug, name, description, creator_id, is_private)
SELECT 'e2000000-0000-4000-8000-000000000004', 'e2e-test-community', 'E2E Test Community',
  'Synthetic public group for local journeys.', u.id, false
FROM auth.users AS u WHERE lower(u.email) = 'e2e.student@caat.local.test'
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name,
  description = EXCLUDED.description, creator_id = EXCLUDED.creator_id, is_private = EXCLUDED.is_private;

INSERT INTO public.community_group_members (group_id, user_id, role)
SELECT 'e2000000-0000-4000-8000-000000000004', u.id, 'owner'
FROM auth.users AS u WHERE lower(u.email) = 'e2e.student@caat.local.test'
ON CONFLICT DO NOTHING;
