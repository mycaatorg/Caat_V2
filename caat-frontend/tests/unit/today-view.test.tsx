// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { click, deferred, flush, hasText, link, mountComponent, queryAll, queryButton, queryLink, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({ toggleTodo: vi.fn(), dismiss: vi.fn(), track: vi.fn(), refresh: vi.fn(), toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: io.refresh }) }));
vi.mock("@/components/dashboard/api", () => ({ toggleTodo: io.toggleTodo }));
vi.mock("@/lib/onboarding", () => ({ dismissOnboarding: io.dismiss }));
vi.mock("@vercel/analytics", () => ({ track: io.track }));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...rest }: React.PropsWithChildren<{ href: string; onClick?: () => void }>) => (
    <a href={href} onClick={(e) => { e.preventDefault(); onClick?.(); }} {...rest}>{children}</a>
  ),
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ onCheckedChange, ...rest }: { onCheckedChange: (v: boolean) => void } & Record<string, unknown>) => (
    <input type="checkbox" {...(rest as object)} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));

import { TodayLoadError, TodayView, type TodayViewProps } from "@/components/today/TodayView";

const props = (patch: Partial<TodayViewProps> = {}): TodayViewProps => ({
  name: "Mia",
  hour: 15,
  todayISO: "2026-10-07",
  nextStep: { kind: "task", title: "Add the deadline for Harbourside University", body: "Deadlines drive reminders.", cta: "Do this now", href: "/applications/a1" },
  tasks: [{ id: "deadline-a1", kind: "set-deadline", title: "Add the deadline for Harbourside University", detail: "Deadlines drive reminders.", href: "/applications/a1" }],
  comingUp: [{ id: "app-a2", source: "app", title: "Banksia College", dateISO: "2026-10-10", href: "/applications" }],
  recent: [{ kind: "essay", title: "Why engineering", detail: "Draft 1", href: "/essays?prompt=p1", updatedAt: "2026-10-06T10:00:00Z" }],
  todos: [
    { id: "t1", text: "Ask Ms Lee for a reference", dueDate: "2026-10-05", priority: 1 },
    { id: "t2", text: "Book open day", dueDate: null, priority: 2 },
  ],
  saved: { scholarships: 2, schools: 1, majors: 0 },
  savedPreview: [{ kind: "scholarship", id: "s1", title: "Regional Engineering Scholarship", href: "/scholarships/s1" }],
  showOnboardingNudge: false,
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  io.toggleTodo.mockResolvedValue(undefined);
  io.dismiss.mockResolvedValue(undefined);
});
afterEach(() => unmountAll());
beforeEach(() => window.history.replaceState(null, "", "/today"));

describe("Today", () => {
  it("greets the student and leads with one next step that links to its destination", async () => {
    await mountComponent(<TodayView {...props()} />);
    expect(document.querySelector("h1")?.textContent).toBe("Good afternoon, Mia");
    expect(hasText("Wednesday 7 October")).toBe(true);
    const cta = link(/Do this now/);
    expect(cta.getAttribute("href")).toBe("/applications/a1");
    await click(cta);
    expect(io.track).toHaveBeenCalledWith("today_next_step_clicked", { kind: "task" });
  });

  it("lists tasks, upcoming deadlines with day counts, recent work and the shortlist", async () => {
    await mountComponent(<TodayView {...props()} />);
    expect(link(/Add the deadline for Harbourside University/).getAttribute("href")).toBe("/applications/a1");
    expect(link(/Banksia College/).textContent).toContain("3 days");
    expect(link(/Why engineering/).getAttribute("href")).toBe("/essays?prompt=p1");
    expect(hasText("Edited yesterday", document.body) || document.body.textContent?.includes("Edited yesterday")).toBe(true);
    expect(link(/Regional Engineering Scholarship/).getAttribute("href")).toBe("/scholarships/s1");
    expect(document.body.textContent).toContain("2Scholarships");
    expect(document.body.textContent).toContain("1Universities");
    expect(document.body.textContent).toContain("0Courses");
  });

  it("explains empty sections instead of showing blank boxes", async () => {
    await mountComponent(<TodayView {...props({ tasks: [], comingUp: [], recent: [], todos: [], savedPreview: [], saved: { scholarships: 0, schools: 0, majors: 0 } })} />);
    expect(document.body.textContent).toContain("Nothing needs you right now.");
    expect(document.body.textContent).toContain("No deadlines in the next 60 days.");
    expect(document.body.textContent).toContain("No open to-dos.");
    expect(queryLink(/Why engineering/)).toBeNull();
  });

  it("keeps a completed to-do visible in place and restores it if the save fails", async () => {
    const save = deferred();
    io.toggleTodo.mockReturnValueOnce(save.promise);
    await mountComponent(<TodayView {...props()} />);
    expect(document.body.textContent).toContain("Overdue");
    const box = document.querySelector<HTMLInputElement>('input[aria-label="Mark \\"Ask Ms Lee for a reference\\" done"]')!;
    await click(box);
    expect(document.body.textContent).toContain("Ask Ms Lee for a reference");
    expect(box.checked).toBe(true);
    expect(box.closest("li")?.className).toContain("opacity");
    expect(box.disabled).toBe(true);
    expect(io.toggleTodo).toHaveBeenCalledWith("t1", true);
    await act(async () => save.reject(new Error("offline")));
    await flush();
    expect(document.body.textContent).toContain("Ask Ms Lee for a reference");
    expect(box.checked).toBe(false);
    expect(io.toast.error).toHaveBeenCalled();
  });

  it("offers Undo after saving a completion and persists the restore", async () => {
    await mountComponent(<TodayView {...props()} />);
    const box = document.querySelector<HTMLInputElement>('input[aria-label="Mark \\"Ask Ms Lee for a reference\\" done"]')!;
    await click(box);
    await flush();

    expect(box.checked).toBe(true);
    expect(io.toast.success).toHaveBeenCalled();
    const action = io.toast.success.mock.calls[0][1].action;
    await act(async () => action.onClick());
    await flush();

    expect(box.checked).toBe(false);
    expect(io.toggleTodo).toHaveBeenNthCalledWith(1, "t1", true);
    expect(io.toggleTodo).toHaveBeenNthCalledWith(2, "t1", false);

    await click(box);
    await flush();
    await action.onClick();
    await flush();
    expect(box.checked).toBe(true);
    expect(io.toggleTodo).toHaveBeenNthCalledWith(3, "t1", true);
  });

  it("rolls back a failed Undo and hides the completed task on a fresh visit", async () => {
    await mountComponent(<TodayView {...props()} />);
    const box = document.querySelector<HTMLInputElement>('input[aria-label="Mark \\"Ask Ms Lee for a reference\\" done"]')!;
    await click(box);
    await flush();
    const undo = io.toast.success.mock.calls[0][1].action;

    const restore = deferred();
    io.toggleTodo.mockReturnValueOnce(restore.promise);
    await act(async () => undo.onClick());
    await flush();
    expect(box.checked).toBe(false);
    expect(box.disabled).toBe(true);

    await act(async () => restore.reject(new Error("offline")));
    await flush();
    expect(box.checked).toBe(true);
    expect(io.toast.error).toHaveBeenCalled();

    unmountAll();
    await mountComponent(<TodayView {...props({ todos: [] })} />);
    expect(document.body.textContent).not.toContain("Ask Ms Lee for a reference");
    expect(document.body.textContent).toContain("No open to-dos.");
  });

  it("offers onboarding once as a dismissible note when it is not already the next step", async () => {
    await mountComponent(<TodayView {...props({ showOnboardingNudge: true })} />);
    expect(link(/Start/).getAttribute("href")).toBe("/welcome");
    await click(document.querySelector('button[aria-label="Not now"]') as HTMLButtonElement);
    expect(io.dismiss).toHaveBeenCalledTimes(1);
    expect(queryLink(/^Start/)).toBeNull();
  });

  it("reports the browser's time zone once and refreshes when the server used another", async () => {
    sessionStorage.clear();
    document.cookie = "caat-tz=; max-age=0; path=/";
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await mountComponent(<TodayView {...props({ timeZone: zone === "Australia/Perth" ? "Australia/Sydney" : "Australia/Perth" })} />);
    expect(document.cookie).toContain(`caat-tz=${encodeURIComponent(zone)}`);
    expect(io.refresh).toHaveBeenCalledTimes(1);
    unmountAll();
    await mountComponent(<TodayView {...props({ timeZone: zone === "Australia/Perth" ? "Australia/Sydney" : "Australia/Perth" })} />);
    expect(io.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when the server already used the browser's zone", async () => {
    await mountComponent(<TodayView {...props({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })} />);
    expect(io.refresh).not.toHaveBeenCalled();
  });

  it("shows a retry instead of an empty Today when data cannot load", async () => {
    await mountComponent(<TodayLoadError />);
    expect(document.body.textContent).toContain("Couldn't load Today.");
    await click([...document.querySelectorAll("button")].find((b) => b.textContent === "Try again")!);
    expect(io.refresh).toHaveBeenCalled();
  });

  it("does not repeat the onboarding note when onboarding is the next step", async () => {
    await mountComponent(
      <TodayView {...props({ showOnboardingNudge: true, nextStep: { kind: "onboarding", title: "Tell us where you are up to", body: "", cta: "Get started", href: "/welcome" } })} />,
    );
    expect(document.querySelector('button[aria-label="Not now"]')).toBeNull();
  });

  it("caps each Today preview while keeping the section counts available", async () => {
    const many = (count: number) => Array.from({ length: count }, (_, i) => i + 1);
    await mountComponent(<TodayView {...props({
      tasks: many(8).map((i) => ({ id: `task-${i}`, kind: "set-deadline" as const, title: `Task ${i}`, detail: "Add a deadline", href: `/applications/${i}` })),
      comingUp: many(24).map((i) => ({ id: `event-${i}`, source: "app" as const, title: `Event ${i}`, dateISO: "2026-10-10", href: `/applications/${i}` })),
      recent: many(8).map((i) => ({ kind: "essay" as const, title: `Recent ${i}`, detail: "Draft", href: `/essays/${i}`, updatedAt: "2026-10-06T10:00:00Z" })),
      todos: many(8).map((i) => ({ id: `todo-${i}`, text: `To-do ${i}`, dueDate: null, priority: 1 })),
      savedPreview: many(8).map((i) => ({ kind: "scholarship" as const, id: `saved-${i}`, title: `Saved ${i}`, href: `/scholarships/${i}` })),
    })} />);

    expect(document.querySelector('[aria-label="Needs attention"] ul')?.children.length).toBe(3);
    expect(document.querySelector('[aria-label="Coming up"] ul')?.children.length).toBe(4);
    expect(document.querySelector('[aria-label="Recent work"] ul')?.children.length).toBe(3);
    expect(document.querySelector('[aria-label="Your to-dos"] ul')?.children.length).toBe(3);
    expect(document.querySelector('[aria-label="My shortlist"] ul')?.children.length).toBe(3);
    expect(queryLink("View all Needs attention")).not.toBeNull();
    expect(queryLink("View all Coming up")).not.toBeNull();
    expect(queryLink("View all Recent work")).not.toBeNull();
    expect(queryLink("View all to-dos")).not.toBeNull();
  });

  it("opens a focused upcoming list and pages through items beyond the preview", async () => {
    const comingUp = Array.from({ length: 24 }, (_, i) => ({
      id: `event-${i + 1}`, source: "app" as const, title: `Event ${i + 1}`, dateISO: "2026-10-10", href: `/applications/${i + 1}`,
    }));
    await mountComponent(<TodayView {...props({ comingUp })} />);

    await click(link("View all Coming up"));
    expect(document.querySelector("h1")?.textContent).toBe("Coming up");
    expect(document.querySelector('[aria-label="Coming up"] ul')?.children.length).toBe(10);
    expect(document.body.textContent).toContain("Event 10");
    expect(document.body.textContent).not.toContain("Good afternoon");
    expect(window.location.search).toBe("?view=upcoming&page=1");

    await click(queryButton("Next page")!);
    expect(document.querySelector('[aria-label="Coming up"] ul')?.children.length).toBe(10);
    expect(document.body.textContent).toContain("Event 11");
    expect(document.body.textContent).toContain("Page 2 of 3");
    expect(window.location.search).toBe("?view=upcoming&page=2");
  });

  it("restores a focused list and clamps an out-of-range URL page", async () => {
    const comingUp = Array.from({ length: 24 }, (_, i) => ({
      id: `event-${i + 1}`, source: "app" as const, title: `Event ${i + 1}`, dateISO: "2026-10-10", href: `/applications/${i + 1}`,
    }));
    window.history.replaceState(null, "", "/today?view=upcoming&page=9");
    await mountComponent(<TodayView {...props({ comingUp })} />);

    expect(document.querySelector("h1")?.textContent).toBe("Coming up");
    expect(document.querySelector('[aria-label="Coming up"] ul')?.children.length).toBe(4);
    expect(document.body.textContent).toContain("Event 24");
    expect(document.body.textContent).toContain("Page 3 of 3");
    expect(window.location.search).toBe("?view=upcoming&page=3");
  });

  it("keeps completed to-dos visible on the final page while a save is pending", async () => {
    const todos = Array.from({ length: 11 }, (_, i) => ({ id: `todo-${i + 1}`, text: `To-do ${i + 1}`, dueDate: null, priority: 1 }));
    const save = deferred();
    io.toggleTodo.mockReturnValueOnce(save.promise);
    window.history.replaceState(null, "", "/today?view=todos&page=2");
    await mountComponent(<TodayView {...props({ todos })} />);
    expect(document.body.textContent).toContain("To-do 11");

    await click(queryAll("input", 'Mark "To-do 11" done')[0]);
    expect(document.body.textContent).toContain("Page 2 of 2");
    expect(document.body.textContent).toContain("To-do 11");
    expect(document.querySelector<HTMLInputElement>('input[id="todo-todo-11"]')?.checked).toBe(true);
    await act(async () => save.reject(new Error("offline")));
    await flush();
    expect(document.body.textContent).toContain("To-do 11");
    expect(window.location.search).toBe("?view=todos&page=2");
    expect(io.toast.error).toHaveBeenCalled();
    expect((queryAll("input", 'Mark "To-do 11" done')[0] as HTMLInputElement).checked).toBe(false);
  });

  it("keeps the last completed to-do on its page", async () => {
    const todos = Array.from({ length: 11 }, (_, i) => ({ id: `todo-${i + 1}`, text: `To-do ${i + 1}`, dueDate: null, priority: 1 }));
    window.history.replaceState(null, "", "/today?view=todos&page=2");
    await mountComponent(<TodayView {...props({ todos })} />);
    await click(queryAll("input", 'Mark "To-do 11" done')[0]);

    expect(document.body.textContent).toContain("Page 2 of 2");
    expect(document.body.textContent).toContain("To-do 11");
    expect(window.location.search).toBe("?view=todos&page=2");
    expect(io.toggleTodo).toHaveBeenCalledWith("todo-11", true);
  });
});
