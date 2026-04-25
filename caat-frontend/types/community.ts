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

export interface PollOption {
  id: string;
  text: string;
}

export interface PostAuthor {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
}

export interface NotificationItem {
  id: string;
  type: "like" | "comment" | "reply" | "follow";
  actor_name: string;
  actor_avatar: string | null;
  post_id: string | null;
  post_snippet: string;
  is_read: boolean;
  created_at: string;
}

export interface PrivacySettings {
  show_graduation_year: boolean;
  show_school_name: boolean;
  show_preferred_countries: boolean;
  show_target_majors: boolean;
}

export interface CommunityProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  graduation_year: number | null;
  school_name: string | null;
  preferred_countries: string[];
  target_majors: string[];
  follower_count: number;
  following_count: number;
  is_following: boolean;
  is_own_profile: boolean;
  privacy: PrivacySettings;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
  likes_count: number;
  is_liked_by_user: boolean;
  author: PostAuthor | null;
  replies: CommunityComment[];
}

export interface CommunityGroup {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  creator_id: string | null;
  is_private: boolean;
  icon_url: string | null;
  banner_url: string | null;
  member_count: number;
  post_count: number;
  is_member: boolean;
  is_owner: boolean;
  created_at: string;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  topic_tag: TopicTag;
  university_id: number | null;
  school_name: string | null;
  major_id: string | null;
  result_card: ResultCard | null;
  score_card: ScoreCard | null;
  group_id: string | null;
  resume_id: string | null;
  resume_title: string | null;
  is_anonymous: boolean;
  is_hidden: boolean;
  edited_at: string | null;
  poll_options: PollOption[] | null;
  poll_votes: Record<string, number> | null;
  user_vote: string | null;
  created_at: string;
  updated_at: string;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  author: PostAuthor | null;
}
