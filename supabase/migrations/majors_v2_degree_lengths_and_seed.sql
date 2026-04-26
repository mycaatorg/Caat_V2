-- Add degree_lengths JSONB column to majors table
ALTER TABLE public.majors ADD COLUMN IF NOT EXISTS degree_lengths JSONB;

-- ============================================================
-- SEED: Engineering
-- ============================================================

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Computer Science', 'Engineering',
  'The study of computation, algorithms, data structures, programming languages, and the theory behind software and hardware systems.',
  ARRAY['Software Engineer','Data Scientist','Machine Learning Engineer','DevOps Engineer','Systems Architect','Product Manager','CTO'],
  ARRAY['Data Structures & Algorithms','Operating Systems','Computer Networks','Database Systems','Software Engineering','Theory of Computation','Artificial Intelligence','Computer Architecture'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/computer-science-information-systems',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"Most competitive programs are 4 years; graduate school (MS/PhD) required for research roles"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"MEng option available as integrated 4-year degree"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Bachelor'\''s (3 yrs) often insufficient alone; Master'\''s expected for industry"},"Singapore":{"degree":"Bachelor'\''s","years":4},"Netherlands":{"degree":"Bachelor'\''s","years":3}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Computer Science');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Electrical Engineering', 'Engineering',
  'Focuses on the study and application of electricity, electronics, and electromagnetism, spanning power systems, signal processing, and embedded systems.',
  ARRAY['Electrical Engineer','Power Systems Engineer','Embedded Systems Developer','RF Engineer','Control Systems Engineer','Hardware Engineer'],
  ARRAY['Circuit Analysis','Electromagnetics','Signal Processing','Digital Electronics','Control Systems','Power Systems','Microprocessors','VLSI Design'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/engineering-electrical-electronic',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s / MEng","years":"3–4","notes":"BEng (3 yrs) or integrated MEng (4 yrs); MEng preferred for chartered status"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Electrical Engineering');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Mechanical Engineering', 'Engineering',
  'Covers the design, analysis, and manufacture of mechanical systems, from engines and robotics to HVAC and aerospace components.',
  ARRAY['Mechanical Engineer','Automotive Engineer','Aerospace Engineer','Manufacturing Engineer','Robotics Engineer','Product Designer','HVAC Engineer'],
  ARRAY['Thermodynamics','Fluid Mechanics','Solid Mechanics','Machine Design','Manufacturing Processes','Control Systems','Engineering Mathematics','CAD/CAM'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/engineering-mechanical-aeronautical-manufacturing',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Mechanical Engineering');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Civil Engineering', 'Engineering',
  'The design and construction of infrastructure such as roads, bridges, dams, buildings, and water systems.',
  ARRAY['Civil Engineer','Structural Engineer','Geotechnical Engineer','Urban Planner','Construction Manager','Transportation Engineer'],
  ARRAY['Structural Analysis','Geotechnical Engineering','Hydraulics','Transportation Engineering','Construction Management','Surveying','Concrete & Steel Design','Environmental Engineering'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/engineering-civil-structural',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4","notes":"Chartered Engineer status requires MEng or further study"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Civil Engineering');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Chemical Engineering', 'Engineering',
  'Applies chemistry, physics, and mathematics to the design and operation of industrial chemical processes, from pharmaceuticals to petrochemicals.',
  ARRAY['Chemical Engineer','Process Engineer','Petroleum Engineer','Materials Scientist','Environmental Engineer','Pharmaceutical Engineer'],
  ARRAY['Chemical Thermodynamics','Reaction Kinetics','Mass Transfer','Heat Transfer','Process Design','Fluid Mechanics','Chemical Plant Safety','Biochemical Engineering'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Chemical Engineering');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Aerospace Engineering', 'Engineering',
  'Focuses on the design and development of aircraft, spacecraft, satellites, and related systems, encompassing aerodynamics, propulsion, and structures.',
  ARRAY['Aerospace Engineer','Aerodynamics Engineer','Propulsion Engineer','Flight Test Engineer','Satellite Engineer','Defence Analyst'],
  ARRAY['Aerodynamics','Propulsion Systems','Flight Mechanics','Orbital Mechanics','Structural Analysis','Avionics','Computational Fluid Dynamics','Space Mission Design'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"NASA and defence contractors typically expect a Master'\''s for research roles"},"UK":{"degree":"MEng","years":4,"notes":"Most UK programs are integrated 4-year MEng"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Aerospace Engineering');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Biomedical Engineering', 'Engineering',
  'Bridges engineering principles with medical and biological sciences to develop medical devices, imaging systems, prosthetics, and healthcare technologies.',
  ARRAY['Biomedical Engineer','Medical Device Developer','Clinical Engineer','Bioinformatics Specialist','Tissue Engineer','Regulatory Affairs Specialist'],
  ARRAY['Biomechanics','Bioinstrumentation','Medical Imaging','Biomaterials','Physiological Modelling','Signal Processing','Tissue Engineering','Regulatory Affairs'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"Graduate degree (MS/PhD) usually required for R&D roles"},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Biomedical Engineering');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Software Engineering', 'Engineering',
  'Applies engineering principles to the design, development, testing, and maintenance of large-scale software systems.',
  ARRAY['Software Engineer','Backend Developer','Frontend Developer','Full Stack Engineer','QA Engineer','Site Reliability Engineer','Technical Lead'],
  ARRAY['Software Design Patterns','Agile & Scrum','Software Testing','Database Engineering','Cloud Computing','Software Architecture','Compiler Design','Distributed Systems'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"Offered as distinct 3-yr BSc or 4-yr MEng at many universities"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Software Engineering');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Data Science & Analytics', 'Engineering',
  'Combines statistics, programming, and domain expertise to extract insights from large datasets using machine learning, visualisation, and predictive modelling.',
  ARRAY['Data Scientist','Data Analyst','ML Engineer','Business Intelligence Analyst','Quantitative Analyst','AI Researcher'],
  ARRAY['Statistics & Probability','Machine Learning','Data Wrangling','Database Systems','Data Visualisation','Big Data Technologies','Deep Learning','Experimental Design'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"Many roles prefer a Master'\''s; strong MS Data Science market"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"MSc Data Science increasingly expected for senior roles"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Data Science & Analytics');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Artificial Intelligence', 'Engineering',
  'Explores the theory and development of intelligent systems capable of performing tasks that typically require human cognition, including natural language processing, computer vision, and reinforcement learning.',
  ARRAY['AI Engineer','NLP Engineer','Computer Vision Engineer','Robotics Engineer','AI Product Manager','Research Scientist'],
  ARRAY['Machine Learning','Deep Learning','Natural Language Processing','Computer Vision','Reinforcement Learning','Knowledge Representation','Ethics in AI','Probabilistic Reasoning'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"AI research typically requires a PhD; industry roles increasingly accept MS"},"UK":{"degree":"Bachelor'\''s / MEng","years":"3–4"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Master'\''s","years":2,"notes":"Often entered after a Computer Science Bachelor'\''s (3+2 total)"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Artificial Intelligence');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Cybersecurity', 'Engineering',
  'Focuses on protecting digital systems, networks, and data from cyber threats through cryptography, ethical hacking, security analysis, and risk management.',
  ARRAY['Security Analyst','Penetration Tester','Security Engineer','CISO','Forensic Analyst','Threat Intelligence Analyst','Cryptographer'],
  ARRAY['Network Security','Cryptography','Ethical Hacking','Digital Forensics','Risk Management','Malware Analysis','Security Architecture','Incident Response'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"Government roles (NSA, CIA) often require Master'\''s and clearance"},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Cybersecurity');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Environmental Engineering', 'Engineering',
  'Applies engineering principles to protect and improve the environment through solutions in water treatment, air quality, waste management, and sustainable infrastructure.',
  ARRAY['Environmental Engineer','Water Resources Engineer','Sustainability Consultant','Environmental Consultant','Waste Management Engineer','Climate Analyst'],
  ARRAY['Environmental Chemistry','Water & Wastewater Treatment','Air Pollution Control','Solid Waste Management','Environmental Impact Assessment','Sustainable Design','GIS & Remote Sensing','Hydrology'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"BEng / MEng","years":"3–4"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Environmental Engineering');

-- ============================================================
-- SEED: Business
-- ============================================================

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Business Administration', 'Business',
  'A broad degree covering management, finance, marketing, operations, and strategy — preparing graduates to lead organisations across all sectors.',
  ARRAY['Business Analyst','Management Consultant','Operations Manager','General Manager','Entrepreneur','Brand Manager','Project Manager'],
  ARRAY['Principles of Management','Organisational Behaviour','Marketing','Financial Accounting','Operations Management','Business Strategy','Business Ethics','Corporate Finance'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/business-management-studies',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"MBA (2 yrs) is the key post-graduate credential for senior leadership"},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Master'\''s in Business Administration or Management standard"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Business Administration');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Finance', 'Business',
  'Studies financial markets, investment analysis, corporate finance, risk management, and the principles underpinning capital allocation.',
  ARRAY['Investment Banker','Financial Analyst','Portfolio Manager','Risk Manager','CFO','Hedge Fund Analyst','Financial Planner'],
  ARRAY['Corporate Finance','Investment Analysis','Financial Modelling','Derivatives','Portfolio Management','Risk Management','Financial Markets','Behavioural Finance'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"CFA charter and/or MBA often expected for senior finance roles"},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Finance');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Marketing', 'Business',
  'Examines consumer behaviour, brand strategy, digital marketing, market research, and how organisations create and communicate value.',
  ARRAY['Marketing Manager','Brand Strategist','Digital Marketer','Market Research Analyst','Advertising Manager','CMO','Content Strategist'],
  ARRAY['Consumer Behaviour','Brand Management','Digital Marketing','Marketing Analytics','Advertising & PR','Market Research','Product Strategy','Social Media Marketing'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Marketing');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Accounting', 'Business',
  'Covers financial reporting, auditing, taxation, and management accounting — the language of business decision-making.',
  ARRAY['Accountant','Auditor','Tax Consultant','CFO','Forensic Accountant','Financial Controller','Management Accountant'],
  ARRAY['Financial Accounting','Management Accounting','Auditing','Taxation','Cost Accounting','Corporate Reporting','Accounting Information Systems','Business Law'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"CPA requires 150 credit hours — typically a 5th year or Master'\''s"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"ACCA/ICAEW chartered exams follow graduation"},"Canada":{"degree":"Bachelor'\''s","years":4,"notes":"CPA designation requires additional professional exams"},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Steuerberater (tax advisor) requires further state exams"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Accounting');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Entrepreneurship', 'Business',
  'Develops skills for identifying opportunities, building ventures, raising capital, and leading new organisations from inception to scale.',
  ARRAY['Entrepreneur','Startup Founder','Venture Capitalist','Innovation Manager','Business Development Manager','Corporate Intrapreneur'],
  ARRAY['Entrepreneurial Finance','Business Model Design','Venture Creation','Marketing for Startups','Innovation Management','Negotiation','Lean Startup Methodology','Growth Strategy'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s","years":3,"notes":"Strong startup ecosystem in Berlin; Master'\''s optional"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Entrepreneurship');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'International Business', 'Business',
  'Examines global trade, cross-cultural management, international finance, and the strategies multinational corporations use to compete worldwide.',
  ARRAY['International Business Manager','Trade Analyst','Global Supply Chain Manager','Diplomat','International Marketing Manager','Export Manager'],
  ARRAY['International Trade','Global Strategy','Cross-Cultural Management','International Finance','Export & Import Regulations','Foreign Market Entry','Global HRM','Political Risk Analysis'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"Many programs include a year abroad"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'International Business');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Supply Chain & Logistics', 'Business',
  'Covers the planning, sourcing, manufacturing, and delivery of goods and services across global supply networks.',
  ARRAY['Supply Chain Manager','Logistics Coordinator','Procurement Manager','Operations Analyst','Warehouse Manager','Distribution Manager'],
  ARRAY['Supply Chain Management','Inventory Optimisation','Procurement & Sourcing','Logistics & Distribution','Operations Research','ERP Systems','Global Trade Compliance','Demand Forecasting'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Logistics is a strong industry in Germany; Master'\''s valued"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Supply Chain & Logistics');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Human Resource Management', 'Business',
  'Focuses on the recruitment, development, motivation, and management of people within organisations.',
  ARRAY['HR Manager','Talent Acquisition Specialist','Organisational Development Consultant','HR Business Partner','Compensation & Benefits Manager','Chief People Officer'],
  ARRAY['Organisational Behaviour','Talent Management','Employment Law','Performance Management','Compensation & Benefits','Training & Development','HR Analytics','Diversity & Inclusion'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Human Resource Management');

-- ============================================================
-- SEED: Health Sciences
-- ============================================================

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Medicine', 'Health Sciences',
  'Prepares students to diagnose and treat illness, combining scientific knowledge with clinical training across all major body systems.',
  ARRAY['General Practitioner','Surgeon','Specialist Physician','Psychiatrist','Emergency Medicine Doctor','Medical Researcher','Public Health Officer'],
  ARRAY['Anatomy','Physiology','Biochemistry','Pharmacology','Pathology','Clinical Medicine','Surgery','Psychiatry','General Practice'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/medicine',
  '{"countries":{"USA":{"degree":"MD (after Bachelor'\''s)","years":"4+4","notes":"4-year undergraduate degree required first; then 4-year MD; followed by 3–7 years residency"},"UK":{"degree":"MBBS / MBChB","years":"5–6","notes":"Direct entry from school; 5 years standard, 6 with intercalated BSc; Foundation Programme after"},"Canada":{"degree":"MD","years":"3–4 (post-Bachelor'\''s)","notes":"3 or 4-year MD after an undergraduate degree; highly competitive"},"Australia":{"degree":"MBBS or MD","years":"5–6 (direct) or 4 (graduate)","notes":"Undergraduate 5-6 year MBBS or graduate-entry 4-year MD"},"Germany":{"degree":"Staatsexamen","years":6,"notes":"Integrated 6-year degree; no separate undergraduate required; leads directly to licensure"},"Singapore":{"degree":"MBBS","years":5,"notes":"5-year program at NUS or NTU; highly competitive entry"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Medicine');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Nursing', 'Health Sciences',
  'Trains students in patient care, health assessment, pharmacology, and clinical skills to deliver holistic nursing practice across care settings.',
  ARRAY['Registered Nurse','Nurse Practitioner','Clinical Nurse Specialist','Midwife','Community Health Nurse','Nursing Manager','Nurse Educator'],
  ARRAY['Anatomy & Physiology','Nursing Theory & Practice','Pharmacology','Mental Health Nursing','Paediatric Nursing','Adult Nursing','Midwifery','Community Health'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s (BSN)","years":4,"notes":"Associate degree (2 yrs) also accepted but BSN increasingly required; NP requires Master'\''s"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"Direct entry 3-year degree; Nurse Practitioner requires further postgraduate study"},"Canada":{"degree":"Bachelor'\''s (BScN)","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Vocational + Bachelor'\''s","years":"3 vocational or 3 academic","notes":"Nursing reforms mean academic degree paths now available alongside traditional vocational route"},"Singapore":{"degree":"Bachelor'\''s","years":3}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Nursing');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Pharmacy', 'Health Sciences',
  'Covers drug development, pharmacokinetics, clinical pharmacy, and the safe dispensing of medications in hospital and community settings.',
  ARRAY['Pharmacist','Clinical Pharmacist','Pharmaceutical Scientist','Drug Regulatory Specialist','Hospital Pharmacist','Pharmacy Manager'],
  ARRAY['Pharmacology','Pharmaceutics','Pharmacokinetics','Medicinal Chemistry','Clinical Pharmacy','Drug Development','Therapeutics','Pharmacy Law & Ethics'],
  null,
  '{"countries":{"USA":{"degree":"PharmD","years":"4 (post-Bachelor'\''s or integrated 6-yr)","notes":"Doctor of Pharmacy is the entry-level professional degree; licensure exam (NAPLEX) required"},"UK":{"degree":"MPharm","years":4,"notes":"4-year integrated Master'\''s is the entry-level degree; 1-year pre-registration training follows"},"Canada":{"degree":"Bachelor'\''s or PharmD","years":"4+1 PharmD","notes":"PharmD increasingly the standard; province-specific licensure"},"Australia":{"degree":"Bachelor'\''s","years":4,"notes":"4-year degree + 1-year intern year required for registration"},"Germany":{"degree":"Staatsexamen","years":4,"notes":"4-year state examination program; 1-year practical training then state licence"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Pharmacy');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Dentistry', 'Health Sciences',
  'Trains students to diagnose and treat diseases of the oral cavity and associated structures, combining biomedical sciences with clinical practice.',
  ARRAY['General Dentist','Orthodontist','Oral Surgeon','Periodontist','Endodontist','Paediatric Dentist','Dental Researcher'],
  ARRAY['Oral Anatomy','Dental Materials','Endodontics','Periodontics','Orthodontics','Paediatric Dentistry','Oral Surgery','Dental Public Health'],
  null,
  '{"countries":{"USA":{"degree":"DDS / DMD","years":"4+4","notes":"4-year undergraduate degree then 4-year dental school; speciality requires further 2–6 years"},"UK":{"degree":"BDS","years":5,"notes":"5-year integrated Bachelor'\''s; FY1 dental foundation training follows"},"Canada":{"degree":"DDS / DMD","years":"3–4 (post-Bachelor'\''s)","notes":"Most programs require prior undergraduate degree"},"Australia":{"degree":"BDSc / DClinDent","years":"5 (direct) or 4 (graduate)","notes":"5-year undergraduate or 4-year graduate entry"},"Germany":{"degree":"Staatsexamen","years":5,"notes":"5-year state examination program"},"Singapore":{"degree":"BDS","years":5}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Dentistry');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Public Health', 'Health Sciences',
  'Focuses on the health of populations rather than individuals, covering epidemiology, health policy, environmental health, and disease prevention.',
  ARRAY['Epidemiologist','Health Policy Analyst','Public Health Officer','Global Health Consultant','Environmental Health Specialist','Health Educator','Biostatistician'],
  ARRAY['Epidemiology','Biostatistics','Health Behaviour','Environmental Health','Health Policy & Management','Global Health','Social Determinants of Health','Infectious Disease Control'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s + MPH","years":"4+2","notes":"Entry-level roles need a Bachelor'\''s; MPH (2 yrs) expected for professional practice"},"UK":{"degree":"Bachelor'\''s or MPH","years":"3 or 3+1","notes":"Can enter with a science degree; MPH is the professional qualification"},"Canada":{"degree":"Bachelor'\''s + MPH","years":"4+2"},"Australia":{"degree":"Bachelor'\''s + MPH","years":"3+1.5"},"Germany":{"degree":"Master'\''s (MPH)","years":"3+2","notes":"Entered after any health-related Bachelor'\''s"},"Singapore":{"degree":"Bachelor'\''s + MPH","years":"4+1"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Public Health');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Physiotherapy', 'Health Sciences',
  'Develops skills to assess and treat musculoskeletal, neurological, and cardiorespiratory conditions through movement, exercise, and manual therapy.',
  ARRAY['Physiotherapist','Sports Physiotherapist','Neurological Physiotherapist','Paediatric Physiotherapist','Rehabilitation Specialist','Occupational Therapist'],
  ARRAY['Human Anatomy','Musculoskeletal Physiotherapy','Neurological Rehabilitation','Cardiorespiratory Physiotherapy','Exercise Physiology','Paediatric Physiotherapy','Research Methods','Professional Practice'],
  null,
  '{"countries":{"USA":{"degree":"DPT (Doctor of Physical Therapy)","years":"4+3","notes":"Bachelor'\''s (any field) then 3-year DPT required for practice; no Bachelor'\''s-level entry"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"3-year BSc; HCPC registration required; MSc for specialist practice"},"Canada":{"degree":"Bachelor'\''s + MPT","years":"4+2","notes":"Master'\''s of Physical Therapy is entry-level requirement in most provinces"},"Australia":{"degree":"Bachelor'\''s","years":4,"notes":"4-year direct entry BPhysio; AHPRA registration required"},"Germany":{"degree":"Vocational / Bachelor'\''s","years":3,"notes":"Traditionally vocational; academic Bachelor'\''s routes now available"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Physiotherapy');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Biomedical Science', 'Health Sciences',
  'Investigates the biological and chemical basis of disease, supporting medical research, laboratory diagnostics, and pharmaceutical development.',
  ARRAY['Biomedical Scientist','Clinical Laboratory Scientist','Medical Researcher','Pharmaceutical Scientist','Genetic Counsellor','Pathologist (with MD)'],
  ARRAY['Cell Biology','Molecular Biology','Haematology','Microbiology','Immunology','Clinical Biochemistry','Pathology','Research Skills & Statistics'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"Graduate degrees (MS/PhD) strongly preferred for research; clinical lab roles require certification"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"IBMS registration required for clinical practice; MSc for specialist roles"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Biomedical Science');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Nutrition & Dietetics', 'Health Sciences',
  'Examines the science of food, nutrients, and their role in health, disease prevention, and therapeutic care.',
  ARRAY['Registered Dietitian','Clinical Nutritionist','Sports Nutritionist','Public Health Nutritionist','Food Scientist','Research Nutritionist'],
  ARRAY['Nutritional Biochemistry','Food Science','Clinical Nutrition','Community Nutrition','Dietetic Practice','Sports Nutrition','Meal Planning & Therapy','Research in Nutrition'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s + Internship","years":"4+1","notes":"RD credential requires accredited dietetic internship after degree"},"UK":{"degree":"Bachelor'\''s","years":4,"notes":"4-year BNutrDiet accredited by BDA required for registration"},"Canada":{"degree":"Bachelor'\''s + Internship","years":"4+8 months","notes":"PDt credential requires accredited internship"},"Australia":{"degree":"Bachelor'\''s","years":4,"notes":"DAA accreditation required for APD status"},"Germany":{"degree":"Bachelor'\''s","years":3,"notes":"Often vocational in origin; academic Bachelor'\''s routes available"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Nutrition & Dietetics');

-- ============================================================
-- SEED: Arts & Humanities
-- ============================================================

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'English Literature', 'Arts & Humanities',
  'Explores the breadth of written works in the English language — from medieval texts to contemporary fiction — developing critical analysis and communication skills.',
  ARRAY['Author','Editor','Journalist','Content Strategist','Teacher','Literary Agent','PR Specialist','Copywriter'],
  ARRAY['Literary Theory','British Literature','American Literature','World Literature in English','Poetry','Drama','Creative Writing','Textual Criticism'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Anglistik programs common; taught in German with English texts"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'English Literature');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'History', 'Arts & Humanities',
  'Examines the human past through primary sources, historiography, and critical argument, developing skills in research, evidence evaluation, and narrative writing.',
  ARRAY['Historian','Archivist','Museum Curator','Journalist','Policy Analyst','Teacher','Lawyer','Heritage Consultant'],
  ARRAY['Historical Methods','World History','European History','American History','Colonial & Post-Colonial Studies','Diplomatic History','Social History','Historical Research Skills'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'History');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Philosophy', 'Arts & Humanities',
  'Investigates fundamental questions about existence, knowledge, ethics, mind, and language through rigorous argument and conceptual analysis.',
  ARRAY['Academic Philosopher','Ethicist','Policy Advisor','Barrister','AI Ethics Consultant','Journalist','Teacher','Management Consultant'],
  ARRAY['Logic','Epistemology','Ethics','Metaphysics','Philosophy of Mind','Political Philosophy','Philosophy of Science','Ancient Philosophy'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Philosophy (Philosophie) with strong academic tradition; PhD common for academic careers"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Philosophy');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Architecture', 'Arts & Humanities',
  'Combines creative design with technical knowledge to plan, design, and oversee the construction of buildings and urban environments.',
  ARRAY['Architect','Urban Designer','Landscape Architect','Interior Designer','Sustainable Design Consultant','Project Manager','BIM Specialist'],
  ARRAY['Architectural Design Studio','Structural Systems','Environmental Systems','Architectural History & Theory','Urban Design','Construction Technology','Professional Practice','Digital Fabrication'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/architecture',
  '{"countries":{"USA":{"degree":"Bachelor'\''s + M.Arch","years":"4+2–3","notes":"5-year B.Arch or 4+2 M.Arch pathway; state licensure requires internship (AXP) and ARE exams"},"UK":{"degree":"BA/BSc + MArch","years":"3+2","notes":"Part 1 (3 yrs) + Part 2 (2 yrs) + Part 3 (1 yr practice) for full ARB registration"},"Canada":{"degree":"Bachelor'\''s + M.Arch","years":"4+2","notes":"M.Arch required for licensure"},"Australia":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"AACA registration requires 2 years supervised experience"},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Architekt title requires state-specific registration after Master'\''s"},"Singapore":{"degree":"Bachelor'\''s + Master'\''s","years":"4+1.5"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Architecture');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Fine Arts', 'Arts & Humanities',
  'Develops creative practice across painting, sculpture, printmaking, digital media, and installation art, alongside critical and conceptual thinking.',
  ARRAY['Fine Artist','Illustrator','Gallery Curator','Art Director','Art Educator','Creative Director','Animator'],
  ARRAY['Drawing & Painting','Sculpture','Printmaking','Digital Media Art','Art History & Theory','Studio Practice','Artist Statement Development','Exhibition Design'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor of Fine Arts (BFA)","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"BFA","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Diplom / Bachelor'\''s","years":4,"notes":"Art academies (Kunstakademien) often offer 4-year Diplom programs"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Fine Arts');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Music', 'Arts & Humanities',
  'Develops musicianship through performance, composition, music theory, and music history, preparing graduates for careers in performance, education, and the music industry.',
  ARRAY['Performer','Composer','Music Producer','Music Teacher','Music Therapist','Sound Designer','Arts Administrator'],
  ARRAY['Music Theory & Harmony','Ear Training','Music History','Instrumental / Vocal Performance','Composition','Conducting','Music Technology','Ensemble Studies'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor of Music (BM)","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"BMus","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Diplom / Bachelor'\''s","years":4,"notes":"Conservatories (Musikhochschule) offer 4-year programs; highly selective"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Music');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Linguistics', 'Arts & Humanities',
  'Studies the structure, acquisition, use, and history of human language, from phonetics and syntax to sociolinguistics and computational linguistics.',
  ARRAY['Linguist','Speech Therapist','NLP Researcher','Translator','Language Teacher','Lexicographer','UX Writer'],
  ARRAY['Phonetics & Phonology','Morphology & Syntax','Semantics & Pragmatics','Sociolinguistics','Historical Linguistics','Psycholinguistics','Computational Linguistics','Language Acquisition'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Linguistics');

-- ============================================================
-- SEED: Social Sciences
-- ============================================================

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Psychology', 'Social Sciences',
  'Examines human behaviour and mental processes — from cognition and emotion to social influence and clinical disorders.',
  ARRAY['Clinical Psychologist','Counsellor','Organisational Psychologist','Research Psychologist','School Psychologist','UX Researcher','Human Factors Specialist'],
  ARRAY['Biological Psychology','Cognitive Psychology','Developmental Psychology','Social Psychology','Abnormal Psychology','Research Methods & Statistics','Personality Theory','Counselling Skills'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/psychology',
  '{"countries":{"USA":{"degree":"Bachelor'\''s + Doctoral","years":"4+4–7","notes":"Doctoral degree (PhD or PsyD) required for licensed clinical psychologist; Master'\''s for some counselling roles"},"UK":{"degree":"Bachelor'\''s + Postgraduate","years":"3+1–3","notes":"BPS-accredited BSc + postgraduate diploma or DClinPsy required for clinical practice"},"Canada":{"degree":"Bachelor'\''s + Master'\''s or PhD","years":"4+2–5","notes":"Provincial licensure requires master'\''s or doctorate depending on scope"},"Australia":{"degree":"Bachelor'\''s + 4th year + 2-yr Masters","years":"3+1+2","notes":"6 years minimum for Psychology Board registration"},"Germany":{"degree":"Master'\''s + Approbation","years":"3+2+postgrad","notes":"Psychotherapist licence (Approbation) requires further supervised training"},"Singapore":{"degree":"Bachelor'\''s + Master'\''s","years":"4+2"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Psychology');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Sociology', 'Social Sciences',
  'Analyses social structures, institutions, inequalities, and collective behaviour — examining how society shapes individuals and vice versa.',
  ARRAY['Social Researcher','Policy Analyst','Community Development Worker','Social Worker','HR Specialist','Journalist','Urban Planner'],
  ARRAY['Sociological Theory','Research Methods','Social Stratification','Race & Ethnicity','Gender Studies','Urban Sociology','Globalisation','Criminology'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Sociology');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Political Science', 'Social Sciences',
  'Studies political systems, institutions, theory, and behaviour — from comparative government and international relations to public policy and political philosophy.',
  ARRAY['Policy Analyst','Political Advisor','Diplomat','Journalist','NGO Manager','Lobbyist','Academic Researcher'],
  ARRAY['Political Theory','Comparative Politics','International Relations','Public Policy','Political Economy','Research Methods','Electoral Politics','Government & Democracy'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Political Science');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'International Relations', 'Social Sciences',
  'Examines interactions between states, international organisations, and non-state actors, covering diplomacy, conflict, trade, and global governance.',
  ARRAY['Diplomat','Foreign Affairs Analyst','NGO Manager','Intelligence Analyst','Trade Negotiator','International Journalist','UN/World Bank Officer'],
  ARRAY['International Relations Theory','Diplomatic History','Global Political Economy','International Law','Conflict & Security Studies','Foreign Policy Analysis','Human Rights','Area Studies'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'International Relations');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Economics', 'Social Sciences',
  'Analyses how individuals, firms, and governments allocate scarce resources, covering microeconomics, macroeconomics, econometrics, and economic policy.',
  ARRAY['Economist','Financial Analyst','Policy Economist','Actuary','Data Analyst','Management Consultant','Investment Banker'],
  ARRAY['Microeconomics','Macroeconomics','Econometrics','Development Economics','International Economics','Game Theory','Public Economics','Labour Economics'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/economics-econometrics',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"PhD required for academic economics; MBA or Master'\''s for policy/finance"},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Economics');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Law', 'Social Sciences',
  'Develops understanding of legal systems, statutes, case law, and legal reasoning, preparing graduates for practice, policy, and a wide range of professional roles.',
  ARRAY['Solicitor / Attorney','Barrister / Advocate','Corporate Lawyer','Judge','Legal Counsel','Policy Advisor','Compliance Officer','Legal Academic'],
  ARRAY['Contract Law','Tort Law','Constitutional Law','Criminal Law','Property Law','Equity & Trusts','Administrative Law','Legal Research & Writing'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/law',
  '{"countries":{"USA":{"degree":"JD (after Bachelor'\''s)","years":"4+3","notes":"Any Bachelor'\''s first; then 3-year Juris Doctor; bar exam required for practice"},"UK":{"degree":"LLB","years":3,"notes":"3-year LLB; then 1-year LPC (solicitors) or BTC (barristers) for qualification"},"Canada":{"degree":"JD / LLB","years":"3–4 (post-Bachelor'\''s)","notes":"Most Canadian law schools require a prior undergraduate degree"},"Australia":{"degree":"LLB or JD","years":"4–5 (direct) or 3 (graduate)","notes":"Can be combined with another degree; JD is 3-year graduate entry"},"Germany":{"degree":"Staatsexamen","years":"4.5–5","notes":"First state exam after 4.5 yrs study; 2-yr referendariat; second state exam for admission to bar"},"Singapore":{"degree":"LLB","years":4,"notes":"4-year program at NUS or SMU; further practical training required"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Law');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Anthropology', 'Social Sciences',
  'Studies human societies and cultures across time and place — examining biological evolution, archaeological evidence, language, and lived social experience.',
  ARRAY['Cultural Anthropologist','Archaeologist','UX Researcher','Development Consultant','Museum Curator','NGO Worker','Forensic Anthropologist'],
  ARRAY['Cultural Anthropology','Physical / Biological Anthropology','Archaeology','Linguistic Anthropology','Ethnographic Methods','Human Evolution','Medical Anthropology','Environmental Anthropology'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"PhD required for academic or research careers"},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Anthropology');

-- ============================================================
-- SEED: Natural Sciences
-- ============================================================

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Biology', 'Natural Sciences',
  'Explores life at scales from molecules to ecosystems — covering cell biology, genetics, evolution, ecology, and physiology.',
  ARRAY['Biologist','Research Scientist','Conservationist','Biotechnologist','Environmental Consultant','Science Teacher','Medical Writer'],
  ARRAY['Cell Biology','Genetics','Ecology','Evolution','Biochemistry','Physiology','Microbiology','Research Methods'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/biological-sciences',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"PhD strongly expected for research careers"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"MBiol (4 yrs) integrates a research project year"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Biology');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Chemistry', 'Natural Sciences',
  'Studies the composition, structure, properties, and reactions of matter, bridging physics and biology through organic, inorganic, analytical, and physical chemistry.',
  ARRAY['Chemist','Pharmaceutical Scientist','Materials Scientist','Chemical Engineer','Forensic Scientist','Environmental Chemist','Science Educator'],
  ARRAY['Organic Chemistry','Inorganic Chemistry','Physical Chemistry','Analytical Chemistry','Spectroscopy','Quantum Chemistry','Laboratory Techniques','Research Skills'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/chemistry',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"PhD expected for research; industry may accept Master'\''s"},"UK":{"degree":"MChem","years":4,"notes":"Integrated 4-year MChem preferred for research; BSc (3 yrs) also available"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Chemistry');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Physics', 'Natural Sciences',
  'Investigates the fundamental laws governing matter, energy, space, and time — from quantum mechanics and relativity to astrophysics and condensed matter.',
  ARRAY['Physicist','Research Scientist','Quantitative Analyst','Data Scientist','Aerospace Engineer','Nuclear Engineer','Science Educator'],
  ARRAY['Classical Mechanics','Electromagnetism','Quantum Mechanics','Thermodynamics & Statistical Mechanics','Special Relativity','Optics','Nuclear & Particle Physics','Computational Physics'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/physics-astronomy',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"PhD almost universal for research; Master'\''s route to industry"},"UK":{"degree":"MPhys","years":4,"notes":"Integrated 4-year MPhys preferred; 3-year BSc also available"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Physics has very strong academic tradition in Germany"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Physics');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Mathematics', 'Natural Sciences',
  'Develops abstract reasoning through pure and applied mathematics — covering analysis, algebra, topology, probability, and mathematical modelling.',
  ARRAY['Mathematician','Actuary','Quantitative Analyst','Data Scientist','Cryptographer','Financial Engineer','Operations Researcher','Academic Researcher'],
  ARRAY['Calculus & Analysis','Linear Algebra','Abstract Algebra','Differential Equations','Probability & Statistics','Number Theory','Topology','Numerical Methods'],
  'https://www.topuniversities.com/university-rankings/university-subject-rankings/2024/mathematics',
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"MMath","years":4,"notes":"Integrated 4-year MMath preferred; 3-year BSc also available"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2","notes":"Mathematics with strong academic tradition; PhD common"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Mathematics');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Environmental Science', 'Natural Sciences',
  'Combines natural and social sciences to understand environmental systems and address challenges such as climate change, pollution, and biodiversity loss.',
  ARRAY['Environmental Scientist','Climate Analyst','Conservation Biologist','Environmental Consultant','GIS Specialist','Sustainability Manager','Policy Analyst'],
  ARRAY['Ecology','Climate Science','Environmental Chemistry','Geoscience','GIS & Remote Sensing','Environmental Policy','Sustainability','Fieldwork Methods'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Environmental Science');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Statistics', 'Natural Sciences',
  'Develops expertise in data collection, analysis, and interpretation — combining mathematical theory with practical applications in science, business, and policy.',
  ARRAY['Statistician','Actuary','Data Analyst','Biostatistician','Quantitative Researcher','Risk Analyst','Machine Learning Engineer'],
  ARRAY['Probability Theory','Statistical Inference','Regression Analysis','Bayesian Statistics','Multivariate Analysis','Time Series Analysis','Statistical Computing','Experimental Design'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"MS Statistics highly valued in industry; PhD for academia"},"UK":{"degree":"Bachelor'\''s","years":3},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":3},"Germany":{"degree":"Bachelor'\''s + Master'\''s","years":"3+2"},"Singapore":{"degree":"Bachelor'\''s","years":4}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Statistics');

-- ============================================================
-- SEED: Education
-- ============================================================

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Early Childhood Education', 'Education',
  'Prepares educators to support the learning and development of children from birth through age eight, with a focus on play-based learning, child development, and family engagement.',
  ARRAY['Early Years Educator','Kindergarten Teacher','Nursery Manager','Child Development Specialist','Family Support Worker','Policy Advisor'],
  ARRAY['Child Development','Play & Learning','Early Literacy & Numeracy','Family & Community Engagement','Inclusive Education','Assessment of Young Children','Health & Wellbeing','Professional Practice'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"State teaching licence required; requirements vary widely by state"},"UK":{"degree":"Bachelor'\''s","years":3,"notes":"QTS (Qualified Teacher Status) obtained through BEd or PGCE"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4,"notes":"ACECQA accreditation required for centre-based settings"},"Germany":{"degree":"Vocational / Bachelor'\''s","years":"3–4","notes":"Erzieher vocational route (3 yrs) or academic Bachelor'\''s available; Master'\''s for leadership"},"Singapore":{"degree":"Diploma / Bachelor'\''s","years":"2–4","notes":"NIE trains teachers; MOE sets entry requirements"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Early Childhood Education');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Secondary Education', 'Education',
  'Prepares teachers for middle and high school classrooms in subject specialisms including mathematics, sciences, humanities, and languages.',
  ARRAY['Secondary School Teacher','Department Head','School Counsellor','Curriculum Developer','Education Policy Analyst','Instructional Coach'],
  ARRAY['Subject Specialism','Pedagogy & Teaching Methods','Adolescent Development','Classroom Management','Curriculum Design','Educational Assessment','Inclusive Teaching','Professional Placement'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"State certification required; subject master'\''s often needed for high school in some states"},"UK":{"degree":"Bachelor'\''s + PGCE","years":"3+1","notes":"BEd (3-4 yrs) or undergraduate + PGCE (1 yr) for QTS"},"Canada":{"degree":"Bachelor'\''s + BEd","years":"4+1–2","notes":"Two-degree pathway standard in most provinces"},"Australia":{"degree":"Bachelor'\''s","years":4,"notes":"4-year concurrent degree or 3+2 pathway; AITSL accreditation required"},"Germany":{"degree":"Master'\''s (Lehramt)","years":"3+2","notes":"Bachelor'\''s + Master'\''s in Education (Lehramt) required; 18-month Referendariat before state exam"},"Singapore":{"degree":"Bachelor'\''s","years":4,"notes":"NIE is the sole teacher education institution; NIE Diploma or degree required"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Secondary Education');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Special Education', 'Education',
  'Trains educators to support students with diverse learning needs, disabilities, and developmental differences in inclusive and specialist settings.',
  ARRAY['Special Education Teacher','Learning Support Specialist','Behavioural Therapist','Inclusion Coordinator','Education Psychologist','SENCO (UK)','Transition Specialist'],
  ARRAY['Special Education Law & Policy','Disability Studies','Behaviour Analysis','Differentiated Instruction','Communication & AAC','Assessment & IEP Development','Autism Spectrum Disorders','Inclusive Classroom Practices'],
  null,
  '{"countries":{"USA":{"degree":"Bachelor'\''s","years":4,"notes":"State licensure required; IDEA compliance mandated; Master'\''s for specialist roles"},"UK":{"degree":"Bachelor'\''s + PGCE or NASENCO","years":"3+1","notes":"SENCO role requires NASENCO qualification post-QTS"},"Canada":{"degree":"Bachelor'\''s","years":4},"Australia":{"degree":"Bachelor'\''s","years":4},"Germany":{"degree":"Master'\''s (Sonderpädagogik)","years":"3+2","notes":"Sonderpädagogik requires full Lehramt Master'\''s (5 yrs); Referendariat follows"},"Singapore":{"degree":"Bachelor'\''s + Diploma","years":"4+1"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Special Education');

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework, qs_ranking_url, degree_lengths)
SELECT 'Educational Leadership', 'Education',
  'Develops leaders for schools, universities, and educational organisations, covering management, policy, organisational change, and the ethics of leadership.',
  ARRAY['School Principal','Superintendent','Education Policy Director','University Administrator','Instructional Coach','Director of Curriculum','Non-Profit Education Leader'],
  ARRAY['Leadership Theory','Organisational Change','Educational Policy & Law','School Finance','Data-Driven Decision Making','Community & Family Engagement','Ethics in Leadership','Strategic Planning'],
  null,
  '{"countries":{"USA":{"degree":"Master'\''s (MEd / EdS)","years":"4+2","notes":"Principal licence requires Master'\''s + state exam; EdD/PhD for district leadership"},"UK":{"degree":"Master'\''s (MBA / MEd)","years":"3+1","notes":"NPQH (National Professional Qualification for Headship) often required for headteacher roles"},"Canada":{"degree":"Master'\''s","years":"4+2"},"Australia":{"degree":"Master'\''s","years":"4+1.5"},"Germany":{"degree":"Master'\''s + Referendariat","years":"3+2+1.5","notes":"School leadership requires further administrative training after Lehramt"},"Singapore":{"degree":"Master'\''s","years":"4+1","notes":"Typically entered through NIE or MOE leadership programmes"}}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.majors WHERE name = 'Educational Leadership');
