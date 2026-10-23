/**
 * PROD-148: the one way a click starts tracking an application at a university.
 * Shared by the Shortlist university row, saved course rows and /courses cards,
 * so every entry point agrees. It only ever runs on an explicit click.
 *
 * `user_school_applications` is unique per (user_id, school_id). If another tab
 * or another row already created it, the insert fails with 23505; that is the
 * outcome the student asked for, so the existing row is read and returned with
 * `created: false`. Anything else throws the sanitised message.
 */
import {
  ApplicationWriteError,
  addApplication,
  fetchApplicationForSchool,
} from "@/app/(main)/applications/api";
import type { ApplicationStatus } from "@/types/applications";

export type SchoolApplication = { id: string; status: ApplicationStatus };

export async function startApplicationForSchool(
  schoolId: number
): Promise<{ application: SchoolApplication; created: boolean }> {
  try {
    const row = await addApplication(schoolId);
    return { application: { id: row.id, status: row.status }, created: true };
  } catch (error) {
    if (!(error instanceof ApplicationWriteError) || error.code !== "23505") throw error;
    const row = await fetchApplicationForSchool(schoolId);
    if (!row) throw new Error("Could not find your application. Please try again.");
    return { application: { id: row.id, status: row.status }, created: false };
  }
}
