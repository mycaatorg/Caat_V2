-- Populate qs_ranking_url for all majors
-- Source: QS World University Rankings by Subject 2025 (topuniversities.com)
-- Run in Supabase SQL Editor

-- ─── Engineering ─────────────────────────────────────────────────────────────

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/computer-science-information-systems'
WHERE name = 'Computer Science';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/mechanical-aeronautical-manufacturing-engineering'
WHERE name = 'Mechanical Engineering';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/electrical-electronic-engineering'
WHERE name = 'Electrical Engineering';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/civil-structural-engineering'
WHERE name = 'Civil Engineering';

-- No dedicated Biomedical Engineering subject in QS; Anatomy & Physiology is the closest life-sciences match
UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/anatomy-physiology'
WHERE name = 'Biomedical Engineering';

-- ─── Business ────────────────────────────────────────────────────────────────

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/business-management-studies'
WHERE name = 'Business Administration';

-- QS combines Finance under Accounting & Finance
UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/accounting-finance'
WHERE name = 'Finance';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/marketing'
WHERE name = 'Marketing';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/accounting-finance'
WHERE name = 'Accounting';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/economics-econometrics'
WHERE name = 'Economics';

-- ─── Health Sciences ─────────────────────────────────────────────────────────

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/nursing'
WHERE name = 'Nursing';

-- No dedicated Public Health subject in QS; Medicine is the closest match
UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/medicine'
WHERE name = 'Public Health';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/medicine'
WHERE name = 'Pre-Medicine / Biology';

-- Kinesiology maps to QS Sports-Related Subjects (exercise physiology, sport science)
UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/sports-related-subjects'
WHERE name = 'Kinesiology';

-- ─── Arts & Humanities ───────────────────────────────────────────────────────

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/english-language-literature'
WHERE name = 'English Literature';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/history'
WHERE name = 'History';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/art-design'
WHERE name = 'Fine Arts';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/philosophy'
WHERE name = 'Philosophy';

-- ─── Social Sciences ─────────────────────────────────────────────────────────

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/psychology'
WHERE name = 'Psychology';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/politics'
WHERE name = 'Political Science';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/sociology'
WHERE name = 'Sociology';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/communication-media-studies'
WHERE name = 'Communications';

-- ─── Natural Sciences ────────────────────────────────────────────────────────

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/biological-sciences'
WHERE name = 'Biology';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/chemistry'
WHERE name = 'Chemistry';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/environmental-sciences'
WHERE name = 'Environmental Science';

-- ─── Education ───────────────────────────────────────────────────────────────

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/education-training'
WHERE name = 'Elementary Education';

UPDATE public.majors
SET qs_ranking_url = 'https://www.topuniversities.com/university-subject-rankings/education-training'
WHERE name = 'Special Education';
