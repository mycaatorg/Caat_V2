// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScholarshipTracking from "@/app/(main)/scholarships/[id]/ScholarshipTracking";

const io = vi.hoisted(() => ({ user: vi.fn(), result: vi.fn(), eq: vi.fn(), track: vi.fn(), untrack: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {
  auth: { getUser: io.user },
  from: () => { const query = { select: () => query, eq: (...args: unknown[]) => { io.eq(...args); return query; }, maybeSingle: io.result }; return query; },
} }));
vi.mock("@/lib/scholarship-tracking", async (original) => ({ ...(await original<object>()), trackScholarship: io.track, untrackScholarship: io.untrack }));
vi.mock("sonner", () => ({ toast: { error: io.error } }));
// Exercise the real control's state transitions; menu layout is Radix's concern.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div data-trigger>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: React.PropsWithChildren<{ onSelect: () => void }>) => <button onClick={onSelect}>{children}</button>,
  DropdownMenuSeparator: () => <hr />,
}));
let root: Root;
async function mount() {
  const container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ScholarshipTracking scholarshipId="scholarship-7" />));
}
function trigger() { return document.querySelector("[data-trigger] button") as HTMLButtonElement; }
function option(text: string) {
  const matches = [...document.querySelectorAll("button")].filter(b => b.textContent?.trim() === text);
  const button = matches.at(-1); if (!button) throw new Error(`Missing option: ${text}`); return button;
}
function deferred() {
  let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  io.user.mockResolvedValue({ data: { user: { id: "student-1" } } });
  io.result.mockResolvedValue({ data: null, error: null });
  io.track.mockResolvedValue(undefined); io.untrack.mockResolvedValue(undefined);
});
afterEach(() => { if (root) act(() => root.unmount()); document.body.innerHTML = ""; });

describe("Scholarship detail tracking", () => {
  it("asks a signed-out visitor to sign in without writing", async () => {
    io.user.mockResolvedValue({ data: { user: null } }); await mount();
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Save"]')!.click());
    expect(io.error).toHaveBeenCalledWith("Sign in to save scholarships.");
    expect(io.track).not.toHaveBeenCalled(); expect(io.result).not.toHaveBeenCalled();
  });
  it("loads the status scoped to this student and scholarship", async () => {
    io.result.mockResolvedValue({ data: { status: "applied" }, error: null }); await mount();
    expect(trigger().textContent).toBe("Applied");
    expect(io.eq.mock.calls).toEqual([["user_id", "student-1"], ["scholarship_id", "scholarship-7"]]);
  });
  it("treats a legacy saved row without status as Interested", async () => {
    io.result.mockResolvedValue({ data: { status: null }, error: null }); await mount();
    expect(trigger().textContent).toBe("Interested");
  });
  it("saves the selected lifecycle status and keeps it after success", async () => {
    const save = deferred(); io.track.mockReturnValue(save.promise); await mount();
    await act(async () => option("Applied").click());
    expect(trigger().textContent).toBe("Applied");
    expect(io.track).toHaveBeenCalledWith("scholarship-7", "applied");
    await act(async () => save.resolve()); expect(trigger().textContent).toBe("Applied");
  });
  it("restores the previous tracked status when an update fails", async () => {
    io.result.mockResolvedValue({ data: { status: "interested" }, error: null });
    const save = deferred(); io.track.mockReturnValue(save.promise); await mount();
    await act(async () => option("Awarded").click()); expect(trigger().textContent).toBe("Awarded");
    await act(async () => save.reject(new Error("Offline")));
    expect(trigger().textContent).toBe("Interested"); expect(io.error).toHaveBeenCalled();
  });
  it("restores unsaved state after first-save failure and permits retry", async () => {
    io.track.mockRejectedValueOnce(new Error("Offline")); await mount();
    await act(async () => option("Interested").click()); expect(trigger().textContent).toBe("Save");
    await act(async () => option("Interested").click()); expect(trigger().textContent).toBe("Interested");
    expect(io.track).toHaveBeenCalledTimes(2);
  });
  it("removes a saved scholarship after successful persistence", async () => {
    io.result.mockResolvedValue({ data: { status: "applied" }, error: null }); await mount();
    await act(async () => option("Remove from saved").click());
    expect(io.untrack).toHaveBeenCalledWith("scholarship-7"); expect(trigger().textContent).toBe("Save");
    expect(document.body.textContent).not.toContain("Remove from saved");
  });
  it("restores the saved status when removal fails", async () => {
    io.result.mockResolvedValue({ data: { status: "awarded" }, error: null });
    io.untrack.mockRejectedValue(new Error("Offline")); await mount();
    await act(async () => option("Remove from saved").click());
    expect(trigger().textContent).toBe("Awarded"); expect(io.error).toHaveBeenCalled();
  });
});
