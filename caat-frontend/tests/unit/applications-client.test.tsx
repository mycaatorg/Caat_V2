// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationRow } from "@/types/applications";
import {
  button, change, click, deferred, flush, hasText, link, mountComponent, query, queryButton, queryLink, unmountAll,
} from "./dom-helpers";

const io = vi.hoisted(() => ({
  fetchApplications: vi.fn(),
  addApplication: vi.fn(),
  updateApplication: vi.fn(),
  deleteApplication: vi.fn(),
  searchSchools: vi.fn(),
  fetchUnimportedBookmarkCount: vi.fn(),
  importBookmarkedSchools: vi.fn(),
  fetchGlobalReadinessSignals: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/app/(main)/applications/api", () => ({
  fetchApplications: io.fetchApplications,
  addApplication: io.addApplication,
  updateApplication: io.updateApplication,
  deleteApplication: io.deleteApplication,
  searchSchools: io.searchSchools,
  fetchUnimportedBookmarkCount: io.fetchUnimportedBookmarkCount,
  importBookmarkedSchools: io.importBookmarkedSchools,
  fetchGlobalReadinessSignals: io.fetchGlobalReadinessSignals,
}));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
// The real state transitions are under test; Radix's popover layout is not.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, children }: React.PropsWithChildren<{ value: string; onValueChange: (v: string) => void }>) => (
    <select aria-label="Status" value={value} onChange={(e) => onValueChange(e.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectItem: ({ value, children }: React.PropsWithChildren<{ value: string }>) => <option value={value}>{children}</option>,
}));

import ApplicationsClient from "@/app/(main)/applications/client";

function row(id: string, name: string, patch: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id,
    user_id: "student-1",
    school_id: Number(id.replace(/\D/g, "")) || 1,
    status: "researching",
    deadline_at: null,
    notes: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    intended_majors: [],
    schools: { id: 1, name, country: "Australia" },
    ...patch,
  };
}

const alpha = () => row("app-1", "Alpha University");
const beta = () => row("app-2", "Beta College", { status: "applying", deadline_at: "2026-11-30" });

function card(name: string): HTMLElement {
  return link(new RegExp(name)).closest("div.rounded-lg") as HTMLElement;
}
const statusOf = (name: string) => card(name).querySelector("select") as HTMLSelectElement;
const deadlineOf = (name: string) => card(name).querySelector('input[type="date"]') as HTMLInputElement;
const notesOf = (name: string) => card(name).querySelector("textarea") as HTMLTextAreaElement;
const indicator = (name: string) => (["Saved", "Saving…", "Not saved"].find((t) => hasText(t, card(name))) ?? null);
const schoolNames = () => [...document.querySelectorAll("a")].map((a) => a.textContent?.trim()).filter((t) => /University|College|Institute/.test(t ?? ""));

async function mount(rows: ApplicationRow[] = [alpha(), beta()]) {
  io.fetchApplications.mockResolvedValue(rows);
  await mountComponent(<ApplicationsClient />);
  await flush();
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  io.fetchUnimportedBookmarkCount.mockResolvedValue(0);
  io.fetchGlobalReadinessSignals.mockResolvedValue({ essayDrafted: false, keyDocsUploaded: false });
  io.updateApplication.mockResolvedValue(undefined);
  io.deleteApplication.mockResolvedValue(undefined);
  io.searchSchools.mockResolvedValue([]);
});

afterEach(() => {
  unmountAll();
  vi.useRealTimers();
});

describe("loading", () => {
  it("shows the caller's applications", async () => {
    await mount();
    expect(schoolNames()).toEqual(["Alpha University", "Beta College"]);
    expect(statusOf("Beta College").value).toBe("applying");
    expect(deadlineOf("Beta College").value).toBe("2026-11-30");
  });

  it("shows a retryable error instead of an empty list when loading fails", async () => {
    io.fetchApplications.mockRejectedValueOnce(new Error("offline"));
    await mountComponent(<ApplicationsClient />);
    await flush();
    expect(hasText("Couldn't load your applications.")).toBe(true);
    expect(hasText("No applications yet")).toBe(false);
    expect(io.toast.error).toHaveBeenCalledWith("Failed to load applications.");

    io.fetchApplications.mockResolvedValueOnce([alpha()]);
    await click(button("Try again"));
    await flush();
    expect(schoolNames()).toEqual(["Alpha University"]);
    expect(hasText("Couldn't load your applications.")).toBe(false);
  });
});

describe("status and deadline", () => {
  it("keeps a status change once the write succeeds", async () => {
    await mount();
    await change(statusOf("Alpha University"), "submitted");
    await flush();
    expect(io.updateApplication).toHaveBeenCalledWith("app-1", { status: "submitted" });
    expect(statusOf("Alpha University").value).toBe("submitted");
    expect(io.toast.error).not.toHaveBeenCalled();
  });

  it("reverts only the failed status and keeps a concurrent successful deadline edit", async () => {
    const statusWrite = deferred();
    io.updateApplication.mockImplementation((id: string) => (id === "app-1" ? statusWrite.promise : Promise.resolve()));
    await mount();

    await change(statusOf("Alpha University"), "submitted");
    await change(deadlineOf("Beta College"), "2026-12-15");
    await flush();
    await act(async () => statusWrite.reject(new Error("offline")));

    expect(statusOf("Alpha University").value).toBe("researching");
    expect(deadlineOf("Beta College").value).toBe("2026-12-15");
    expect(io.toast.error).toHaveBeenCalledWith("Failed to update status.");
  });

  it("does not let an earlier failed status write undo a later successful one", async () => {
    const first = deferred();
    io.updateApplication.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
    await mount();

    await change(statusOf("Alpha University"), "applying");
    await change(statusOf("Alpha University"), "submitted");
    await flush();
    await act(async () => first.reject(new Error("timeout")));

    expect(statusOf("Alpha University").value).toBe("submitted");
  });

  it("sends writes for one application in order", async () => {
    const first = deferred();
    io.updateApplication.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
    await mount();
    await change(statusOf("Alpha University"), "applying");
    await change(deadlineOf("Alpha University"), "2026-12-01");
    await flush();
    expect(io.updateApplication.mock.calls).toEqual([["app-1", { status: "applying" }]]);
    await act(async () => first.resolve());
    await flush();
    expect(io.updateApplication.mock.calls).toEqual([
      ["app-1", { status: "applying" }],
      ["app-1", { deadline_at: "2026-12-01" }],
    ]);
  });

  it("restores the previous deadline when the write fails", async () => {
    io.updateApplication.mockRejectedValueOnce(new Error("offline"));
    await mount();
    await change(deadlineOf("Beta College"), "2027-01-10");
    await flush();
    expect(io.updateApplication).toHaveBeenCalledWith("app-2", { deadline_at: "2027-01-10" });
    expect(deadlineOf("Beta College").value).toBe("2026-11-30");
    expect(io.toast.error).toHaveBeenCalledWith("Failed to update deadline.");
  });

  it("clears a deadline as null rather than an empty string", async () => {
    await mount();
    await change(deadlineOf("Beta College"), "");
    await flush();
    expect(io.updateApplication).toHaveBeenCalledWith("app-2", { deadline_at: null });
  });
});

describe("notes", () => {
  async function openNotes(name: string) {
    await click(button("Notes", card(name)));
    return notesOf(name);
  }

  it("autosaves after typing pauses and shows Saved only after the write", async () => {
    const write = deferred();
    io.updateApplication.mockReturnValueOnce(write.promise);
    await mount();
    await change(await openNotes("Alpha University"), "Ask about portfolio");
    expect(indicator("Alpha University")).toBe("Saving…");

    await advance(800);
    expect(io.updateApplication).toHaveBeenCalledWith("app-1", { notes: "Ask about portfolio" });
    expect(indicator("Alpha University")).toBe("Saving…");
    await act(async () => write.resolve());
    expect(indicator("Alpha University")).toBe("Saved");
  });

  it("keeps the typed text, says it was not saved, and saves on retry", async () => {
    io.updateApplication.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    await mount();
    const notes = await openNotes("Alpha University");
    await change(notes, "Scholarship interview notes");
    await advance(800);
    await flush();

    expect(io.toast.error).toHaveBeenCalledWith("Failed to update notes.");
    expect(notes.value).toBe("Scholarship interview notes");
    expect(indicator("Alpha University")).toBe("Not saved");

    await click(button("Save", card("Alpha University")));
    await flush();
    expect(io.updateApplication).toHaveBeenLastCalledWith("app-1", { notes: "Scholarship interview notes" });
    expect(indicator("Alpha University")).toBe("Saved");
  });

  it("sends a newer save after an older one settles and ignores the older failure", async () => {
    const stale = deferred();
    io.updateApplication.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(undefined);
    await mount();
    const notes = await openNotes("Alpha University");
    await change(notes, "draft");
    await advance(800);
    await change(notes, "draft two");
    await advance(800);
    await flush();
    // Writes for one application are serialized, so the database cannot end
    // on the older text.
    expect(io.updateApplication).toHaveBeenCalledTimes(1);

    await act(async () => stale.reject(new Error("timeout")));
    await flush();
    expect(io.updateApplication).toHaveBeenLastCalledWith("app-1", { notes: "draft two" });
    expect(notes.value).toBe("draft two");
    expect(indicator("Alpha University")).toBe("Saved");
  });

  it("clears notes immediately and cancels a pending autosave", async () => {
    await mount([alpha()]);
    const notes = await openNotes("Alpha University");
    await change(notes, "remove me");
    await click(button("Clear Notes", card("Alpha University")));
    await advance(1000);
    await flush();
    expect(io.updateApplication.mock.calls).toEqual([["app-1", { notes: null }]]);
    expect(notes.value).toBe("");
  });
});

describe("removal", () => {
  async function remove(name: string) {
    await click(button("Remove application", card(name)));
    await click(button("Confirm", card(name)));
  }

  it("asks for confirmation before deleting and removes after success", async () => {
    await mount();
    await click(button("Remove application", card("Alpha University")));
    await click(button("Cancel", card("Alpha University")));
    expect(io.deleteApplication).not.toHaveBeenCalled();

    await remove("Alpha University");
    await flush();
    expect(io.deleteApplication).toHaveBeenCalledTimes(1);
    expect(io.deleteApplication).toHaveBeenCalledWith("app-1");
    expect(queryLink(/Alpha University/)).toBeNull();
    expect(io.toast.success).toHaveBeenCalledWith("Application removed.");
  });

  it("restores a failed removal in place without undoing other edits", async () => {
    const removal = deferred();
    io.deleteApplication.mockReturnValueOnce(removal.promise);
    await mount();
    await remove("Alpha University");
    expect(queryLink(/Alpha University/)).toBeNull();

    await change(statusOf("Beta College"), "accepted");
    await flush();
    await act(async () => removal.reject(new Error("offline")));

    expect(schoolNames()).toEqual(["Alpha University", "Beta College"]);
    expect(statusOf("Beta College").value).toBe("accepted");
    expect(io.toast.error).toHaveBeenCalledWith("Failed to remove application.");
    expect(io.toast.success).not.toHaveBeenCalled();
  });

  it("does not report a notes failure for an application the student just removed", async () => {
    io.updateApplication.mockRejectedValue(new Error("Application not found"));
    await mount();
    await click(button("Notes", card("Alpha University")));
    await change(notesOf("Alpha University"), "last thought");
    await remove("Alpha University");
    await flush();
    await advance(1000);
    await flush();
    expect(io.toast.error).not.toHaveBeenCalled();
    expect(io.toast.success).toHaveBeenCalledWith("Application removed.");
  });
});

describe("adding schools", () => {
  async function search(query: string) {
    await click(button(/Add School/));
    await change(document.querySelector('input[placeholder="Search for a school by name..."]') as HTMLInputElement, query);
    await advance(300);
    await flush();
  }
  const searchBox = () => document.querySelector('input[placeholder="Search for a school by name..."]') as HTMLInputElement | null;

  it("adds a searched school once even when clicked twice", async () => {
    io.searchSchools.mockResolvedValue([{ id: 42, name: "Gamma Institute", country: "Australia" }]);
    const insert = deferred<ApplicationRow>();
    io.addApplication.mockReturnValueOnce(insert.promise);
    await mount([alpha()]);
    await search("gamma");
    const result = button(/Gamma Institute/);
    await click(result);
    await click(result);
    await act(async () => insert.resolve(row("app-42", "Gamma Institute", { school_id: 42 })));

    expect(io.addApplication).toHaveBeenCalledTimes(1);
    expect(io.addApplication).toHaveBeenCalledWith(42);
    expect(queryLink(/Gamma Institute/)).not.toBeNull();
    expect(searchBox()).toBeNull();
  });

  it("keeps the search open with the query after a failed add and allows retry", async () => {
    io.searchSchools.mockResolvedValue([{ id: 42, name: "Gamma Institute", country: "Australia" }]);
    io.addApplication.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(row("app-42", "Gamma Institute", { school_id: 42 }));
    await mount([alpha()]);
    await search("gamma");
    await click(button(/Gamma Institute/));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("Failed to add school.");
    expect(searchBox()?.value).toBe("gamma");
    expect(queryLink(/Gamma Institute/)).toBeNull();

    await click(button(/Gamma Institute/));
    await flush();
    expect(io.addApplication).toHaveBeenCalledTimes(2);
    expect(queryLink(/Gamma Institute/)).not.toBeNull();
  });

  it("does not offer a school that is already tracked", async () => {
    io.searchSchools.mockResolvedValue([{ id: 1, name: "Alpha University", country: "Australia" }]);
    await mount([alpha()]);
    await search("alpha");
    const tracked = query("button", /Already tracked/) as HTMLButtonElement;
    expect(tracked.disabled).toBe(true);
    expect(io.addApplication).not.toHaveBeenCalled();
  });
});

describe("importing bookmarks", () => {
  it("keeps a successful import when only the count refresh fails", async () => {
    io.fetchUnimportedBookmarkCount.mockResolvedValueOnce(2).mockRejectedValueOnce(new Error("count failed"));
    io.importBookmarkedSchools.mockResolvedValueOnce({
      added: [row("app-5", "Delta University"), row("app-6", "Epsilon College")],
      skipped: 0,
    });
    await mount([alpha()]);
    await click(button(/Import from Bookmarks/));
    await flush();

    expect(queryLink(/Delta University/)).not.toBeNull();
    expect(io.toast.success).toHaveBeenCalledWith(expect.stringContaining("Added 2 schools"), expect.anything());
    expect(io.toast.error).not.toHaveBeenCalled();
  });

  it("reports a failed import without adding rows and allows retry", async () => {
    io.fetchUnimportedBookmarkCount.mockResolvedValue(1);
    io.importBookmarkedSchools
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ added: [row("app-5", "Delta University")], skipped: 0 });
    await mount([alpha()]);
    await click(button(/Import from Bookmarks/));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("Failed to import bookmarks.");
    expect(queryLink(/Delta University/)).toBeNull();
    expect(queryButton(/Import from Bookmarks/)?.disabled).toBe(false);

    await click(button(/Import from Bookmarks/));
    await flush();
    expect(queryLink(/Delta University/)).not.toBeNull();
  });
});
