import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { calendarPages } from "@/lib/deadline-calendar";
import { mergeDeadlines, type RawAppDeadline, type RawScholarshipDeadline } from "@/lib/unified-deadlines";

/** Only due-date fields are selected. No account profile, essays, files or notes. */
export async function loadCalendarDeadlines(client: SupabaseClient<Database>, userId: string, today: string) {
  const [applications, bookmarks, personal] = await Promise.all([
    calendarPages((from, to) => client.from("user_school_applications").select("id, deadline_at, status, schools(name)").eq("user_id", userId).not("deadline_at", "is", null).order("id").range(from, to)),
    calendarPages((from, to) => client.from("user_bookmarked_scholarships").select("scholarship_id, scholarships(id, title, deadline_at)").eq("user_id", userId).order("scholarship_id").range(from, to)),
    calendarPages((from, to) => client.from("user_scholarships").select("id, title, deadline_at, status").eq("user_id", userId).not("deadline_at", "is", null).order("id").range(from, to)),
  ]);
  const apps: RawAppDeadline[] = applications.flatMap(r => r.deadline_at && r.schools ? [{id:r.id,school_name:r.schools.name,deadline_at:r.deadline_at,status:r.status}] : []);
  const saved: RawScholarshipDeadline[] = bookmarks.flatMap(r => r.scholarships?.deadline_at ? [{id:r.scholarships.id,title:r.scholarships.title,deadline_at:r.scholarships.deadline_at}] : []);
  const own: RawScholarshipDeadline[] = personal.flatMap(r => r.deadline_at ? [{id:r.id,title:r.title,deadline_at:r.deadline_at,...(r.status ? {status:r.status} : {})}] : []);
  return mergeDeadlines(apps, saved, [], today, own);
}
