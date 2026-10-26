// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "./mock-supabase";
import { button, click, link, mountComponent, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({ createServerClient: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: io.createServerClient }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "Australia/Sydney" }) }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: io.refresh }), redirect: vi.fn() }));
vi.mock("@/components/PageHeader", () => ({ PageHeader: () => null }));
vi.mock("@/components/dashboard/api", () => ({ toggleTodo: vi.fn() }));
vi.mock("@/lib/course-preparation", () => ({ fetchCoursePreparation: async () => ({checks:[],courses:[]}) }));
vi.mock("@/lib/onboarding", () => ({ dismissOnboarding: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

vi.mock("@/components/today/task-editor", () => ({ TaskEditor: () => null }));

import TodayPage from "@/app/(main)/today/page";

afterEach(() => { unmountAll(); vi.clearAllMocks(); });

describe("Today deadline recovery", () => {
  it("renders the retry screen for a real feed failure, then shows the deadline after recovery", async () => {
    let failing = true;
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
    const client = createMockSupabase({ user: { id: "student-1" }, resolver: (ctx) => {
      if (ctx.table === "calendar_events") {
        return failing
          ? { data: null, error: { message: "deadline read unavailable" } }
          : { data: [{ id: "event-1", title: "University open day", event_date: date, time_start: null, time_end: null }], error: null };
      }
      return { data: ctx.table === "profiles" ? { first_name: "Mia", onboarding_completed_at: "2026-10-01" } : [], error: null };
    } });
    io.createServerClient.mockResolvedValue(client);
    await mountComponent(await TodayPage());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load Today");
    expect(document.body.textContent).not.toContain("No upcoming deadlines");
    await click(button("Try again"));
    expect(io.refresh).toHaveBeenCalledTimes(1);

    failing = false;
    unmountAll();
    await mountComponent(await TodayPage());
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent).toContain("University open day");
  });

  it("lets a student reach the eleventh task through View all and Next page", async () => {
    window.history.replaceState(null, "", "/today");
    const tasks = Array.from({ length: 11 }, (_, i) => ({ id: `todo-${i}`, text: `Campus task ${i + 1}`, due_date: null, priority: 2 }));
    const client = createMockSupabase({ user: { id: "student-1" }, resolver: (ctx) => {
      if (ctx.table === "user_todos") {
        const limit = ctx.calls.find((c) => c.method === "limit")?.args[0] as number | undefined;
        return { data: limit ? tasks.slice(0, limit) : tasks, error: null };
      }
      return { data: ctx.table === "profiles" ? { onboarding_completed_at: "2026-10-01" } : [], error: null };
    } });
    io.createServerClient.mockResolvedValue(client);
    await mountComponent(await TodayPage());
    expect(document.body.textContent).not.toContain("Campus task 11");
    await click(link("View all to-dos"));
    await click(button("Next page"));
    expect(document.body.textContent).toContain("Campus task 11");
    expect(window.location.search).toBe("?view=todos&page=2");
    const html = renderToStaticMarkup(await TodayPage({ searchParams: Promise.resolve({ view: "todos", page: "2" }) }));
    expect(html).toContain("Campus task 11");
    expect(html).not.toContain("Your next step");
    expect(html).not.toContain("Campus task 10");
  });
});
