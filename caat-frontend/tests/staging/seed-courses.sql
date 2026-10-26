-- Disposable local stacks only (applied by bootstrap-local.mjs after the
-- PROD-76 course migration). Not a migration and never applied to production.
-- PROD-148 journeys need an offering linked to the synthetic university 900001;
-- none of the five real seeded offerings map to a school in a test stack.
INSERT INTO public.course_offerings (id, institution_key, institution_name, program_code, name, school_id, campus,
  duration, application_route, application_url, source_url, source_year, verified_at, active)
VALUES ('e2e-test-course-900001', 'e2e-test', 'E2E Test University', 'E2E900001', 'E2E Test Bachelor of Computing', 900001, 'E2E Campus',
  '3 years full-time', 'E2E route: apply through the synthetic admissions centre.', 'https://university.example.test/apply',
  'https://university.example.test/courses/computing', 2026, now() - interval '10 days', true)
ON CONFLICT (id) DO UPDATE SET institution_key = EXCLUDED.institution_key, institution_name = EXCLUDED.institution_name,
  program_code = EXCLUDED.program_code, name = EXCLUDED.name, school_id = EXCLUDED.school_id, campus = EXCLUDED.campus,
  duration = EXCLUDED.duration, application_route = EXCLUDED.application_route, application_url = EXCLUDED.application_url,
  source_url = EXCLUDED.source_url, source_year = EXCLUDED.source_year, verified_at = EXCLUDED.verified_at, active = EXCLUDED.active;

-- PROD-175 isolated preparation journey owns a separate application fixture.
INSERT INTO public.schools(id,name,country,institution_type) VALUES(900175,'E2E Preparation University','Australia','university') ON CONFLICT(id) DO NOTHING;
INSERT INTO public.course_offerings(id,institution_key,institution_name,program_code,name,school_id,prerequisites,assumed_knowledge,application_route,source_url,source_year,verified_at)
VALUES('e2e-preparation-course','e2e-preparation','E2E Preparation University','E2E175','E2E Preparation Course',900175,'Mathematics preparation recorded for this synthetic course.','Programming familiarity','Apply through the synthetic provider','https://university.example.test/preparation',2026,'2026-10-01T00:00:00Z') ON CONFLICT(id) DO NOTHING;
