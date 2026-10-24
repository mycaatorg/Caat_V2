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
  fetchSavedCoursesForSchool: vi.fn(),
  updateApplicationMajors: vi.fn(),
  fetchEvidenceLinksForApplication: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/(main)/applications/[id]/api", () => ({
  fetchApplicationHub: io.fetchApplicationHub,
  updateApplicationStatus: io.updateApplicationStatus,
  updateApplicationDeadline: io.updateApplicationDeadline,
  fetchMajorOptions: io.fetchMajorOptions,
  fetchSavedCoursesForSchool: io.fetchSavedCoursesForSchool,
}));
vi.mock("@/app/(main)/applications/api", () => ({ updateApplicationMajors: io.updateApplicationMajors }));
vi.mock("@/lib/scholarship-tracking", () => ({
  SCHOLARSHIP_STATUS_LABELS: { interested: "Interested", applied: "Applied", awarded: "Awarded", rejected: "Rejected" },
  mentionsSchool: (a: string | null, b: string) => !!a && a.toLowerCase() === b.toLowerCase(),
}));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/evidence-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/evidence-links")>()),
  fetchEvidenceLinksForApplication: io.fetchEvidenceLinksForApplication,
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

function hub(
  patch: Partial<ApplicationHub["application"]> = {},
  readiness: Partial<ApplicationHub["readiness"]> = {},
  extra: Partial<Omit<ApplicationHub, "application" | "readiness">> = {},
): ApplicationHub {
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
    savedScholarships: [],
    savedScholarshipsUnavailable: false,
    prepChecks: {},
    prepChecksUnavailable: false,
    readiness: { deadlineSet: !!application.deadline_at, essayDrafted: true, keyDocsUploaded: false, score: 1, ...readiness },
    essaysForSchool: [],
    essaysShared: [],
    schoolDocuments: [],
    sharedDocuments: [],
    scholarships: [],
    scholarshipsUnavailable: false,
    savedCourses: [],
    savedCoursesUnavailable: false,
    evidenceLinks: [],
    evidenceLinksUnavailable: false,
    ...extra,
  };
}

const stepLabel = (li: Element) => li.querySelector("[data-step-label]")?.textContent?.replace(/\s+/g, " ").trim();
const checklistItem = (label: string) =>
  [...document.querySelectorAll("li[data-state]")].find((li) => stepLabel(li) === label) as HTMLElement;
const isDone = (label: string) => checklistItem(label).getAttribute("data-state") === "done";
const score = () => document.body.textContent?.match(/(\d) of 3 steps/)?.[1];
const ESSAY_STEP = "An essay drafted for this school or shared";
const DOCS_STEP = "A document attached here or a shared key document";
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
  it("shows the preparation checklist from the loaded application", async () => {
    await mount();
    expect(io.fetchApplicationHub).toHaveBeenCalledWith("app-1");
    expect(hasText("Preparation checklist")).toBe(true);
    expect(isDone("Deadline is set")).toBe(false);
    expect(isDone(ESSAY_STEP)).toBe(true);
    expect(isDone(DOCS_STEP)).toBe(false);
    expect(score()).toBe("1");
  });

  it("words the checklist as preparation, never as submission", async () => {
    await mount(hub({ deadline_at: "2026-12-01" }, { essayDrafted: true, keyDocsUploaded: true, score: 3 }));
    const steps = [...document.querySelectorAll("li[data-state]")].map(stepLabel);
    expect(steps).toEqual(["Deadline is set", ESSAY_STEP, DOCS_STEP]);
    expect(score()).toBe("3");
    const card = document.querySelector("[data-prep-checklist]")!;
    expect(card.textContent).not.toMatch(/submitted|complete|ready/i);
    expect(card.textContent).toContain("does not send anything");
  });

  it("tells screen readers whether each step is done, and hides the decorative icon", async () => {
    await mount();
    const text = (label: string) => checklistItem(label).textContent?.replace(/\s+/g, " ").trim();
    expect(text("Deadline is set")).toBe("Not done: Deadline is set");
    expect(text(ESSAY_STEP)).toBe(`Done: ${ESSAY_STEP}`);
    for (const li of document.querySelectorAll("li[data-state]")) {
      expect(li.querySelector(".sr-only")).not.toBeNull();
      expect(li.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("hints how to count a per-university draft only while the essay step is not done", async () => {
    const HINT = "A draft for a per-university prompt counts once it is tagged to this university in Essays.";
    await mount(hub({}, { essayDrafted: false, score: 0 }));
    expect(checklistItem(ESSAY_STEP).textContent).toContain(HINT);
    unmountAll();
    await mount();
    expect(document.body.textContent).not.toContain(HINT);
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

  it("reverts to the saved deadline when consecutive writes all fail", async () => {
    const partialYear = deferred();
    const fullYear = deferred();
    io.updateApplicationDeadline.mockReturnValueOnce(partialYear.promise).mockReturnValueOnce(fullYear.promise);
    await mount();
    await change(deadlineInput(), "0202-10-15");
    await change(deadlineInput(), "2027-10-15");
    await act(async () => partialYear.reject(new Error("offline")));
    await flush();
    await act(async () => fullYear.reject(new Error("offline")));
    await flush();
    expect(deadlineInput().value).toBe("");
    expect(isDone("Deadline is set")).toBe(false);
    expect(io.toast.error).toHaveBeenCalledTimes(1);
  });

  it("keeps a deadline set again after an earlier identical write failed", async () => {
    const first = deferred();
    io.updateApplicationDeadline.mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    await mount();
    await change(deadlineInput(), "2027-01-01");
    await change(deadlineInput(), "2027-02-02");
    await change(deadlineInput(), "2027-01-01");
    await act(async () => first.reject(new Error("offline")));
    await flush();
    await flush();
    expect(deadlineInput().value).toBe("2027-01-01");
    expect(io.toast.error).not.toHaveBeenCalled();
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

  it("shows the student's own Submitted status without a page refresh, and leaves the preparation score alone", async () => {
    io.fetchApplicationHub.mockResolvedValueOnce(hub()).mockRejectedValue(new Error("refresh failed"));
    await mountComponent(<ApplicationHubClient applicationId="app-1" />);
    await flush();
    await click(statusOption("Submitted"));
    await flush();
    expect(statusTrigger().textContent).toContain("Submitted");
    expect(score()).toBe("1");
    expect(hasText("Nice work. Now you wait.")).toBe(true);
    expect(io.toast.error).not.toHaveBeenCalled();
  });

  it("reverts the status when the write fails and allows retry", async () => {
    io.updateApplicationStatus.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    await mount();
    await click(statusOption("Submitted"));
    await flush();
    expect(statusTrigger().textContent).toContain("Applying");
    expect(hasText("Nice work. Now you wait.")).toBe(false);
    expect(io.toast.error).toHaveBeenCalledWith("offline");
    expect(statusTrigger().disabled).toBe(false);

    await click(statusOption("Submitted"));
    await flush();
    expect(statusTrigger().textContent).toContain("Submitted");
    expect(hasText("Nice work. Now you wait.")).toBe(true);
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

describe("scholarships panel", () => {
  it("says none are recorded for this university rather than none exist, without implying an eligibility check", async () => {
    await mount();
    expect(hasText("No scholarships recorded for this university yet")).toBe(true);
    expect(document.body.textContent?.replace(/\s+/g, " ")).toContain("Browse all scholarships to find others.");
    expect(document.body.textContent).not.toContain("No scholarships found");
    expect(document.body.textContent).not.toMatch(/eligible/i);
  });

  it("explains a failed load, announced as a status, instead of claiming there are none", async () => {
    await mount(hub({}, {}, { scholarshipsUnavailable: true }));
    const message = [...document.querySelectorAll('[role="status"]')].find((el) =>
      el.textContent?.includes("Couldn't load scholarships for this university right now."),
    );
    expect(message).toBeDefined();
    expect(document.body.textContent).not.toContain("No scholarships recorded");
  });

  it("lists this university's scholarships in the order loaded, with each deadline and a link to its page", async () => {
    await mount(
      hub({}, {}, {
        scholarships: [
          { id: "s1", title: "Alpha Award", provider: "Alpha", amount: "$5k", deadline: "2026-11-01" },
          { id: "s2", title: "Alpha Bursary", provider: "Alpha", amount: null, deadline: null },
        ],
      }),
    );
    const items = [...document.querySelectorAll("[data-hub-scholarship]")];
    expect(items.map((li) => li.getAttribute("data-hub-scholarship"))).toEqual(["s1", "s2"]);
    expect(items.map((li) => li.querySelector("a")?.getAttribute("href"))).toEqual(["/scholarships/s1", "/scholarships/s2"]);
    expect(items[0].querySelector("[data-scholarship-deadline]")?.textContent).toBe("Closes 1 Nov 2026");
    expect(items[1].querySelector("[data-scholarship-deadline]")?.textContent).toBe("No closing date listed");
    expect(document.body.textContent).toContain("soonest deadline first");
  });
});

describe("courses you saved at this university (PROD-148)", () => {
  const savedCourse = {
    id: "alpha-cs", name: "Bachelor of Computing", campus: "City", application_route: "Apply through UAC.",
    application_url: "https://www.uac.edu.au", source_url: "https://alpha.edu.au/computing", verified_at: "2026-10-20T00:00:00.000Z", active: true,
  };
  const savedCard = () => document.querySelector('[aria-label="Courses you saved at Alpha University"]') as HTMLElement | null;

  it("sits directly under the preparation checklist and does not change the 3-step score", async () => {
    await mount(hub({}, {}, { savedCourses: [savedCourse] }));
    const prep = document.querySelector("[data-prep-checklist]")!;
    expect(prep.nextElementSibling).toBe(savedCard());
    expect(savedCard()!.textContent).toContain("Bachelor of Computing");
    expect(savedCard()!.textContent).toContain("Apply through UAC.");
    expect(score()).toBe("1");
    expect(document.querySelectorAll("li[data-state]")).toHaveLength(3);
  });

  it("retries only the saved-courses read when it failed, leaving the rest of the hub alone", async () => {
    io.fetchSavedCoursesForSchool.mockResolvedValueOnce([savedCourse]);
    await mount(hub({}, {}, { savedCoursesUnavailable: true }));
    expect(savedCard()!.textContent).toContain("Couldn't load your saved courses.");
    expect(savedCard()!.textContent).not.toContain("You haven't saved a course");
    await click(button("Retry loading saved courses"));
    await flush();
    expect(io.fetchSavedCoursesForSchool).toHaveBeenCalledWith(7);
    expect(io.fetchApplicationHub).toHaveBeenCalledTimes(1);
    expect(savedCard()!.textContent).toContain("Bachelor of Computing");
    expect(score()).toBe("1");
  });

  it("stays unavailable when the retry also fails", async () => {
    io.fetchSavedCoursesForSchool.mockRejectedValueOnce(new Error("offline"));
    await mount(hub({}, {}, { savedCoursesUnavailable: true }));
    await click(button("Retry loading saved courses"));
    await flush();
    expect(savedCard()!.textContent).toContain("Couldn't load your saved courses.");
    expect(button("Retry loading saved courses").disabled).toBe(false);
  });
});

describe("attached scholarships (PROD-77)", () => {
  const attached = {
    id: "s-1", title: "Alpha Merit", provider: "Alpha", amount: null, status: "applied" as const,
    schoolId: 7, attachedSchoolName: "Alpha University", scholarshipSchoolName: "Alpha University",
    checklist: {
      id: "s-1", requires_essay: true, deadline_at: null, external_url: null, application_requirements: null,
      eligibility_summary: null, last_verified_at: null, source_last_synced_at: null, school_name: "Alpha University", is_active: true,
    },
  };

  it("shows the attached checklist with persisted ticks and leaves the 3-step score alone", async () => {
    await mount(hub({}, {}, { savedScholarships: [attached], prepChecks: { "s-1": ["essay", "deadline"] } }));
    const group = document.querySelector('[aria-label="Attached to this application"]') as HTMLElement;
    expect(group.textContent).toContain("Alpha Merit");
    expect(group.textContent).toContain("An essay is required (recorded)");
    expect(group.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(2);
    expect(score()).toBe("1");
    expect(document.querySelectorAll("li[data-state]")).toHaveLength(3);
  });

  it("keeps the rest of the scholarships card when only the saved-scholarship read failed", async () => {
    await mount(hub({}, {}, { savedScholarshipsUnavailable: true }));
    expect(hasText("Couldn't load your saved scholarships.")).toBe(true);
    expect(hasText("No scholarships recorded for this university yet")).toBe(true);
    expect(score()).toBe("1");
  });
});

describe("linked library documents (PROD-78)", () => {
  const linked = {
    id: "link-1", applicationId: "app-1", documentId: "doc-1", tailoredTitle: "Arts portfolio", tailoredBody: null,
    tailoredAt: "2026-10-21T00:00:00.000Z", createdAt: "2026-10-20T00:00:00.000Z",
    document: { id: "doc-1", fileName: "portfolio.pdf", category: "transcripts", status: "verified", uploadedAt: "2026-10-01T00:00:00.000Z" },
  };
  const group = () => document.querySelector('[aria-label="Linked from your documents"]') as HTMLElement | null;

  it("lists linked documents on the Documents card without changing the 3-step score", async () => {
    await mount(hub({}, {}, { evidenceLinks: [linked] }));
    expect(group()!.textContent).toContain("Arts portfolio");
    expect(group()!.textContent).toContain("Tailored for Alpha University. Library file: portfolio.pdf");
    expect(isDone(DOCS_STEP)).toBe(false);
    expect(score()).toBe("1");
    expect(document.querySelectorAll("li[data-state]")).toHaveLength(3);
  });

  it("retries only the links read when it failed, and the score never moves", async () => {
    io.fetchEvidenceLinksForApplication.mockResolvedValueOnce([linked]);
    await mount(hub({}, {}, { evidenceLinksUnavailable: true }));
    expect(group()!.textContent).toContain("Couldn't load your linked documents.");
    expect(score()).toBe("1");
    await click(button("Retry loading linked documents"));
    await flush();
    expect(io.fetchEvidenceLinksForApplication).toHaveBeenCalledWith("app-1");
    expect(io.fetchApplicationHub).toHaveBeenCalledTimes(1);
    expect(group()!.textContent).toContain("Arts portfolio");
    expect(score()).toBe("1");
  });

  it("stays unavailable when the retry also fails", async () => {
    io.fetchEvidenceLinksForApplication.mockRejectedValueOnce(new Error("offline"));
    await mount(hub({}, {}, { evidenceLinksUnavailable: true }));
    await click(button("Retry loading linked documents"));
    await flush();
    expect(group()!.textContent).toContain("Couldn't load your linked documents.");
    expect(score()).toBe("1");
  });
});
