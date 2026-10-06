// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationHub } from "@/app/(main)/applications/[id]/api";
import { button, change, click, deferred, flush, hasText, mountComponent, queryButton, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({
  fetchApplicationHub: vi.fn(),
  updateApplicationStatus: vi.fn(),
  updateApplicationDeadline: vi.fn(),
  fetchMajorOptions: vi.fn(),
  updateApplicationMajors: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/(main)/applications/[id]/api", () => ({
  fetchApplicationHub: io.fetchApplicationHub,
  updateApplicationStatus: io.updateApplicationStatus,
  updateApplicationDeadline: io.updateApplicationDeadline,
  fetchMajorOptions: io.fetchMajorOptions,
}));
vi.mock("@/app/(main)/applications/api", () => ({ updateApplicationMajors: io.updateApplicationMajors }));
vi.mock("@/lib/scholarship-tracking", () => ({
  SCHOLARSHIP_STATUS_LABELS: { interested: "Interested", applied: "Applied", awarded: "Awarded", rejected: "Rejected" },
}));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
// Exercise the real status control; Radix menu positioning is not under test.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div data-status-trigger>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div data-status-menu>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: React.PropsWithChildren<{ onSelect: () => void }>) => (
    <button type="button" onClick={onSelect}>{children}</button>
  ),
}));

import ApplicationHubClient from "@/app/(main)/applications/[id]/client";

function hub(patch: Partial<ApplicationHub["application"]> = {}, readiness: Partial<ApplicationHub["readiness"]> = {}): ApplicationHub {
  const application = {
    id: "app-1",
    user_id: "student-1",
    school_id: 7,
    status: "applying" as const,
    deadline_at: null,
    notes: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    intended_majors: ["Law"],
    schools: { id: 7, name: "Alpha University", country: "Australia" },
    ...patch,
  };
  return {
    application,
    schoolId: 7,
    schoolName: "Alpha University",
    schoolCountry: "Australia",
    targetMajor: "Law",
    intendedMajors: application.intended_majors ?? [],
    trackedScholarships: [],
    readiness: { deadlineSet: !!application.deadline_at, essayDrafted: true, keyDocsUploaded: false, submitted: false, score: 1, ...readiness },
    essaysForSchool: [],
    essaysShared: [],
    schoolDocuments: [],
    sharedDocuments: [],
    scholarships: [],
  };
}

const checklistItem = (label: string) =>
  [...document.querySelectorAll("li[data-state]")].find((li) => li.textContent?.replace(/\s+/g, " ").trim() === label) as HTMLElement;
const isDone = (label: string) => checklistItem(label).getAttribute("data-state") === "done";
const score = () => document.body.textContent?.match(/(\d) of 4 ready/)?.[1];
const statusTrigger = () => document.querySelector("[data-status-trigger] button") as HTMLButtonElement;
const statusOption = (label: string) => button(label, document.querySelector("[data-status-menu]")!);
const deadlineInput = () => document.getElementById("hub-deadline") as HTMLInputElement;
const majorsInput = () => document.querySelector('input[placeholder="Add a major…"]') as HTMLInputElement;
const chips = () => [...document.querySelectorAll("span.rounded-md.bg-muted")].map((s) => s.textContent?.trim());

async function mount(initial = hub()) {
  io.fetchApplicationHub.mockResolvedValue(initial);
  await mountComponent(<ApplicationHubClient applicationId="app-1" />);
  await flush();
}

async function pressEnter(input: HTMLInputElement) {
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  io.fetchMajorOptions.mockResolvedValue(["Commerce", "Law", "Medicine"]);
  io.updateApplicationStatus.mockResolvedValue(undefined);
  io.updateApplicationDeadline.mockResolvedValue(undefined);
  io.updateApplicationMajors.mockResolvedValue(undefined);
});

afterEach(() => unmountAll());

describe("loading", () => {
  it("shows the readiness checklist from the loaded application", async () => {
    await mount();
    expect(io.fetchApplicationHub).toHaveBeenCalledWith("app-1");
    expect(isDone("Deadline is set")).toBe(false);
    expect(isDone("At least one essay drafted")).toBe(true);
    expect(isDone("Key documents uploaded")).toBe(false);
    expect(isDone("Status reached Submitted")).toBe(false);
    expect(score()).toBe("1");
  });

  it("explains a missing or foreign application with a way back", async () => {
    io.fetchApplicationHub.mockRejectedValue(new Error("Application not found"));
    await mountComponent(<ApplicationHubClient applicationId="someone-elses" />);
    await flush();
    expect(hasText("Application not found")).toBe(true);
    expect(document.querySelector('a[href="/applications"]')).not.toBeNull();
  });
});

describe("deadline", () => {
  it("ticks the checklist and raises the score as soon as a deadline is set", async () => {
    await mount();
    await change(deadlineInput(), "2026-12-01");
    await flush();
    expect(io.updateApplicationDeadline).toHaveBeenCalledWith("app-1", "2026-12-01");
    expect(isDone("Deadline is set")).toBe(true);
    expect(score()).toBe("2");
  });

  it("unticks the checklist when the deadline is cleared", async () => {
    await mount(hub({ deadline_at: "2026-12-01" }, { score: 2 }));
    expect(isDone("Deadline is set")).toBe(true);
    await change(deadlineInput(), "");
    await flush();
    expect(io.updateApplicationDeadline).toHaveBeenCalledWith("app-1", null);
    expect(isDone("Deadline is set")).toBe(false);
    expect(score()).toBe("1");
  });

  it("restores the deadline and checklist when the write fails", async () => {
    io.updateApplicationDeadline.mockRejectedValueOnce(new Error("Application not found"));
    await mount();
    await change(deadlineInput(), "2026-12-01");
    await flush();
    expect(deadlineInput().value).toBe("");
    expect(isDone("Deadline is set")).toBe(false);
    expect(score()).toBe("1");
    expect(io.toast.error).toHaveBeenCalledWith("Application not found");
  });
});

describe("status", () => {
  it("disables the menu while saving and keeps the new status", async () => {
    const write = deferred();
    io.updateApplicationStatus.mockReturnValueOnce(write.promise);
    await mount();
    await click(statusOption("Submitted"));
    expect(statusTrigger().disabled).toBe(true);
    await act(async () => write.resolve());
    expect(statusTrigger().disabled).toBe(false);
    expect(statusTrigger().textContent).toContain("Submitted");
    expect(io.updateApplicationStatus).toHaveBeenCalledWith("app-1", "submitted");
  });

  it("ticks the Submitted checklist item without depending on a page refresh", async () => {
    io.fetchApplicationHub.mockResolvedValueOnce(hub()).mockRejectedValue(new Error("refresh failed"));
    await mountComponent(<ApplicationHubClient applicationId="app-1" />);
    await flush();
    await click(statusOption("Submitted"));
    await flush();
    expect(isDone("Status reached Submitted")).toBe(true);
    expect(score()).toBe("2");
    expect(hasText("Nice work. Now you wait.")).toBe(true);
    expect(io.toast.error).not.toHaveBeenCalled();
  });

  it("reverts the status and checklist when the write fails and allows retry", async () => {
    io.updateApplicationStatus.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    await mount();
    await click(statusOption("Submitted"));
    await flush();
    expect(statusTrigger().textContent).toContain("Applying");
    expect(isDone("Status reached Submitted")).toBe(false);
    expect(io.toast.error).toHaveBeenCalledWith("offline");
    expect(statusTrigger().disabled).toBe(false);

    await click(statusOption("Submitted"));
    await flush();
    expect(statusTrigger().textContent).toContain("Submitted");
    expect(isDone("Status reached Submitted")).toBe(true);
  });

  it("saves a deadline only after an earlier status write settles", async () => {
    const statusWrite = deferred();
    io.updateApplicationStatus.mockReturnValueOnce(statusWrite.promise);
    await mount();
    await click(statusOption("Submitted"));
    await change(deadlineInput(), "2026-12-01");
    await flush();
    expect(io.updateApplicationDeadline).not.toHaveBeenCalled();
    await act(async () => statusWrite.resolve());
    await flush();
    expect(io.updateApplicationDeadline).toHaveBeenCalledWith("app-1", "2026-12-01");
  });

  it("does not undo a deadline change when an earlier status write fails", async () => {
    const statusWrite = deferred();
    io.updateApplicationStatus.mockReturnValueOnce(statusWrite.promise);
    await mount();
    await click(statusOption("Submitted"));
    await change(deadlineInput(), "2026-12-01");
    await flush();
    await act(async () => statusWrite.reject(new Error("offline")));
    await flush();

    expect(statusTrigger().textContent).toContain("Applying");
    expect(deadlineInput().value).toBe("2026-12-01");
    expect(isDone("Deadline is set")).toBe(true);
    expect(io.updateApplicationDeadline).toHaveBeenCalledWith("app-1", "2026-12-01");
  });
});

describe("majors", () => {
  async function edit() {
    await click(button(/edit majors|add majors/));
  }

  it("adds a suggested major and persists the full list", async () => {
    await mount();
    await edit();
    await change(majorsInput(), "comm");
    await pressEnter(majorsInput());
    await flush();
    expect(io.updateApplicationMajors).toHaveBeenCalledWith("app-1", ["Law", "Commerce"]);
    expect(chips()).toEqual(["Law", "Commerce"]);
    expect(majorsInput().value).toBe("");
  });

  it("restores the list and keeps the typed major when saving fails", async () => {
    io.updateApplicationMajors.mockRejectedValueOnce(new Error("offline"));
    await mount();
    await edit();
    await change(majorsInput(), "Marine Biology");
    await pressEnter(majorsInput());
    await flush();
    expect(chips()).toEqual(["Law"]);
    expect(majorsInput().value).toBe("Marine Biology");
    expect(io.toast.error).toHaveBeenCalledWith("Could not save majors.");
  });

  it("ignores further edits until the current save settles", async () => {
    const save = deferred();
    io.updateApplicationMajors.mockReturnValueOnce(save.promise);
    await mount();
    await edit();
    await change(majorsInput(), "Medicine");
    await pressEnter(majorsInput());
    const removeLaw = document.querySelector("span.rounded-md.bg-muted button") as HTMLButtonElement;
    expect(removeLaw.disabled).toBe(true);
    await click(removeLaw);
    expect(io.updateApplicationMajors).toHaveBeenCalledTimes(1);

    await act(async () => save.resolve());
    await flush();
    expect(chips()).toEqual(["Law", "Medicine"]);
    await click(document.querySelector("span.rounded-md.bg-muted button") as HTMLButtonElement);
    await flush();
    expect(io.updateApplicationMajors).toHaveBeenLastCalledWith("app-1", ["Medicine"]);
  });

  it("does not add a duplicate major regardless of case", async () => {
    await mount();
    await edit();
    await change(majorsInput(), "law");
    await pressEnter(majorsInput());
    await flush();
    expect(io.updateApplicationMajors).not.toHaveBeenCalled();
    expect(queryButton("Done")).not.toBeNull();
  });
});
