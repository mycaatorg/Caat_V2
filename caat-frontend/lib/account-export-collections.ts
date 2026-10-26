import type { Database } from "@/types/database";

type Tables = Database["public"]["Tables"];
type Collection = {
  [K in keyof Tables]: {
    table: K;
    owner: keyof Tables[K]["Row"] & string;
    order: readonly (keyof Tables[K]["Row"] & string)[];
  }
}[keyof Tables];

/** Reviewed against primary keys and owner RLS policies. Publicly readable
 * community records still require an explicit owner filter here. Reports have
 * no owner SELECT policy, so they are deliberately excluded, never elevated. */
export const accountExportCollections = [
  { table: "shortlist_shares", owner: "user_id", order: ["id"] },
  { table: "course_preparation_checks", owner: "user_id", order: ["id"] },
  { table: "course_preparation_work", owner: "user_id", order: ["id"] },
  { table: "application_evidence_links", owner: "user_id", order: ["id"] },
  { table: "calendar_events", owner: "user_id", order: ["id"] },
  { table: "community_comment_likes", owner: "user_id", order: ["comment_id", "user_id"] },
  { table: "community_comments", owner: "user_id", order: ["id"] },
  { table: "community_group_members", owner: "user_id", order: ["group_id", "user_id"] },
  { table: "community_group_requests", owner: "user_id", order: ["group_id", "user_id"] },
  { table: "community_groups", owner: "creator_id", order: ["id"] },
  { table: "community_likes", owner: "user_id", order: ["post_id", "user_id"] },
  { table: "community_poll_votes", owner: "user_id", order: ["post_id", "user_id"] },
  { table: "community_resume_publications", owner: "user_id", order: ["id"] },
  { table: "community_resume_shares", owner: "user_id", order: ["post_id"] },
  { table: "community_posts", owner: "user_id", order: ["id"] },
  { table: "community_profile_settings", owner: "user_id", order: ["user_id"] },
  { table: "community_saves", owner: "user_id", order: ["post_id", "user_id"] },
  { table: "custom_essay_prompts", owner: "user_id", order: ["id"] },
  { table: "dashboard_layouts", owner: "user_id", order: ["user_id"] },
  { table: "documents", owner: "user_id", order: ["id"] },
  { table: "essay_drafts", owner: "user_id", order: ["id"] },
  { table: "evidence_items", owner: "user_id", order: ["id"] },
  { table: "notifications", owner: "user_id", order: ["id"] },
  { table: "user_bookmarked_majors", owner: "user_id", order: ["user_id", "major_id"] },
  { table: "user_bookmarked_scholarships", owner: "user_id", order: ["user_id", "scholarship_id"] },
  { table: "user_bookmarked_schools", owner: "user_id", order: ["user_id", "school_id"] },
  { table: "user_course_bookmarks", owner: "user_id", order: ["user_id", "course_id"] },
  { table: "user_dashboard_widgets", owner: "user_id", order: ["id"] },
  { table: "user_recommenders", owner: "user_id", order: ["id"] },
  { table: "user_scholarship_prep_checks", owner: "user_id", order: ["user_id", "scholarship_id", "item_key"] },
  { table: "user_scholarships", owner: "user_id", order: ["id"] },
  { table: "user_school_applications", owner: "user_id", order: ["id"] },
  { table: "user_school_notes", owner: "user_id", order: ["user_id", "school_id"] },
  { table: "user_todos", owner: "user_id", order: ["id"] },
  { table: "community_blocks", owner: "blocker_id", order: ["blocker_id", "blocked_id"] },
  { table: "community_follows", owner: "follower_id", order: ["follower_id", "followee_id"] },
  { table: "requirement_evidence_links", owner: "user_id", order: ["id"] },
] as const satisfies readonly Collection[];
