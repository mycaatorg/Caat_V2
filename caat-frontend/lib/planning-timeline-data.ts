import type { SupabaseClient } from '@supabase/supabase-js';
import { evidencePages } from '@/lib/evidence-pagination';
import { fetchUnifiedDeadlines } from '@/lib/unified-deadlines';
import { createTimeline, TIMELINE_ERROR, type TimelineTask } from '@/lib/planning-timeline';
export async function loadPlanningTimeline(client:SupabaseClient,userId:string,today:string) {
 try {
  const [deadlines,tasks]=await Promise.all([
   fetchUnifiedDeadlines(client,userId,today),
   evidencePages<TimelineTask>((from,to)=>client.from('user_todos').select('id, text, due_date').eq('user_id',userId).eq('done',false).order('due_date',{ascending:true,nullsFirst:false}).order('id',{ascending:true}).range(from,to),TIMELINE_ERROR),
  ]);
  return createTimeline(deadlines,tasks,today);
 } catch { throw new Error(TIMELINE_ERROR); }
}
