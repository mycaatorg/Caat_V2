import { describe, it, expect } from "vitest";
import {
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

  it("links an application deadline to that application's hub, not the list", () => {
    const result = mergeDeadlines(
      [
        { id: "0b7f3c1e-app", school_name: "Uni A", deadline_at: "2026-06-01", status: "applying" },
        { id: "9a2d-app", school_name: "Uni B", deadline_at: "2026-06-02", status: "submitted" },
      ],
      [{ id: "s1", title: "Schol", deadline_at: "2026-06-03" }],
      [{ id: "e1", title: "Event", event_date: "2026-06-04" }],
      "2026-05-21"
    );
    expect(result.map((r) => r.href)).toEqual([
      "/applications/0b7f3c1e-app",
      "/applications/9a2d-app",
      "/scholarships/s1",
      "/dashboard",
    ]);
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
