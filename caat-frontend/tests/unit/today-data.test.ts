import { describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

vi.mock("@/lib/unified-deadlines", () => ({ fetchUnifiedDeadlines: vi.fn().mockResolvedValue([]) }));

import { loadToday, resolveTimeZone, sydneyHour, sydneyTodayISO, zonedHour, zonedTodayISO } from "@/lib/today-data";

describe("Sydney time", () => {
  it("uses the Australian date, not the server's UTC date", () => {
    // 2026-10-06 14:30 UTC is already 7 October in Sydney (AEDT, UTC+11).
    const now = new Date("2026-10-06T14:30:00Z");
    expect(sydneyTodayISO(now)).toBe("2026-10-07");
    expect(sydneyHour(now)).toBe(1);
  });
});

describe("student time zone", () => {
  it("uses the reported zone, falling back to Sydney when missing or invalid", () => {
    expect(resolveTimeZone("Australia/Perth")).toBe("Australia/Perth");
    expect(resolveTimeZone("Not/AZone")).toBe("Australia/Sydney");
    expect(resolveTimeZone(undefined)).toBe("Australia/Sydney");
  });

  it("gives Perth its own date and hour", () => {
    // 22:00 Tuesday in Perth is already Wednesday in Sydney.
    const now = new Date("2026-10-06T14:00:00Z");
    expect(zonedTodayISO("Australia/Perth", now)).toBe("2026-10-06");
    expect(zonedHour("Australia/Perth", now)).toBe(22);
    expect(zonedTodayISO("Australia/Sydney", now)).toBe("2026-10-07");
  });

  it("refuses to treat a failed read as an empty account", async () => {
    const client = createMockSupabase({ resolver: (ctx) => (ctx.table === "user_school_applications" ? { data: null, error: { message: "timeout" } } : { data: [], error: null }) });
    await expect(loadToday(client as never, "student-1")).rejects.toThrow("Could not load Today");
  });
});

describe("loadToday", () => {
  const rows: Record<string, unknown> = {
    profiles: { first_name: "Mia", year_level: "year_12", target_majors: ["Law"], onboarding_completed_at: null, onboarding_dismissed_at: null },
    user_school_applications: [{ id: "a1", school_id: 7, status: "applying", deadline_at: null, updated_at: "2026-10-05T00:00:00Z", schools: { name: "Harbourside University" } }],
    essay_drafts: [{ id: "d1", prompt_id: "p1", label: "Draft 2", school_id: null, updated_at: "2026-10-06T00:00:00Z" }],
    documents: [{ school_id: 7 }],
    user_bookmarked_scholarships: [{ scholarship_id: "s1", scholarships: { id: "s1", title: "Regional Engineering Scholarship" } }],
    user_bookmarked_schools: [],
    user_bookmarked_majors: [{ major_id: "m1", majors: { id: "m1", name: "Law" } }],
    user_todos: [{ id: "t1", text: "Book open day", due_date: null, priority: 2 }],
    resumes: [{ id: "r1", title: "Main resume", updated_at: "2026-10-01T00:00:00Z" }],
    essay_prompts: [{ id: "p1", title: "Why this course" }],
    custom_essay_prompts: [],
  };
  const resolver = (ctx: QueryContext): QueryResult => ({ data: rows[ctx.table] ?? [], error: null });

  it("maps the student's data into Today's input, most recent work first", async () => {
    const client = createMockSupabase({ resolver });
    const data = await loadToday(client as never, "student-1", new Date("2026-10-07T01:00:00Z"));
    expect(data.firstName).toBe("Mia");
    expect(data.input.todayISO).toBe("2026-10-07");
    expect(data.input.onboarding).toEqual({ completed: false, dismissed: false, hasBasics: true });
    expect(data.input.applications).toEqual([{ id: "a1", schoolId: 7, schoolName: "Harbourside University", status: "applying", deadlineAt: null, updatedAt: "2026-10-05T00:00:00Z" }]);
    expect(data.input.essayDraftSchoolIds).toEqual([null]);
    expect(data.input.documentSchoolIds).toEqual([7]);
    expect(data.input.saved).toEqual({ scholarships: 1, schools: 0, majors: 1 });
    expect(data.recent.map((r) => r.kind)).toEqual(["essay", "application", "resume"]);
    expect(data.recent[0]).toMatchObject({ title: "Why this course", detail: "Essay", href: "/essays?prompt=p1" });
    expect(data.todos).toEqual([{ id: "t1", text: "Book open day", dueDate: null, priority: 2 }]);
    expect(data.savedPreview.map((s) => s.href)).toEqual(["/scholarships/s1", "/majors/m1"]);
  });

  it("scopes every personal read to the student and never selects essay or document contents", async () => {
    const client = createMockSupabase({ resolver });
    await loadToday(client as never, "student-1");
    const personal = ["profiles", "user_school_applications", "essay_drafts", "documents", "user_bookmarked_scholarships", "user_bookmarked_schools", "user_bookmarked_majors", "user_todos", "resumes", "custom_essay_prompts"];
    for (const q of client.queries.filter((q) => personal.includes(q.table))) {
      const scope = q.calls.filter((c) => c.method === "eq").map((c) => c.args);
      expect(scope, q.table).toContainEqual([q.table === "profiles" ? "id" : "user_id", "student-1"]);
      const selected = String(q.calls.find((c) => c.method === "select")?.args[0] ?? "");
      expect(selected, q.table).not.toMatch(/\bcontent\b|\*|storage_path|file_name/);
    }
  });

  it("treats a missing profile as a new student", async () => {
    const client = createMockSupabase({ resolver: (ctx) => (ctx.table === "profiles" ? { data: null, error: null } : { data: [], error: null }) });
    const data = await loadToday(client as never, "student-1");
    expect(data.firstName).toBeNull();
    expect(data.input.onboarding).toEqual({ completed: false, dismissed: false, hasBasics: false });
  });
});
