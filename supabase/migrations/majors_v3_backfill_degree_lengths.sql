-- Backfill degree_lengths for majors that already existed in the database
-- Safe to run multiple times: only updates rows where degree_lengths is NULL

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"Most competitive programs are 4 years; graduate school (MS/PhD) required for research roles"},"UK":{"degree":"Bachelor''s","years":3,"notes":"MEng option available as integrated 4-year degree"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Bachelor''s (3 yrs) often insufficient alone; Master''s expected for industry"},"Singapore":{"degree":"Bachelor''s","years":4},"Netherlands":{"degree":"Bachelor''s","years":3}}}'::jsonb
WHERE name = 'Computer Science' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s / MEng","years":"3–4","notes":"BEng (3 yrs) or integrated MEng (4 yrs); MEng preferred for chartered status"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Electrical Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Mechanical Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4","notes":"Chartered Engineer status requires MEng or further study"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Civil Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Chemical Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"NASA and defence contractors typically expect a Master''s for research roles"},"UK":{"degree":"MEng","years":4,"notes":"Most UK programs are integrated 4-year MEng"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Aerospace Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"Graduate degree (MS/PhD) usually required for R&D roles"},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Biomedical Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3,"notes":"Offered as distinct 3-yr BSc or 4-yr MEng at many universities"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Software Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"Many roles prefer a Master''s; strong MS Data Science market"},"UK":{"degree":"Bachelor''s","years":3,"notes":"MSc Data Science increasingly expected for senior roles"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Data Science & Analytics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"AI research typically requires a PhD; industry roles increasingly accept MS"},"UK":{"degree":"Bachelor''s / MEng","years":"3–4"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Master''s","years":2,"notes":"Often entered after a Computer Science Bachelor''s (3+2 total)"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Artificial Intelligence' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"Government roles (NSA, CIA) often require Master''s and clearance"},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Cybersecurity' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Environmental Engineering' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"MBA (2 yrs) is the key post-graduate credential for senior leadership"},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Master''s in Business Administration or Management standard"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Business Administration' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"CFA charter and/or MBA often expected for senior finance roles"},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Finance' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Marketing' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"CPA requires 150 credit hours — typically a 5th year or Master''s"},"UK":{"degree":"Bachelor''s","years":3,"notes":"ACCA/ICAEW chartered exams follow graduation"},"Canada":{"degree":"Bachelor''s","years":4,"notes":"CPA designation requires additional professional exams"},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Steuerberater (tax advisor) requires further state exams"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Accounting' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s","years":3,"notes":"Strong startup ecosystem in Berlin; Master''s optional"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Entrepreneurship' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3,"notes":"Many programs include a year abroad"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'International Business' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Logistics is a strong industry in Germany; Master''s valued"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Supply Chain & Logistics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Human Resource Management' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"MD (after Bachelor''s)","years":"4+4","notes":"4-year undergraduate degree required first; then 4-year MD; followed by 3–7 years residency"},"UK":{"degree":"MBBS / MBChB","years":"5–6","notes":"Direct entry from school; 5 years standard, 6 with intercalated BSc; Foundation Programme after"},"Canada":{"degree":"MD","years":"3–4 (post-Bachelor''s)","notes":"3 or 4-year MD after an undergraduate degree; highly competitive"},"Australia":{"degree":"MBBS or MD","years":"5–6 (direct) or 4 (graduate)","notes":"Undergraduate 5-6 year MBBS or graduate-entry 4-year MD"},"Germany":{"degree":"Staatsexamen","years":6,"notes":"Integrated 6-year degree; no separate undergraduate required; leads directly to licensure"},"Singapore":{"degree":"MBBS","years":5,"notes":"5-year program at NUS or NTU; highly competitive entry"}}}'::jsonb
WHERE name = 'Medicine' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s (BSN)","years":4,"notes":"Associate degree (2 yrs) also accepted but BSN increasingly required; NP requires Master''s"},"UK":{"degree":"Bachelor''s","years":3,"notes":"Direct entry 3-year degree; Nurse Practitioner requires further postgraduate study"},"Canada":{"degree":"Bachelor''s (BScN)","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Vocational + Bachelor''s","years":"3 vocational or 3 academic","notes":"Nursing reforms mean academic degree paths now available alongside traditional vocational route"},"Singapore":{"degree":"Bachelor''s","years":3}}}'::jsonb
WHERE name = 'Nursing' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"PharmD","years":"4 (post-Bachelor''s or integrated 6-yr)","notes":"Doctor of Pharmacy is the entry-level professional degree; licensure exam (NAPLEX) required"},"UK":{"degree":"MPharm","years":4,"notes":"4-year integrated Master''s is the entry-level degree; 1-year pre-registration training follows"},"Canada":{"degree":"Bachelor''s or PharmD","years":"4+1 PharmD","notes":"PharmD increasingly the standard; province-specific licensure"},"Australia":{"degree":"Bachelor''s","years":4,"notes":"4-year degree + 1-year intern year required for registration"},"Germany":{"degree":"Staatsexamen","years":4,"notes":"4-year state examination program; 1-year practical training then state licence"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Pharmacy' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"DDS / DMD","years":"4+4","notes":"4-year undergraduate degree then 4-year dental school; speciality requires further 2–6 years"},"UK":{"degree":"BDS","years":5,"notes":"5-year integrated Bachelor''s; FY1 dental foundation training follows"},"Canada":{"degree":"DDS / DMD","years":"3–4 (post-Bachelor''s)","notes":"Most programs require prior undergraduate degree"},"Australia":{"degree":"BDSc / DClinDent","years":"5 (direct) or 4 (graduate)","notes":"5-year undergraduate or 4-year graduate entry"},"Germany":{"degree":"Staatsexamen","years":5,"notes":"5-year state examination program"},"Singapore":{"degree":"BDS","years":5}}}'::jsonb
WHERE name = 'Dentistry' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s + MPH","years":"4+2","notes":"Entry-level roles need a Bachelor''s; MPH (2 yrs) expected for professional practice"},"UK":{"degree":"Bachelor''s or MPH","years":"3 or 3+1","notes":"Can enter with a science degree; MPH is the professional qualification"},"Canada":{"degree":"Bachelor''s + MPH","years":"4+2"},"Australia":{"degree":"Bachelor''s + MPH","years":"3+1.5"},"Germany":{"degree":"Master''s (MPH)","years":"3+2","notes":"Entered after any health-related Bachelor''s"},"Singapore":{"degree":"Bachelor''s + MPH","years":"4+1"}}}'::jsonb
WHERE name = 'Public Health' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"DPT (Doctor of Physical Therapy)","years":"4+3","notes":"Bachelor''s (any field) then 3-year DPT required for practice; no Bachelor''s-level entry"},"UK":{"degree":"Bachelor''s","years":3,"notes":"3-year BSc; HCPC registration required; MSc for specialist practice"},"Canada":{"degree":"Bachelor''s + MPT","years":"4+2","notes":"Master''s of Physical Therapy is entry-level requirement in most provinces"},"Australia":{"degree":"Bachelor''s","years":4,"notes":"4-year direct entry BPhysio; AHPRA registration required"},"Germany":{"degree":"Vocational / Bachelor''s","years":3,"notes":"Traditionally vocational; academic Bachelor''s routes now available"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Physiotherapy' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"Graduate degrees (MS/PhD) strongly preferred for research; clinical lab roles require certification"},"UK":{"degree":"Bachelor''s","years":3,"notes":"IBMS registration required for clinical practice; MSc for specialist roles"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Biomedical Science' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s + Internship","years":"4+1","notes":"RD credential requires accredited dietetic internship after degree"},"UK":{"degree":"Bachelor''s","years":4,"notes":"4-year BNutrDiet accredited by BDA required for registration"},"Canada":{"degree":"Bachelor''s + Internship","years":"4+8 months","notes":"PDt credential requires accredited internship"},"Australia":{"degree":"Bachelor''s","years":4,"notes":"DAA accreditation required for APD status"},"Germany":{"degree":"Bachelor''s","years":3,"notes":"Often vocational in origin; academic Bachelor''s routes available"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Nutrition & Dietetics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Anglistik programs common; taught in German with English texts"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'English Literature' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'History' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Philosophy (Philosophie) with strong academic tradition; PhD common for academic careers"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Philosophy' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s + M.Arch","years":"4+2–3","notes":"5-year B.Arch or 4+2 M.Arch pathway; state licensure requires internship (AXP) and ARE exams"},"UK":{"degree":"BA/BSc + MArch","years":"3+2","notes":"Part 1 (3 yrs) + Part 2 (2 yrs) + Part 3 (1 yr practice) for full ARB registration"},"Canada":{"degree":"Bachelor''s + M.Arch","years":"4+2","notes":"M.Arch required for licensure"},"Australia":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"AACA registration requires 2 years supervised experience"},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Architekt title requires state-specific registration after Master''s"},"Singapore":{"degree":"Bachelor''s + Master''s","years":"4+1.5"}}}'::jsonb
WHERE name = 'Architecture' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor of Fine Arts (BFA)","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"BFA","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Diplom / Bachelor''s","years":4,"notes":"Art academies (Kunstakademien) often offer 4-year Diplom programs"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Fine Arts' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor of Music (BM)","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"BMus","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Diplom / Bachelor''s","years":4,"notes":"Conservatories (Musikhochschule) offer 4-year programs; highly selective"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Music' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Linguistics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s + Doctoral","years":"4+4–7","notes":"Doctoral degree (PhD or PsyD) required for licensed clinical psychologist; Master''s for some counselling roles"},"UK":{"degree":"Bachelor''s + Postgraduate","years":"3+1–3","notes":"BPS-accredited BSc + postgraduate diploma or DClinPsy required for clinical practice"},"Canada":{"degree":"Bachelor''s + Master''s or PhD","years":"4+2–5","notes":"Provincial licensure requires master''s or doctorate depending on scope"},"Australia":{"degree":"Bachelor''s + 4th year + 2-yr Masters","years":"3+1+2","notes":"6 years minimum for Psychology Board registration"},"Germany":{"degree":"Master''s + Approbation","years":"3+2+postgrad","notes":"Psychotherapist licence (Approbation) requires further supervised training"},"Singapore":{"degree":"Bachelor''s + Master''s","years":"4+2"}}}'::jsonb
WHERE name = 'Psychology' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Sociology' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Political Science' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'International Relations' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"PhD required for academic economics; MBA or Master''s for policy/finance"},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Economics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"JD (after Bachelor''s)","years":"4+3","notes":"Any Bachelor''s first; then 3-year Juris Doctor; bar exam required for practice"},"UK":{"degree":"LLB","years":3,"notes":"3-year LLB; then 1-year LPC (solicitors) or BTC (barristers) for qualification"},"Canada":{"degree":"JD / LLB","years":"3–4 (post-Bachelor''s)","notes":"Most Canadian law schools require a prior undergraduate degree"},"Australia":{"degree":"LLB or JD","years":"4–5 (direct) or 3 (graduate)","notes":"Can be combined with another degree; JD is 3-year graduate entry"},"Germany":{"degree":"Staatsexamen","years":"4.5–5","notes":"First state exam after 4.5 yrs study; 2-yr referendariat; second state exam for admission to bar"},"Singapore":{"degree":"LLB","years":4,"notes":"4-year program at NUS or SMU; further practical training required"}}}'::jsonb
WHERE name = 'Law' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"PhD required for academic or research careers"},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Anthropology' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"PhD strongly expected for research careers"},"UK":{"degree":"Bachelor''s","years":3,"notes":"MBiol (4 yrs) integrates a research project year"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Biology' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"PhD expected for research; industry may accept Master''s"},"UK":{"degree":"MChem","years":4,"notes":"Integrated 4-year MChem preferred for research; BSc (3 yrs) also available"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Chemistry' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"PhD almost universal for research; Master''s route to industry"},"UK":{"degree":"MPhys","years":4,"notes":"Integrated 4-year MPhys preferred; 3-year BSc also available"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Physics has very strong academic tradition in Germany"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Physics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"MMath","years":4,"notes":"Integrated 4-year MMath preferred; 3-year BSc also available"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2","notes":"Mathematics with strong academic tradition; PhD common"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Mathematics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Environmental Science' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"MS Statistics highly valued in industry; PhD for academia"},"UK":{"degree":"Bachelor''s","years":3},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":3},"Germany":{"degree":"Bachelor''s + Master''s","years":"3+2"},"Singapore":{"degree":"Bachelor''s","years":4}}}'::jsonb
WHERE name = 'Statistics' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"State teaching licence required; requirements vary widely by state"},"UK":{"degree":"Bachelor''s","years":3,"notes":"QTS (Qualified Teacher Status) obtained through BEd or PGCE"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4,"notes":"ACECQA accreditation required for centre-based settings"},"Germany":{"degree":"Vocational / Bachelor''s","years":"3–4","notes":"Erzieher vocational route (3 yrs) or academic Bachelor''s available; Master''s for leadership"},"Singapore":{"degree":"Diploma / Bachelor''s","years":"2–4","notes":"NIE trains teachers; MOE sets entry requirements"}}}'::jsonb
WHERE name = 'Early Childhood Education' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"State certification required; subject master''s often needed for high school in some states"},"UK":{"degree":"Bachelor''s + PGCE","years":"3+1","notes":"BEd (3-4 yrs) or undergraduate + PGCE (1 yr) for QTS"},"Canada":{"degree":"Bachelor''s + BEd","years":"4+1–2","notes":"Two-degree pathway standard in most provinces"},"Australia":{"degree":"Bachelor''s","years":4,"notes":"4-year concurrent degree or 3+2 pathway; AITSL accreditation required"},"Germany":{"degree":"Master''s (Lehramt)","years":"3+2","notes":"Bachelor''s + Master''s in Education (Lehramt) required; 18-month Referendariat before state exam"},"Singapore":{"degree":"Bachelor''s","years":4,"notes":"NIE is the sole teacher education institution; NIE Diploma or degree required"}}}'::jsonb
WHERE name = 'Secondary Education' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Bachelor''s","years":4,"notes":"State licensure required; IDEA compliance mandated; Master''s for specialist roles"},"UK":{"degree":"Bachelor''s + PGCE or NASENCO","years":"3+1","notes":"SENCO role requires NASENCO qualification post-QTS"},"Canada":{"degree":"Bachelor''s","years":4},"Australia":{"degree":"Bachelor''s","years":4},"Germany":{"degree":"Master''s (Sonderpädagogik)","years":"3+2","notes":"Sonderpädagogik requires full Lehramt Master''s (5 yrs); Referendariat follows"},"Singapore":{"degree":"Bachelor''s + Diploma","years":"4+1"}}}'::jsonb
WHERE name = 'Special Education' AND degree_lengths IS NULL;

UPDATE public.majors
SET degree_lengths = '{"countries":{"USA":{"degree":"Master''s (MEd / EdS)","years":"4+2","notes":"Principal licence requires Master''s + state exam; EdD/PhD for district leadership"},"UK":{"degree":"Master''s (MBA / MEd)","years":"3+1","notes":"NPQH (National Professional Qualification for Headship) often required for headteacher roles"},"Canada":{"degree":"Master''s","years":"4+2"},"Australia":{"degree":"Master''s","years":"4+1.5"},"Germany":{"degree":"Master''s + Referendariat","years":"3+2+1.5","notes":"School leadership requires further administrative training after Lehramt"},"Singapore":{"degree":"Master''s","years":"4+1","notes":"Typically entered through NIE or MOE leadership programmes"}}}'::jsonb
WHERE name = 'Educational Leadership' AND degree_lengths IS NULL;
