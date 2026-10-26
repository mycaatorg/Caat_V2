import { z } from 'zod';

export const ResumeSnapshotSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sections: z.array(z.object({ label: z.string().max(100), html: z.string().max(20000) })).min(1).max(20),
}).refine(value => JSON.stringify(value).length <= 100000, 'This resume is too large to share.');
export type ResumeSnapshot = z.infer<typeof ResumeSnapshotSchema>;
export const ResumeShareInputSchema = z.object({ post_id: z.string().uuid(), snapshot: ResumeSnapshotSchema });
export type ResumeShareInput = z.infer<typeof ResumeShareInputSchema>;
