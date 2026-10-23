-- PROD-76: reviewed starter catalogue. Verification dates reflect real source checks.
-- Initial seeds never overwrite later verified updates. Inactive offerings are retained.
BEGIN;
CREATE TABLE public.course_offerings (
 id text PRIMARY KEY CHECK (length(btrim(id)) > 0),
 institution_key text NOT NULL CHECK (length(btrim(institution_key)) > 0),
 institution_name text NOT NULL CHECK (length(btrim(institution_name)) > 0),
 program_code text NOT NULL CHECK (length(btrim(program_code)) > 0),
 name text NOT NULL CHECK (length(btrim(name)) > 0),
 school_id bigint REFERENCES public.schools(id) ON DELETE SET NULL,
 campus text, duration text, prerequisites text, prerequisites_url text,
 assumed_knowledge text, fee_amount numeric, fee_year integer,
 fee_category text, fee_basis text, application_route text, application_url text,
 uac_code text, source_url text NOT NULL CHECK (source_url ~ '^https?://'),
 source_year integer, verified_at timestamptz, active boolean NOT NULL DEFAULT true,
 CHECK (fee_amount IS NULL OR (fee_amount >= 0 AND fee_amount <> 'NaN'::numeric)),
 CHECK (fee_year IS NULL OR fee_year BETWEEN 2000 AND 2100),
 CHECK (source_year IS NULL OR source_year BETWEEN 2000 AND 2100),
 CHECK (application_url IS NULL OR application_url ~ '^https?://'),
 CHECK (prerequisites_url IS NULL OR prerequisites_url ~ '^https?://'),
 CHECK (fee_amount IS NULL OR (fee_year IS NOT NULL AND fee_category IS NOT NULL AND fee_basis IS NOT NULL))
);
CREATE UNIQUE INDEX course_offering_identity ON public.course_offerings (institution_key, program_code, coalesce(campus, ''));
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.course_offerings FROM anon, authenticated;
GRANT SELECT ON public.course_offerings TO anon, authenticated;
GRANT ALL ON public.course_offerings TO service_role;
CREATE POLICY course_catalog_read ON public.course_offerings FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.user_course_bookmarks (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 course_id text NOT NULL REFERENCES public.course_offerings(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, course_id)
);
ALTER TABLE public.user_course_bookmarks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_course_bookmarks FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_course_bookmarks TO authenticated;
GRANT ALL ON public.user_course_bookmarks TO service_role;
CREATE POLICY course_save_read ON public.user_course_bookmarks FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY course_save_insert ON public.user_course_bookmarks FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY course_save_delete ON public.user_course_bookmarks FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
CREATE INDEX user_course_bookmarks_offering ON public.user_course_bookmarks(course_id);

-- Missing school mapping stays NULL. Ambiguous names fail rather than linking the wrong school.
INSERT INTO public.course_offerings (id, institution_key, institution_name, program_code, name, school_id, campus, duration, prerequisites, prerequisites_url, assumed_knowledge, fee_amount, fee_year, fee_category, fee_basis, application_route, application_url, uac_code, source_url, source_year, verified_at, active)
VALUES ('unsw-3778-kensington', 'unsw', 'UNSW Sydney', '3778', 'Bachelor of Science (Computer Science)', (SELECT id FROM public.schools WHERE name = 'University of New South Wales' AND country = 'Australia'), 'Kensington', '3 years full-time; duration can vary by intake before the 2028 calendar change.', NULL, NULL, 'Mathematics Extension 1', 8500, 2026, 'Domestic Commonwealth Supported Place', 'Indicative first-year contribution for 48 credit points; tuition only. Additional costs excluded.', 'Domestic applicants apply through UAC. Check current dates and applicant-specific instructions with the provider.', NULL, '425800', 'https://www.unsw.edu.au/study/undergraduate/bachelor-of-computer-science', 2026, '2026-10-23T00:00:00Z', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.course_offerings (id, institution_key, institution_name, program_code, name, school_id, campus, duration, prerequisites, prerequisites_url, assumed_knowledge, fee_amount, fee_year, fee_category, fee_basis, application_route, application_url, uac_code, source_url, source_year, verified_at, active)
VALUES ('unsw-3502-kensington', 'unsw', 'UNSW Sydney', '3502', 'Bachelor of Commerce', (SELECT id FROM public.schools WHERE name = 'University of New South Wales' AND country = 'Australia'), 'Kensington', '3 years full-time; duration can vary by intake before the 2028 calendar change.', NULL, NULL, 'Mathematics Advanced', 17500, 2026, 'Domestic Commonwealth Supported Place', 'Indicative first-year contribution for 48 credit points; tuition only. Additional costs excluded.', 'Domestic applicants apply through UAC. Check current dates and applicant-specific instructions with the provider.', NULL, '424000', 'https://www.unsw.edu.au/study/undergraduate/bachelor-of-commerce', 2026, '2026-10-23T00:00:00Z', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.course_offerings (id, institution_key, institution_name, program_code, name, school_id, campus, duration, prerequisites, prerequisites_url, assumed_knowledge, fee_amount, fee_year, fee_category, fee_basis, application_route, application_url, uac_code, source_url, source_year, verified_at, active)
VALUES ('unsw-3789-kensington', 'unsw', 'UNSW Sydney', '3789', 'Bachelor of Science / Science (Computer Science)', (SELECT id FROM public.schools WHERE name = 'University of New South Wales' AND country = 'Australia'), 'Kensington', '4 years full-time; duration can vary by intake before the 2028 calendar change.', NULL, NULL, 'Mathematics Extension 1', 8000, 2026, 'Domestic Commonwealth Supported Place', 'Indicative first-year contribution for 48 credit points; tuition only. Additional costs excluded.', 'Domestic applicants apply through UAC. Check current dates and applicant-specific instructions with the provider.', NULL, '425800', 'https://www.unsw.edu.au/study/undergraduate/bachelor-of-science-computer-science', 2026, '2026-10-23T00:00:00Z', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.course_offerings (id, institution_key, institution_name, program_code, name, school_id, campus, duration, prerequisites, prerequisites_url, assumed_knowledge, fee_amount, fee_year, fee_category, fee_basis, application_route, application_url, uac_code, source_url, source_year, verified_at, active)
VALUES ('sydney-bpadvcmp1000-camperdown', 'sydney', 'University of Sydney', 'BPADVCMP1000', 'Bachelor of Advanced Computing', (SELECT id FROM public.schools WHERE name = 'University of Sydney' AND country = 'Australia'), 'Camperdown/Darlington', '4 years full-time', 'A mathematics prerequisite applies. Check the provider’s qualification-specific rule and applicability.', 'https://www.sydney.edu.au/content/corporate/study/applying/how-to-apply/undergraduate/mathematics-prerequisite.html', 'Mathematics Extension 1', 9552, 2027, 'Domestic Commonwealth Supported Place', 'Indicative first-year contribution for 48 credit points; tuition only. Additional costs excluded.', 'Domestic applicants apply through UAC. Check current dates and applicant-specific instructions with the provider.', NULL, '513500', 'https://www.sydney.edu.au/content/courses/courses/uc/bachelor-of-advanced-computing.html', 2027, '2026-10-23T00:00:00Z', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.course_offerings (id, institution_key, institution_name, program_code, name, school_id, campus, duration, prerequisites, prerequisites_url, assumed_knowledge, fee_amount, fee_year, fee_category, fee_basis, application_route, application_url, uac_code, source_url, source_year, verified_at, active)
VALUES ('anu-aacom', 'anu', 'Australian National University', 'AACOM', 'Bachelor of Advanced Computing (Honours)', (SELECT id FROM public.schools WHERE name = 'Australian National University' AND country = 'Australia'), NULL, '4 years full-time', 'Mathematics prerequisite varies by qualification. For NSW applicants: Mathematics Advanced or equivalent. Check the complete provider list.', 'https://programsandcourses.anu.edu.au/2027/program/aacom#admission-and-fees', NULL, NULL, 2027, 'Domestic Commonwealth Supported Place', NULL, 'Use ANU’s applicant selector for the relevant UAC or direct application process.', 'https://programsandcourses.anu.edu.au/2027/program/apply/AACOM', '135705', 'https://programsandcourses.anu.edu.au/2027/program/aacom', 2027, '2026-10-23T00:00:00Z', true) ON CONFLICT (id) DO NOTHING;
COMMIT;
