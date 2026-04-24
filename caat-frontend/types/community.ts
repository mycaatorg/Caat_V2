export type TopicTag =
  | "APPLICATION_RESULTS"
  | "ESSAYS"
  | "TEST_SCORES"
  | "EXTRACURRICULARS"
  | "ADVICE"
  | "SCHOLARSHIPS";

export const TOPIC_LABELS: Record<TopicTag, string> = {
  APPLICATION_RESULTS: "Application Results",
  ESSAYS: "Essays",
  TEST_SCORES: "Test Scores",
  EXTRACURRICULARS: "Extracurriculars",
  ADVICE: "Advice",
  SCHOLARSHIPS: "Scholarships",
};

export interface ResultCard {
  outcome: "accepted" | "waitlisted" | "rejected";
  university_name: string;
  program?: string;
}

export interface ScoreCard {
  exam: "SAT" | "ACT" | "IB" | "A-Levels" | "ATAR" | "AP";
  score: string;
}

export interface PostAuthor {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  topic_tag: TopicTag;
  university_id: number | null;
  major_id: string | null;
  result_card: ResultCard | null;
  score_card: ScoreCard | null;
  resume_link: string | null;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  author: PostAuthor | null;
}
