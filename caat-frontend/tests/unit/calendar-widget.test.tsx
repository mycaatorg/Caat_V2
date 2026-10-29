// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";
import { button, change, click, mountComponent, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({ client: null as unknown, user: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ get supabase() { return io.client; } }));
vi.mock("@/lib/current-user", () => ({ getClientUserId: io.user }));
vi.mock("@/components/ui/calendar", () => ({ Calendar: () => null, CalendarDayButton: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
import { toast } from "sonner";
import { CalendarWidget } from "@/components/dashboard/widgets/CalendarWidget";

const day = new Intl.DateTimeFormat("en-CA").format(new Date());
const events = Array.from({ length: 125 }, (_, i) => ({ id: `event-${i}`, title: `Event ${i}`, event_date: day, time_start: null, time_end: null, description: null, location: null, is_online: false }));
const offset = (ctx: QueryContext) => Number(ctx.calls.find(c => c.method === "range")?.args[0] ?? 0);
const editable = (ctx: QueryContext) => ctx.table === "calendar_events" && String(ctx.calls.find(c => c.method === "select")?.args[0]).includes("description");
function client(resolve?: (ctx: QueryContext) => QueryResult | undefined) {
  const result = createMockSupabase({ resolver: ctx => resolve?.(ctx) ?? { data: ctx.table === "calendar_events" ? events.slice(offset(ctx), offset(ctx) + 50) : [], error: null } });
  io.client = result; io.user.mockResolvedValue("student-1"); return result;
}
afterEach(() => { unmountAll(); vi.clearAllMocks(); });

describe("calendar complete reads and recovery", () => {
  it("shows events beyond a short server cap with owner filters and unique order", async () => {
    const db = client(); await mountComponent(<CalendarWidget />);
    expect(document.body.textContent).toContain("Event 124");
    for (const q of db.queries.filter(editable)) {
      expect(q.calls).toContainEqual({ method: "eq", args: ["user_id", "student-1"] });
      expect(q.calls).toContainEqual({ method: "order", args: ["id"] });
    }
    expect(db.queries.filter(editable).map(offset)).toEqual([0, 50, 100, 125]);
  });
  it("rejects partial events on a failed later page, then retries the complete list", async () => {
    let broken = true;
    client(ctx => editable(ctx) && offset(ctx) > 0 && broken ? { data: null, error: { message: "private backend detail" } } : undefined);
    await mountComponent(<CalendarWidget />);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not load calendar events");
    expect(document.body.textContent).not.toContain("Event 0");
    expect(document.body.textContent).not.toContain("Nothing on this date");
    expect(document.body.textContent).not.toContain("private backend detail");
    broken = false; await click(button("Retry calendar"));
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent).toContain("Event 124");
  });
  it("keeps loaded events and explains unavailable deadline markers until retry succeeds", async () => {
    let broken = true;
    client(ctx => ctx.table === "user_scholarships" ? broken ? { data: null, error: { message: "unavailable" } }
      : { data: offset(ctx) ? [] : [{ id: "award", title: "Recovered award", deadline_at: day, status: "interested" }], error: null } : undefined);
    await mountComponent(<CalendarWidget />);
    expect(document.body.textContent).toContain("Event 124");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not load deadlines");
    broken = false; await click(button("Retry calendar"));
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.textContent).toContain("Recovered award");
  });
  it("does not show an empty calendar or allow writes before authentication finishes", async () => {
    client();
    let finish!: (value: string) => void;
    io.user.mockImplementation(() => new Promise<string>(resolve => { finish = resolve; }));
    await mountComponent(<CalendarWidget />);
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Loading calendar");
    expect(button("Add event").disabled).toBe(true);
    expect(document.body.textContent).not.toContain("Nothing on this date");
    const { act } = await import("react");
    await act(async () => { finish("student-1"); });
    expect(button("Add event").disabled).toBe(false);
  });
  it("prevents retry from racing an in-flight event deletion", async () => {
    client(ctx => ctx.table === "user_scholarships" ? { data: null, error: { message: "unavailable" } } : undefined);
    await mountComponent(<CalendarWidget />);
    let finish!: (value: string) => void;
    io.user.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve; }));
    await click(button("Delete event"));
    expect(button("Retry calendar").disabled).toBe(true);
    const { act } = await import("react");
    await act(async () => { finish("student-1"); });
    expect(button("Retry calendar").disabled).toBe(false);
    expect(document.body.textContent).not.toContain("Event 0");
  });
  it.each(["auth", "insert", "update"])("unlocks retry and preserves the draft after a rejected %s during save", async failure => {
    client(ctx => {
      if (ctx.table === "calendar_events" && ctx.op === failure) throw new Error("private write failure");
      return ctx.table === "user_scholarships" ? { data: null, error: { message: "unavailable" } } : undefined;
    });
    await mountComponent(<CalendarWidget />);
    await click(button(failure === "update" ? "Edit event" : "Add event"));
    const title = document.querySelector<HTMLInputElement>('input[placeholder="e.g. SAT Exam"]')!;
    await change(title, "Keep this event draft");
    if (failure === "auth") io.user.mockRejectedValueOnce(new Error("private auth failure"));
    const saveLabel = failure === "update" ? "Update" : "Save";
    await click(button(saveLabel));
    expect(button("Retry calendar").disabled).toBe(false);
    expect(button(saveLabel).disabled).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(failure === "update" ? "Could not update event." : "Could not save event.");
    expect(title.value).toBe("Keep this event draft");
    expect(document.body.textContent).not.toContain("private auth failure");
  });
  it("handles authentication rejection as a recoverable calendar failure", async () => {
    client(); io.user.mockRejectedValue(new Error("private auth failure"));
    await mountComponent(<CalendarWidget />);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Could not load your calendar");
    expect(document.body.textContent).not.toContain("Nothing on this date");
    expect(document.body.textContent).not.toContain("private auth failure");
    expect(button("Retry calendar")).toBeTruthy();
  });
});
