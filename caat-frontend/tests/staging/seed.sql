-- Synthetic catalog and E2E community fixtures only. Stable values let browser journeys
-- select deterministic rows without importing or depending on production data.
INSERT INTO public.schools (id, name, country, website, institution_type)
VALUES (900001, 'E2E Test University', 'Australia', 'https://university.example.test', 'university')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, country = EXCLUDED.country,
  website = EXCLUDED.website, institution_type = EXCLUDED.institution_type;

INSERT INTO public.majors (id, name, category, description, career_paths, typical_coursework)
VALUES ('e2000000-0000-4000-8000-000000000001', 'E2E Test Engineering', 'Engineering',
        'Synthetic major fixture for local journeys.', '["Test engineer"]'::jsonb,
        '["Testing 101"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category,
  description = EXCLUDED.description, career_paths = EXCLUDED.career_paths,
  typical_coursework = EXCLUDED.typical_coursework;

INSERT INTO public.scholarships (id, slug, title, provider_name, description, amount_value, amount_currency,
  amount_display, frequency, study_level, funding_type, eligible_countries, is_active, is_featured,
  tags, school_name, country)
VALUES ('e2000000-0000-4000-8000-000000000002', 'e2e-test-scholarship', 'E2E Test Scholarship', 'Test Foundation',
  'Synthetic scholarship fixture for local journeys.', 2500, 'AUD', 'AUD $2,500', 'yearly',
  ARRAY['undergraduate']::text[], ARRAY['merit']::text[], ARRAY['Australia']::text[],
  true, true, ARRAY['e2e', 'synthetic']::text[], 'E2E Test University', 'Australia')
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, provider_name = EXCLUDED.provider_name,
  description = EXCLUDED.description, amount_value = EXCLUDED.amount_value,
  amount_currency = EXCLUDED.amount_currency, amount_display = EXCLUDED.amount_display,
  frequency = EXCLUDED.frequency, study_level = EXCLUDED.study_level,
  funding_type = EXCLUDED.funding_type, eligible_countries = EXCLUDED.eligible_countries,
  is_active = EXCLUDED.is_active, is_featured = EXCLUDED.is_featured, tags = EXCLUDED.tags,
  school_name = EXCLUDED.school_name, country = EXCLUDED.country;

-- Link the synthetic scholarship to the synthetic university through the
-- junction, so the application hub's scholarship_schools!inner read (PROD-147)
-- is exercised end to end, not only its school-name fallback.
INSERT INTO public.scholarship_schools (scholarship_id, school_id)
VALUES ('e2000000-0000-4000-8000-000000000002', 900001)
ON CONFLICT DO NOTHING;

INSERT INTO public.essay_prompts (id, slug, title, description, tips, sort_order, scope)
VALUES ('e2000000-0000-4000-8000-000000000003', 'e2e-community-reflection',
  'E2E Test Essay Prompt', 'Synthetic prompt fixture for local journeys.',
  'Use this deterministic prompt only in local testing.', 1, 'per_school')
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title,
  description = EXCLUDED.description, tips = EXCLUDED.tips, sort_order = EXCLUDED.sort_order,
  scope = EXCLUDED.scope;

-- Additional disposable majors exercise the real three-column comparison.
INSERT INTO public.majors (id, name, category, description, career_paths, typical_coursework)
VALUES
 ('e3000000-0000-4000-8000-000000000001', 'E2E Test Computing', 'Engineering', 'Synthetic comparison fixture.', '["Test developer"]'::jsonb, '["Algorithms 101"]'::jsonb),
 ('e3000000-0000-4000-8000-000000000002', 'E2E Test Economics', 'Business', 'Synthetic comparison fixture.', '[]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category,
 description = EXCLUDED.description, career_paths = EXCLUDED.career_paths,
 typical_coursework = EXCLUDED.typical_coursework;

-- PROD-153: a second application target for independent tailoring journeys.
INSERT INTO public.schools (id,name,country,website,institution_type) VALUES (900153,'E2E Library University','Australia','https://library-university.example.test','university') ON CONFLICT (id) DO NOTHING;
