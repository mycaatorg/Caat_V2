-- Majors seed data
-- Run this in the Supabase SQL editor to populate the majors table.
-- Covers 7 categories with ~25 majors total.

INSERT INTO public.majors (name, category, description, career_paths, typical_coursework) VALUES

-- ─── Engineering ────────────────────────────────────────────────────────────
(
  'Computer Science',
  'Engineering',
  'Study of computation, algorithms, data structures, and software systems. Covers both theory and hands-on programming across a range of specializations.',
  '["Software Engineer", "Data Scientist", "Machine Learning Engineer", "Product Manager", "DevOps Engineer"]',
  '["Data Structures & Algorithms", "Operating Systems", "Computer Networks", "Database Systems", "Software Engineering"]'
),
(
  'Mechanical Engineering',
  'Engineering',
  'Application of physics and materials science to design, analyze, and manufacture mechanical systems — from engines to robotics.',
  '["Mechanical Engineer", "Aerospace Engineer", "Product Designer", "Manufacturing Engineer", "R&D Engineer"]',
  '["Statics & Dynamics", "Thermodynamics", "Fluid Mechanics", "Materials Science", "CAD/CAM Design"]'
),
(
  'Electrical Engineering',
  'Engineering',
  'Study of electricity, electronics, and electromagnetism with applications in power systems, communications, and embedded hardware.',
  '["Electrical Engineer", "Embedded Systems Engineer", "Hardware Engineer", "Signal Processing Engineer", "Power Systems Analyst"]',
  '["Circuit Analysis", "Electromagnetics", "Digital Logic Design", "Control Systems", "Signal Processing"]'
),
(
  'Civil Engineering',
  'Engineering',
  'Design and construction of infrastructure — roads, bridges, buildings, water systems, and urban environments.',
  '["Civil Engineer", "Structural Engineer", "Urban Planner", "Construction Manager", "Environmental Engineer"]',
  '["Structural Analysis", "Geotechnical Engineering", "Hydraulics", "Construction Management", "Environmental Engineering"]'
),
(
  'Biomedical Engineering',
  'Engineering',
  'Intersection of engineering principles and biological/medical sciences to design devices, diagnostics, and healthcare technologies.',
  '["Biomedical Engineer", "Medical Device Designer", "Clinical Engineer", "Regulatory Affairs Specialist", "Research Scientist"]',
  '["Biomechanics", "Bioinstrumentation", "Biomaterials", "Medical Imaging", "Physiological Modeling"]'
),

-- ─── Business ───────────────────────────────────────────────────────────────
(
  'Business Administration',
  'Business',
  'Broad foundation in management, operations, strategy, and organizational behavior for leading teams and running businesses.',
  '["Operations Manager", "Business Analyst", "Management Consultant", "Entrepreneur", "General Manager"]',
  '["Principles of Management", "Organizational Behavior", "Business Strategy", "Operations Management", "Business Ethics"]'
),
(
  'Finance',
  'Business',
  'Study of capital markets, investment analysis, corporate finance, and financial planning and risk management.',
  '["Financial Analyst", "Investment Banker", "Portfolio Manager", "CFO", "Risk Manager"]',
  '["Financial Accounting", "Corporate Finance", "Investments", "Financial Modeling", "Derivatives"]'
),
(
  'Marketing',
  'Business',
  'Understanding consumer behavior and building strategies to promote products, services, and brands across digital and traditional channels.',
  '["Marketing Manager", "Brand Strategist", "Digital Marketer", "Market Research Analyst", "Product Marketing Manager"]',
  '["Consumer Behavior", "Marketing Strategy", "Digital Marketing", "Market Research", "Brand Management"]'
),
(
  'Accounting',
  'Business',
  'Principles of financial reporting, auditing, taxation, and managerial accounting that underpin business decision-making.',
  '["CPA", "Auditor", "Tax Advisor", "Financial Controller", "Forensic Accountant"]',
  '["Financial Accounting", "Managerial Accounting", "Auditing", "Taxation", "Accounting Information Systems"]'
),
(
  'Economics',
  'Business',
  'Analysis of how individuals, firms, and governments allocate scarce resources through the lens of micro and macroeconomic theory.',
  '["Economist", "Policy Analyst", "Data Analyst", "Financial Consultant", "Research Analyst"]',
  '["Microeconomics", "Macroeconomics", "Econometrics", "Game Theory", "Public Economics"]'
),

-- ─── Health Sciences ────────────────────────────────────────────────────────
(
  'Nursing',
  'Health Sciences',
  'Patient-centered education in clinical care, health assessment, pharmacology, and nursing practice across diverse healthcare settings.',
  '["Registered Nurse", "Nurse Practitioner", "Clinical Nurse Specialist", "Nurse Educator", "Healthcare Administrator"]',
  '["Anatomy & Physiology", "Pharmacology", "Health Assessment", "Medical-Surgical Nursing", "Community Health Nursing"]'
),
(
  'Public Health',
  'Health Sciences',
  'Population-level health: epidemiology, health policy, environmental health, and strategies to prevent disease and promote well-being.',
  '["Epidemiologist", "Health Policy Analyst", "Community Health Educator", "Biostatistician", "Global Health Consultant"]',
  '["Epidemiology", "Biostatistics", "Health Policy", "Environmental Health", "Global Health"]'
),
(
  'Pre-Medicine / Biology',
  'Health Sciences',
  'Foundational sciences — biology, chemistry, and physiology — that prepare students for medical school and careers in medicine.',
  '["Physician", "Surgeon", "Medical Researcher", "Physician Assistant", "Healthcare Consultant"]',
  '["General Biology", "Organic Chemistry", "Biochemistry", "Genetics", "Human Physiology"]'
),
(
  'Kinesiology',
  'Health Sciences',
  'Science of human movement, exercise physiology, and biomechanics, applied to sports performance, rehabilitation, and wellness.',
  '["Physical Therapist", "Athletic Trainer", "Exercise Physiologist", "Strength & Conditioning Coach", "Sports Medicine Physician"]',
  '["Anatomy", "Exercise Physiology", "Biomechanics", "Motor Learning", "Sports Nutrition"]'
),

-- ─── Arts & Humanities ──────────────────────────────────────────────────────
(
  'English Literature',
  'Arts & Humanities',
  'Critical reading, writing, and analysis of literary texts across periods and cultures, developing communication and interpretive skills.',
  '["Writer / Author", "Editor", "Content Strategist", "Journalist", "Teacher / Professor"]',
  '["Literary Theory", "British Literature", "American Literature", "Creative Writing", "Advanced Composition"]'
),
(
  'History',
  'Arts & Humanities',
  'Investigation of past events, societies, and cultures to understand how the world came to be and develop critical analytical thinking.',
  '["Historian", "Archivist", "Museum Curator", "Policy Analyst", "Lawyer"]',
  '["World History", "Research Methods", "Historical Writing", "Modern History", "Historiography"]'
),
(
  'Fine Arts',
  'Arts & Humanities',
  'Studio-based practice in drawing, painting, sculpture, or digital media alongside art history and critical theory.',
  '["Visual Artist", "Art Director", "Illustrator", "Gallery Curator", "Art Teacher"]',
  '["Drawing & Composition", "Color Theory", "Art History", "Sculpture", "Digital Media Arts"]'
),
(
  'Philosophy',
  'Arts & Humanities',
  'Rigorous examination of ethics, logic, epistemology, and metaphysics — developing reasoning skills applied across every field.',
  '["Philosopher / Academic", "Lawyer", "Ethicist", "UX Researcher", "Policy Advisor"]',
  '["Logic", "Ethics", "Epistemology", "Political Philosophy", "Philosophy of Mind"]'
),

-- ─── Social Sciences ────────────────────────────────────────────────────────
(
  'Psychology',
  'Social Sciences',
  'Scientific study of behavior and mental processes, from clinical and developmental psychology to cognitive neuroscience.',
  '["Clinical Psychologist", "Counselor", "Human Factors Researcher", "HR Specialist", "UX Researcher"]',
  '["Introduction to Psychology", "Research Methods", "Developmental Psychology", "Abnormal Psychology", "Cognitive Psychology"]'
),
(
  'Political Science',
  'Social Sciences',
  'Study of governments, political systems, public policy, international relations, and political theory.',
  '["Policy Analyst", "Politician / Staffer", "Diplomat", "Lawyer", "Journalist"]',
  '["American Government", "International Relations", "Political Theory", "Comparative Politics", "Public Policy"]'
),
(
  'Sociology',
  'Social Sciences',
  'Examination of social structures, institutions, inequality, and group behavior to understand how society functions.',
  '["Social Worker", "Urban Planner", "Policy Researcher", "Human Resources Manager", "Non-profit Director"]',
  '["Introduction to Sociology", "Social Research Methods", "Social Inequality", "Urban Sociology", "Criminology"]'
),
(
  'Communications',
  'Social Sciences',
  'Study of media, messaging, rhetoric, journalism, and interpersonal communication across digital and traditional platforms.',
  '["Journalist", "Public Relations Specialist", "Media Producer", "Communications Director", "Social Media Manager"]',
  '["Mass Communication Theory", "Media Writing", "Public Relations", "Digital Media", "Intercultural Communication"]'
),

-- ─── Natural Sciences ───────────────────────────────────────────────────────
(
  'Biology',
  'Natural Sciences',
  'Comprehensive study of living organisms from molecular biology and genetics to ecology and evolutionary biology.',
  '["Research Scientist", "Biologist", "Biotech Analyst", "Science Teacher", "Environmental Consultant"]',
  '["Cell Biology", "Genetics", "Ecology", "Evolutionary Biology", "Biochemistry"]'
),
(
  'Chemistry',
  'Natural Sciences',
  'Study of matter, its properties, and reactions — spanning organic, inorganic, physical, and analytical chemistry.',
  '["Chemist", "Pharmacologist", "Materials Scientist", "Chemical Engineer", "Quality Control Analyst"]',
  '["General Chemistry", "Organic Chemistry", "Analytical Chemistry", "Physical Chemistry", "Biochemistry"]'
),
(
  'Environmental Science',
  'Natural Sciences',
  'Interdisciplinary study of natural systems, environmental policy, climate change, and sustainability.',
  '["Environmental Scientist", "Conservation Biologist", "Sustainability Consultant", "Environmental Policy Analyst", "Park Ranger"]',
  '["Ecology", "Environmental Chemistry", "Climate Science", "GIS & Remote Sensing", "Environmental Policy"]'
),

-- ─── Education ──────────────────────────────────────────────────────────────
(
  'Elementary Education',
  'Education',
  'Preparation for teaching children in grades K–6, covering curriculum design, child development, and classroom management.',
  '["Elementary School Teacher", "Curriculum Developer", "Instructional Coach", "School Counselor", "Education Administrator"]',
  '["Child Development", "Literacy Instruction", "Math Methods for Teachers", "Classroom Management", "Educational Psychology"]'
),
(
  'Special Education',
  'Education',
  'Training to support students with disabilities through individualized instruction, IEP development, and inclusive teaching practices.',
  '["Special Education Teacher", "Behavioral Specialist", "Learning Disabilities Specialist", "School Psychologist", "Advocate"]',
  '["Foundations of Special Education", "Behavior Management", "IEP Development", "Assistive Technology", "Inclusive Classroom Practices"]'
);
