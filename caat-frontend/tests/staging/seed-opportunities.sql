-- Disposable local stacks only (applied by bootstrap-local.mjs after the
-- PROD-77 attachments migration). Not a migration and never applied to production.
-- PROD-77 journeys need a scholarship with recorded requirements whose source
-- is older than 90 days, so the checklist shows recorded items, provider checks
-- and the stale label. The seed scholarship ...0002 stays unrecorded.
INSERT INTO public.scholarships (id, slug, title, provider_name, description, amount_value, amount_currency,
  amount_display, frequency, study_level, funding_type, eligible_countries, is_active, is_featured,
  tags, school_name, country, application_requirements, requires_essay, eligibility_summary, deadline_at,
  external_url, last_verified_at)
VALUES ('e2000000-0000-4000-8000-0000000000a1', 'e2e-requirements-scholarship', 'E2E Requirements Scholarship', 'Test Foundation',
  'Synthetic scholarship with recorded requirements for local journeys.', 4000, 'AUD', 'AUD $4,000', 'yearly',
  ARRAY['undergraduate']::text[], ARRAY['merit']::text[], ARRAY['Australia']::text[],
  true, false, ARRAY['e2e', 'synthetic']::text[], 'E2E Test University', 'Australia',
  '{"separate_application_required": true, "application_mode": "online form", "must_meet": ["E2E rule one", "E2E rule two"]}'::jsonb,
  true, 'Synthetic summary for the E2E requirements scholarship.', now() + interval '60 days',
  'https://scholarship.example.test/e2e-requirements', now() - interval '200 days')
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, provider_name = EXCLUDED.provider_name,
  description = EXCLUDED.description, amount_value = EXCLUDED.amount_value,
  amount_currency = EXCLUDED.amount_currency, amount_display = EXCLUDED.amount_display,
  frequency = EXCLUDED.frequency, study_level = EXCLUDED.study_level,
  funding_type = EXCLUDED.funding_type, eligible_countries = EXCLUDED.eligible_countries,
  is_active = EXCLUDED.is_active, is_featured = EXCLUDED.is_featured, tags = EXCLUDED.tags,
  school_name = EXCLUDED.school_name, country = EXCLUDED.country,
  application_requirements = EXCLUDED.application_requirements, requires_essay = EXCLUDED.requires_essay,
  eligibility_summary = EXCLUDED.eligibility_summary, deadline_at = EXCLUDED.deadline_at,
  external_url = EXCLUDED.external_url, last_verified_at = EXCLUDED.last_verified_at;


-- PROD-163: reserved fixtures for the supporting-work journey. These never
-- reuse the scholarships whose bookmark moves are exercised by other journeys.
INSERT INTO public.scholarships (id, slug, title, provider_name, description,
  amount_value, amount_currency, amount_display, frequency, study_level,
  funding_type, eligible_countries, is_active, is_featured, tags, school_name,
  country, application_requirements, requires_essay, eligibility_summary,
  deadline_at, external_url, last_verified_at)
-- Keep these awards out of the original provider's two-result onboarding cap.
SELECT fixture.id::uuid, fixture.slug, fixture.title, 'E2E Supporting Work Foundation', s.description,
  s.amount_value, s.amount_currency, s.amount_display, s.frequency, s.study_level,
  s.funding_type, s.eligible_countries, s.is_active, s.is_featured, s.tags, s.school_name,
  s.country, s.application_requirements, s.requires_essay, s.eligibility_summary,
  s.deadline_at, s.external_url, s.last_verified_at
FROM public.scholarships s CROSS JOIN (VALUES
  ('e2000000-0000-4000-8000-000000000163', 'e2e-supporting-work', 'E2E Supporting Work Scholarship'),
  ('e2000000-0000-4000-8000-000000000164', 'e2e-supporting-work-companion', 'E2E Supporting Work Companion')
) AS fixture(id, slug, title)
WHERE s.id = 'e2000000-0000-4000-8000-0000000000a1'
ON CONFLICT (id) DO NOTHING;
