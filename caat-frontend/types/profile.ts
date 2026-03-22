/** Raw row returned from the public.profiles Supabase table */
export interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  birth_date: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  avatar_url: string | null;
  nationality: string | null;
  current_location: string | null;
  school_name: string | null;
  curriculum: string | null;
  graduation_year: number | null;
  target_majors: string[] | null;
  preferred_countries: string[] | null;
}

/** Row from the standardised_test_scores table */
export interface StandardisedTestScoreRow {
  id: string;
  profile_id: string;
  curriculum: string;        // 'SAT' | 'ATAR' | 'A-Levels' | 'IB' | 'GPA' | 'English Proficiency'
  cumulative_score: string | null;
  score_scale: string | null; // '4.0' | '5.0' | '7.0' | '10.0' | '20' | '100' | custom
  created_at: string;
  updated_at: string;
}

/** Row from the standardised_test_subjects table */
export interface StandardisedTestSubjectRow {
  id: string;
  test_score_id: string;
  subject_name: string;
  grade: string;
  created_at: string;
}

/** Test score with its subjects joined (for client-side use) */
export interface StandardisedTestScore extends StandardisedTestScoreRow {
  subjects: StandardisedTestSubjectRow[];
}

/** Known curriculum types for the standardised testing card */
export const CURRICULUM_OPTIONS = [
  "SAT",
  "ATAR",
  "A-Levels",
  "IB",
  "AP",
  "IGCSE",
  "CBSE",
  "CISCE",
  "French Baccalauréat",
  "German Abitur",
  "Gaokao",
  "GPA",
  "English Proficiency",
  "Other",
] as const;

export type CurriculumType = (typeof CURRICULUM_OPTIONS)[number];

/** GPA scale presets */
export const GPA_SCALES = [
  { label: "4.0 scale", value: "4.0" },
  { label: "5.0 scale", value: "5.0" },
  { label: "7.0 scale", value: "7.0" },
  { label: "10.0 scale", value: "10.0" },
  { label: "20-point scale", value: "20" },
  { label: "Percentage (100)", value: "100" },
] as const;

/** English proficiency test presets */
export const ENGLISH_PROFICIENCY_TESTS = [
  { label: "IELTS", maxScore: "9.0" },
  { label: "TOEFL", maxScore: "120" },
  { label: "PTE", maxScore: "90" },
  { label: "Duolingo", maxScore: "160" },
  { label: "Cambridge", maxScore: "230" },
] as const;
