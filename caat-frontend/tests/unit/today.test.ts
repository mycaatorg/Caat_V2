import { describe, expect, it } from "vitest";
import { chooseNextStep, comingUp, daysBetween, deriveTasks, type TodayInput } from "@/lib/today";

const base = (patch: Partial<TodayInput> = {}): TodayInput => ({
  todayISO: "2026-10-07",
  onboarding: { completed: true, dismissed: false, hasBasics: true },
  applications: [],
  essayDraftSchoolIds: [],
  documentSchoolIds: [],
  saved: { scholarships: 0, schools: 0, majors: 0 },
  deadlines: [],
  ...patch,
});

const app = (id: string, patch: Partial<TodayInput["applications"][number]> = {}) => ({
  id,
  schoolId: Number(id.replace(/\D/g, "")) || 1,
  schoolName: `University ${id}`,
  status: "applying" as const,
  deadlineAt: "2026-12-01",
  updatedAt: null,
  ...patch,
});

describe("daysBetween", () => {
  it("counts whole calendar days and ignores time and DST", () => {
    expect(daysBetween("2026-10-07", "2026-10-07")).toBe(0);
    expect(daysBetween("2026-10-03", "2026-10-05T23:59:00+11:00")).toBe(2);
    expect(daysBetween("2026-10-07", "2026-10-05")).toBe(-2);
  });
});

describe("deriveTasks", () => {
  it("asks for a missing deadline on an active application", () => {
    const tasks = deriveTasks(base({ applications: [app("a1", { status: "researching", deadlineAt: null })] }));
    expect(tasks.map((t) => t.kind)).toEqual(["set-deadline"]);
    expect(tasks[0]).toMatchObject({ title: "Add the deadline for University a1", href: "/applications/a1" });
  });

  it("puts deadlines within 14 days first, nearest first, including overdue ones", () => {
    const tasks = deriveTasks(
      base({
        applications: [
          app("a1", { deadlineAt: "2026-10-20" }),
          app("a2", { deadlineAt: "2026-10-05" }),
          app("a3", { deadlineAt: null, status: "researching" }),
        ],
        essayDraftSchoolIds: [null],
        documentSchoolIds: [null],
      }),
    );
    expect(tasks.map((t) => t.id)).toEqual(["soon-a2", "soon-a1", "deadline-a3"]);
    expect(tasks[0].title).toBe("University a2 is 2 days overdue");
    expect(tasks[0].detail).toMatch(/closing date has passed/);
    expect(tasks[1].title).toBe("University a1 is due in 13 days");
  });

  it("does not flag deadlines further than 14 days away", () => {
    const tasks = deriveTasks(base({ applications: [app("a1", { deadlineAt: "2026-10-22" })], essayDraftSchoolIds: [null], documentSchoolIds: [null] }));
    expect(tasks).toEqual([]);
  });

  it("uses the hub rule for essays and documents: shared or tagged to this school", () => {
    const applications = [app("a1", { schoolId: 7 }), app("a2", { schoolId: 8 })];
    const tasks = deriveTasks(base({ applications, essayDraftSchoolIds: [7], documentSchoolIds: [8] }));
    expect(tasks.map((t) => t.id).sort()).toEqual(["docs-a1", "essay-a2"]);
    expect(tasks.find((t) => t.id === "essay-a2")!.href).toBe("/essays?school=8");
    expect(tasks.find((t) => t.id === "docs-a1")!.href).toBe("/documents?school=7");
  });

  it("only asks for essays and documents once the student is applying", () => {
    expect(deriveTasks(base({ applications: [app("a1", { status: "researching" })] }))).toEqual([]);
  });

  it.each(["submitted", "decision_pending", "accepted", "rejected", "waitlisted", "withdrawn"] as const)(
    "creates no tasks for a %s application",
    (status) => {
      expect(deriveTasks(base({ applications: [app("a1", { status, deadlineAt: null })] }))).toEqual([]);
    },
  );
});

describe("scholarship deadlines", () => {
  const sch = (id: string, dateISO: string) => ({ id: `sch-${id}`, source: "scholarship" as const, title: `Award ${id}`, dateISO, href: "/scholarships" });

  it("turns a saved scholarship closing within 14 days into a task until the student acts on it", () => {
    const tasks = deriveTasks(
      base({
        deadlines: [sch("s1", "2026-10-16"), sch("s2", "2026-10-30"), sch("s3", "2026-10-10")],
        scholarshipStatuses: { s1: "interested", s2: "interested", s3: "applied" },
      }),
    );
    expect(tasks).toEqual([
      expect.objectContaining({ id: "soon-sch-s1", kind: "deadline-soon", title: "Award s1 closes in 9 days", href: "/scholarships/s1" }),
    ]);
  });

  it("orders scholarship and application deadlines together, nearest first", () => {
    const tasks = deriveTasks(
      base({
        applications: [app("a1", { deadlineAt: "2026-10-12" })],
        essayDraftSchoolIds: [null],
        documentSchoolIds: [null],
        deadlines: [sch("s1", "2026-10-08")],
        scholarshipStatuses: { s1: "interested" },
      }),
    );
    expect(tasks.map((t) => t.id)).toEqual(["soon-sch-s1", "soon-a1"]);
    expect(tasks[0].title).toBe("Award s1 closes tomorrow");
  });
});

describe("comingUp", () => {
  it("keeps today through 60 days ahead, nearest first", () => {
    const d = (id: string, dateISO: string) => ({ id, source: "event" as const, title: id, dateISO, href: "/x" });
    const result = comingUp(base({ deadlines: [d("late", "2026-12-06"), d("past", "2026-10-06"), d("far", "2026-12-07"), d("now", "2026-10-07")] }));
    expect(result.map((r) => r.id)).toEqual(["now", "late"]);
  });
});

describe("chooseNextStep", () => {
  it("offers onboarding to a brand new student", () => {
    const step = chooseNextStep(base({ onboarding: { completed: false, dismissed: false, hasBasics: false } }));
    expect(step).toMatchObject({ kind: "onboarding", href: "/welcome" });
  });

  it("does not push onboarding once dismissed, or when the profile already has the basics", () => {
    for (const onboarding of [
      { completed: false, dismissed: true, hasBasics: false },
      { completed: false, dismissed: false, hasBasics: true },
    ]) {
      expect(chooseNextStep(base({ onboarding })).kind).toBe("first-save");
    }
  });

  it("moves from saving to applying to the most urgent task", () => {
    expect(chooseNextStep(base({ saved: { scholarships: 1, schools: 0, majors: 0 } })).kind).toBe("save-university");
    expect(chooseNextStep(base({ saved: { scholarships: 1, schools: 1, majors: 0 } })).kind).toBe("start-application");
    const step = chooseNextStep(base({ applications: [app("a1", { deadlineAt: null, status: "researching" })] }));
    expect(step).toMatchObject({ kind: "task", title: "Add the deadline for University a1", href: "/applications/a1" });
  });

  it("points at the nearest deadline when nothing needs doing", () => {
    const step = chooseNextStep(
      base({
        applications: [app("a1", { status: "submitted" })],
        deadlines: [{ id: "e1", source: "event", title: "Open day", dateISO: "2026-10-10", href: "/dashboard" }],
      }),
    );
    expect(step).toMatchObject({ kind: "deadline", title: "Open day is due in 3 days" });
  });

  it("says so plainly when there is nothing to do", () => {
    expect(chooseNextStep(base({ applications: [app("a1", { status: "submitted" })] })).kind).toBe("explore");
  });
});
