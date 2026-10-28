import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { loadCalendarDeadlines } from "@/lib/deadline-calendar-data";
import { CALENDAR_ERROR, serializeDeadlineCalendar } from "@/lib/deadline-calendar";
import { resolveTimeZone, TIME_ZONE_COOKIE, zonedTodayISO } from "@/lib/today-data";
const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    const client = await createServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return Response.json({ error: "Please sign in to download your deadlines." }, {status:401, headers:PRIVATE});
    const now = new Date();
    const zone = resolveTimeZone((await cookies()).get(TIME_ZONE_COOKIE)?.value);
    const rows = await loadCalendarDeadlines(client, user.id, zonedTodayISO(zone, now));
    if (!rows.length) return new Response(null, {status:204, headers:PRIVATE});
    return new Response(serializeDeadlineCalendar(rows, user.id, now), { headers: {
      ...PRIVATE, "Content-Type":"text/calendar; charset=utf-8", "Content-Disposition":'attachment; filename="caat-deadlines.ics"',
    }});
  } catch {
    return Response.json({error:CALENDAR_ERROR}, {status:500, headers:PRIVATE});
  }
}
