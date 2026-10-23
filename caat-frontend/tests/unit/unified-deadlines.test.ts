import { describe, it, expect } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";
import {
  fetchUnifiedDeadlines,
  mergeDeadlines,
  type RawAppDeadline,
  type RawScholarshipDeadline,
  type RawEventDeadline,
} from "@/lib/unified-deadlines";

describe("mergeDeadlines()", () => {
  it("returns empty array when all sources are empty", () => {
    expect(mergeDeadlines([], [], [], "2026-05-21")).toEqual([]);
  });

  it("filters past-dated items relative to today", () => {
    const apps: RawAppDeadline[] = [
      { id: "a1", school_name: "Past Uni", deadline_at: "2026-05-01", status: "applying" },
      { id: "a2", school_name: "Future Uni", deadline_at: "2026-06-01", status: "applying" },
    ];
    const result = mergeDeadlines(apps, [], [], "2026-05-21");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Future Uni");
  });

  it("filters out apps with withdrawn or rejected status", () => {
    const apps: RawAppDeadline[] = [
      { id: "a1", school_name: "Withdrawn Uni", deadline_at: "2026-06-01", status: "withdrawn" },
      { id: "a2", school_name: "Rejected Uni", deadline_at: "2026-06-01", status: "rejected" },
      { id: "a3", school_name: "Active Uni", deadline_at: "2026-06-01", status: "applying" },
    ];
    const result = mergeDeadlines(apps, [], [], "2026-05-21");
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Active Uni");
  });

  it("merges all three sources and sorts by date ascending", () => {
    const apps: RawAppDeadline[] = [
      { id: "a1", school_name: "Late App", deadline_at: "2026-08-01", status: "applying" },
    ];
    const schols: RawScholarshipDeadline[] = [
      { id: "s1", title: "Mid Scholarship", deadline_at: "2026-07-01" },
    ];
    const events: RawEventDeadline[] = [
      { id: "e1", title: "Early Event", event_date: "2026-06-01" },
    ];
    const result = mergeDeadlines(apps, schols, events, "2026-05-21");
    expect(result.map((r) => r.title)).toEqual([
      "Early Event",
      "Mid Scholarship",
      "Late App",
    ]);
  });

  it("labels each item with its source", () => {
    const result = mergeDeadlines(
      [{ id: "a1", school_name: "Uni", deadline_at: "2026-06-01", status: "applying" }],
      [{ id: "s1", title: "Schol", deadline_at: "2026-06-02" }],
      [{ id: "e1", title: "Event", event_date: "2026-06-03" }],
      "2026-05-21"
    );
    expect(result[0].source).toBe("app");
    expect(result[1].source).toBe("scholarship");
    expect(result[2].source).toBe("event");
  });

  it("namespaces ids by source to avoid collisions", () => {
    const result = mergeDeadlines(
      [{ id: "1", school_name: "U", deadline_at: "2026-06-01", status: "applying" }],
      [{ id: "1", title: "S", deadline_at: "2026-06-02" }],
      [{ id: "1", title: "E", event_date: "2026-06-03" }],
      "2026-05-21"
    );
    expect(result.map((r) => r.id)).toEqual(["app-1", "sch-1", "evt-1"]);
  });

  it("preserves time_start/time_end on events", () => {
    const events: RawEventDeadline[] = [
      { id: "e1", title: "SAT", event_date: "2026-06-01", time_start: "09:00", time_end: "12:00" },
    ];
    const result = mergeDeadlines([], [], events, "2026-05-21");
    expect(result[0].timeStart).toBe("09:00");
    expect(result[0].timeEnd).toBe("12:00");
  });

  it("today's deadline counts as future (not filtered)", () => {
    const apps: RawAppDeadline[] = [
      { id: "a1", school_name: "Today Uni", deadline_at: "2026-05-21", status: "applying" },
    ];
    const result = mergeDeadlines(apps, [], [], "2026-05-21");
    expect(result).toHaveLength(1);
  });

  it("slices timestamptz scholarship deadline_at down to YYYY-MM-DD", () => {
    const schols: RawScholarshipDeadline[] = [
      { id: "s1", title: "S", deadline_at: "2026-06-15T23:59:59+00:00" },
    ];
    const result = mergeDeadlines([], schols, [], "2026-05-21");
    expect(result[0].dateISO).toBe("2026-06-15");
  });
});

describe("custom scholarship deadlines (PROD-146)", () => {
  const custom: RawScholarshipDeadline[] = [
    { id: "c1", title: "Rotary Club Bursary", deadline_at: "2026-06-02T00:00:00+00:00" },
    { id: "c2", title: "Expired Local Award", deadline_at: "2026-05-01T00:00:00+00:00" },
  ];

  it("merges the student's own scholarships with catalogue ones as a Custom source", () => {
    const result = mergeDeadlines(
      [{ id: "a1", school_name: "Uni", deadline_at: "2026-06-03", status: "applying" }],
      [{ id: "s1", title: "Catalogue Award", deadline_at: "2026-06-02T23:59:59+00:00" }],
      [{ id: "e1", title: "Open day", event_date: "2026-06-01" }],
      "2026-05-21",
      custom,
    );
    expect(result.map((r) => [r.id, r.source, r.dateISO])).toEqual([
      ["evt-e1", "event", "2026-06-01"],
      // Same day: catalogue first, then custom (stable merge order).
      ["sch-s1", "scholarship", "2026-06-02"],
      ["cus-c1", "custom", "2026-06-02"],
      ["app-a1", "app", "2026-06-03"],
    ]);
    expect(result.find((r) => r.source === "custom")).toEqual({
      id: "cus-c1",
      source: "custom",
      title: "Rotary Club Bursary",
      dateISO: "2026-06-02",
      href: "/scholarships?view=mine",
    });
  });

  it("keeps the student's own scholarship status on the custom row", () => {
    const result = mergeDeadlines([], [], [], "2026-05-21", [{ id: "c1", title: "Applied award", deadline_at: "2026-06-02", status: "applied" }]);
    expect(result).toStrictEqual([
      { id: "cus-c1", source: "custom", title: "Applied award", dateISO: "2026-06-02", href: "/scholarships?view=mine", status: "applied" },
    ]);
  });
});

describe("fetchUnifiedDeadlines() custom scholarships", () => {
  const ok = (ctx: QueryContext): QueryResult => {
    if (ctx.table === "user_scholarships") {
      return { data: [{ id: "c1", title: "Rotary Club Bursary", deadline_at: "2099-06-02T00:00:00+00:00", status: "applied" }, { id: "c2", title: "No date", deadline_at: null, status: "interested" }], error: null };
    }
    if (ctx.table === "user_bookmarked_scholarships") {
      return { data: [{ scholarship_id: "s1", scholarships: { id: "s1", title: "Catalogue Award", deadline_at: "2099-06-01T00:00:00+00:00" } }], error: null };
    }
    return { data: [], error: null };
  };

  it("reads only the student's own dated custom scholarships", async () => {
    const client = createMockSupabase({ resolver: ok });
    const result = await fetchUnifiedDeadlines(client as never, "student-1");
    expect(result.map((r) => r.id)).toEqual(["sch-s1", "cus-c1"]);
    // An applied custom scholarship stays in the feed (and calendar), carrying its status.
    expect(result[1].status).toBe("applied");
    const q = client.queries.find((q) => q.table === "user_scholarships");
    expect(q?.calls).toContainEqual({ method: "select", args: ["id, title, deadline_at, status"] });
    expect(q?.calls).toContainEqual({ method: "eq", args: ["user_id", "student-1"] });
    expect(q?.calls).toContainEqual({ method: "not", args: ["deadline_at", "is", null] });
  });

  it("treats a failed custom scholarship read as a load failure, not an empty list", async () => {
    const client = createMockSupabase({ resolver: (ctx) => (ctx.table === "user_scholarships" ? { data: null, error: { message: "timeout" } } : ok(ctx)) });
    await expect(fetchUnifiedDeadlines(client as never, "student-1")).rejects.toThrow("Could not load deadlines");
  });

  it("keeps the existing feed when the student has no custom scholarships", async () => {
    const client = createMockSupabase({ resolver: (ctx) => {
      if (ctx.table === "user_scholarships") return { data: [], error: null };
      if (ctx.table === "user_school_applications") {
        return { data: [{ id: "a1", deadline_at: "2099-06-03", status: "applying", schools: { name: "Harbourside University" } }], error: null };
      }
      if (ctx.table === "calendar_events") {
        return { data: [{ id: "e1", title: "Open day", event_date: "2099-06-01", time_start: null, time_end: null }], error: null };
      }
      return ok(ctx);
    } });
    const result = await fetchUnifiedDeadlines(client as never, "student-1");
    expect(result.map((r) => [r.id, r.source, r.dateISO, r.href])).toEqual([
      ["sch-s1", "scholarship", "2099-06-01", "/scholarships/s1"],
      ["evt-e1", "event", "2099-06-01", "/dashboard"],
      ["app-a1", "app", "2099-06-03", "/applications"],
    ]);
  });
});
