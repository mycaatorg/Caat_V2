import { z } from "zod";

// P2.7 — Zod schemas for the Communities feature. Replaces hand-rolled
// validation in server actions; runs before any DB call.
//
// Every constraint here also exists either as a CHECK in the schema or as a
// length-cap hint in the application — the schemas are the single source of
// truth from the action's perspective.

const TopicTagSchema = z.enum([
  "APPLICATION_RESULTS",
  "ESSAYS",
  "TEST_SCORES",
  "EXTRACURRICULARS",
  "ADVICE",
  "SCHOLARSHIPS",
]);

const ResultCardSchema = z.object({
  outcome: z.enum(["accepted", "waitlisted", "rejected"]),
  university_name: z.string().trim().min(1).max(200),
  program: z.string().trim().max(200).optional(),
});

const ScoreCardSchema = z.object({
  exam: z.enum(["SAT", "ACT", "IB", "A-Levels", "ATAR", "AP"]),
  score: z.string().trim().min(1).max(50),
});

const PollOptionSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().trim().min(1).max(120),
});

export const PostInputSchema = z.object({
  content: z.string().max(2000),
  topic_tag: TopicTagSchema,
  result_card: ResultCardSchema.nullable().optional(),
  score_card: ScoreCardSchema.nullable().optional(),
  resume_id: z.string().uuid().nullable().optional(),
  is_anonymous: z.boolean().optional(),
  university_id: z.number().int().positive().nullable().optional(),
  poll_options: z.array(PollOptionSchema).min(2).max(10).nullable().optional(),
  group_id: z.string().uuid().nullable().optional(),
});

export const CommentInputSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().trim().min(1).max(1000),
  parentCommentId: z.string().uuid().optional(),
});

export const GroupInputSchema = z.object({
  name: z.string().trim().min(3).max(50),
  description: z.string().trim().max(500).optional(),
  is_private: z.boolean(),
});

export type PostInput = z.infer<typeof PostInputSchema>;
export type CommentInput = z.infer<typeof CommentInputSchema>;
export type GroupInput = z.infer<typeof GroupInputSchema>;
