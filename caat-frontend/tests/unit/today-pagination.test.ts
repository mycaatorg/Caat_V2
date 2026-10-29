import { describe, expect, it } from "vitest";
import { createMockSupabase, type QueryContext } from "./mock-supabase";
import { fetchUnifiedDeadlines } from "@/lib/unified-deadlines";
import { loadToday } from "@/lib/today-data";
import { deriveTasks } from "@/lib/today";

const owner = "student-1";
const now = new Date("2026-10-29T01:00:00Z");
const rows = Array.from({ length: 125 }, (_, i) => ({
  id: `row-${i}`, school_id: i, schoolId: i, school_name: `University ${i}`,
  schools: { name: `University ${i}` }, status: "applied", deadline_at: "2026-11-01",
  scholarship_id: `row-${i}`, scholarships: { id: `row-${i}`, title: `Award ${i}`, deadline_at: "2026-11-01" },
  major_id: `row-${i}`, course_id: `row-${i}`, prompt_id: `row-${i}`,
  title: `Award ${i}`, event_date: "2026-11-01", text: `Task ${i}`, due_date: null,
}));
function offset(ctx: QueryContext) { return Number(ctx.calls.find(c => c.method === "range")?.args[0] ?? 0); }
function capped(ctx: QueryContext) {
  return rows.slice(offset(ctx), offset(ctx) + 50).map(row => ctx.table === "user_school_applications" ? { ...row, status: "applying" } : row);
}

const sources = ["user_school_applications", "user_bookmarked_scholarships", "calendar_events", "user_scholarships"];
describe("complete deadline sources", () => {
  it.each(sources)("reads all capped %s pages and scopes every request", async table => {
    const client = createMockSupabase({ resolver: ctx => ({ data: ctx.table === table ? capped(ctx) : [], error: null }) });
    const result = await fetchUnifiedDeadlines(client as never, owner, "2026-10-29");
    expect(result).toHaveLength(125);
    expect(new Set(result.map(r => r.id)).size).toBe(125);
    const queries = client.queries.filter(q => q.table === table);
    expect(queries.map(offset)).toEqual([0, 50, 100, 125]);
    for (const q of queries) {
      expect(q.calls).toContainEqual({ method: "eq", args: ["user_id", owner] });
      expect(q.calls).toContainEqual({ method: "order", args: [table === "user_bookmarked_scholarships" ? "scholarship_id" : "id"] });
    }
  });
  it.each(["error", "null"])("rejects a late %s rather than showing a partial feed", async mode => {
    const client = createMockSupabase({ resolver: ctx => ctx.table !== "user_scholarships" ? {data:[],error:null}
      : offset(ctx) === 0 ? {data:rows.slice(0,50),error:null} : {data:null,error:mode === "error" ? {message:"private failure"} : null} });
    await expect(fetchUnifiedDeadlines(client as never,owner,"2026-10-29")).rejects.toThrow("Could not load deadlines");
  });
});

const collections = ["user_school_applications", "essay_drafts", "documents", "user_bookmarked_scholarships", "user_bookmarked_schools", "user_bookmarked_majors", "user_course_bookmarks", "essay_prompts", "user_todos"];
describe("complete Today inputs", () => {
  it("counts all saves, keeps late scholarship statuses and loads every open task/preparation row", async () => {
    const client = createMockSupabase({ resolver: ctx => ({data:collections.includes(ctx.table) ? capped(ctx) : ctx.table === "profiles" ? null : [],error:null}) });
    const data = await loadToday(client as never, owner, now);
    expect(data.input.saved).toEqual({scholarships:125,schools:125,majors:125,courses:125});
    expect(data.input.applications).toHaveLength(125);
    expect(data.input.preparation.drafts).toHaveLength(125);
    expect(data.input.preparation.documents).toHaveLength(125);
    expect(data.input.preparation.prompts).toHaveLength(125);
    expect(data.todos).toHaveLength(125);
    expect(data.input.scholarshipStatuses?.["row-124"]).toBe("applied");
    expect(deriveTasks(data.input).filter(t => t.id.startsWith("soon-sch-"))).toEqual([]);
    for (const q of client.queries.filter(q => collections.includes(q.table))) {
      if(q.table !== "essay_prompts") expect(q.calls).toContainEqual({method:"eq",args:["user_id",owner]});
      expect(q.calls.some(c => c.method === "order")).toBe(true);
    }
  });
  it.each(collections)("rejects a missing late %s page", async table => {
    const client = createMockSupabase({resolver: ctx => ctx.table === table
      ? offset(ctx) === 0 ? {data:rows.slice(0,50),error:null} : {data:null,error:null}
      : {data:ctx.table === "profiles" ? null : [],error:null}});
    await expect(loadToday(client as never,owner,now)).rejects.toThrow();
  });
});
