// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { button, click, deferred, flush, hasText, link, mountComponent, queryButton, unmountAll } from "./dom-helpers";
import type { SavedScholarshipForHub } from "@/lib/scholarship-tracking";
import type { ChecklistScholarship } from "@/lib/requirements-checklist";

const io = vi.hoisted(() => ({
  attachScholarship: vi.fn(),
  detachScholarship: vi.fn(),
  setPrepCheck: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/scholarship-tracking", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/scholarship-tracking")>()),
  attachScholarship: io.attachScholarship,
  detachScholarship: io.detachScholarship,
  setPrepCheck: io.setPrepCheck,
}));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a>,
}));

import { HubScholarshipAttachments } from "@/components/applications/hub-scholarship-attachments";

const NOW = new Date("2026-10-23T12:00:00Z");
function checklist(id: string, patch: Partial<ChecklistScholarship> = {}): ChecklistScholarship {
  return {
    id, requires_essay: true, deadline_at: "2026-12-01", external_url: "https://provider.example/s",
    application_requirements: { separate_application_required: true, must_meet: ["Rule one"] },
    eligibility_summary: null, last_verified_at: "2026-04-06T00:00:00Z", source_last_synced_at: null,
    school_name: "Alpha University", is_active: true, ...patch,
  };
}
function saved(id: string, patch: Partial<SavedScholarshipForHub> = {}, list: Partial<ChecklistScholarship> = {}): SavedScholarshipForHub {
  return {
    id, title: `Scholarship ${id}`, provider: "Provider", amount: null, status: "interested",
    schoolId: null, attachedSchoolName: null, scholarshipSchoolName: "Alpha University",
    checklist: checklist(id, list), ...patch,
  };
}

type Props = Partial<React.ComponentProps<typeof HubScholarshipAttachments>> & { initial: SavedScholarshipForHub[] };
function Harness({ initial, ...rest }: Props) {
  const [list, setList] = useState(initial);
  return (
    <HubScholarshipAttachments
      schoolId={7}
      schoolName="Alpha University"
      saved={list}
      savedUnavailable={false}
      prepChecks={{}}
      prepUnavailable={false}
      onSavedChange={setList}
      onRetry={vi.fn()}
      retrying={false}
      now={NOW}
      {...rest}
    />
  );
}
const region = (name: string) => document.querySelector(`[aria-label="${name}"]`) as HTMLElement | null;
const attachedGroup = () => region("Attached to this application");
const suggestions = () => region("Saved scholarships that mention Alpha University");
const checkbox = (label: string) => document.querySelector(`input[type="checkbox"][aria-label="I've prepared this: ${label}"]`) as HTMLInputElement;

beforeEach(() => {
  for (const fn of [io.attachScholarship, io.detachScholarship, io.setPrepCheck, io.toast.error, io.toast.success]) fn.mockReset();
  io.attachScholarship.mockResolvedValue(undefined);
  io.detachScholarship.mockResolvedValue(undefined);
  io.setPrepCheck.mockResolvedValue(undefined);
});
afterEach(unmountAll);

describe("hub scholarship groups", () => {
  it("shows attached scholarships first, then name-matched suggestions without the attached ones", async () => {
    await mountComponent(<Harness initial={[
      saved("a", { schoolId: 7, attachedSchoolName: "Alpha University", status: "applied" }),
      saved("b"),
      saved("c", { scholarshipSchoolName: "Beta College" }),
    ]} />);
    const groups = [...document.querySelectorAll("[data-scholarship-group]")].map((g) => g.getAttribute("aria-label"));
    expect(groups).toEqual(["Attached to this application", "Saved scholarships that mention Alpha University"]);
    expect(attachedGroup()!.textContent).toContain("Scholarship a");
    expect(suggestions()!.textContent).toContain("Scholarship b");
    expect(suggestions()!.textContent).not.toContain("Scholarship a");
    expect(suggestions()!.textContent).not.toContain("Scholarship c");
    expect(attachedGroup()!.textContent).toContain("Attaching a scholarship organises your preparation for Alpha University. It does not mean you are eligible, and it does not apply for you.");
  });

  it("renders the recorded checklist with sources, the stale label and the not-submitting notice", async () => {
    await mountComponent(<Harness initial={[saved("a", { schoolId: 7, attachedSchoolName: "Alpha University" })]} />);
    const g = attachedGroup()!;
    expect(g.textContent).toContain("A separate scholarship application is required (recorded)");
    expect(g.textContent).toContain("An essay is required (recorded)");
    expect(g.textContent).toContain("Recorded rule: Rule one");
    expect(g.textContent).toContain("Check with the provider");
    expect(g.textContent).toContain("Last checked 6 Apr 2026");
    expect(g.textContent).toContain("as recorded 6 Apr 2026, stale");
    expect(g.textContent).toContain("Completing this checklist is not submitting an application.");
    expect(link("Read the official scholarship page").getAttribute("href")).toBe("https://provider.example/s");
    // The fixed attach copy negates eligibility; the checklist itself never mentions it.
    expect(g.querySelector("[data-attached-scholarship]")!.textContent).not.toMatch(/eligib|admitted|matched|submitted/i);
  });

  it("says unknown items are not recorded, never No, and names a differing recorded institution neutrally", async () => {
    await mountComponent(<Harness initial={[saved("a", { schoolId: 7 }, { requires_essay: null, application_requirements: null, school_name: "Gamma Institute" })]} />);
    const g = attachedGroup()!;
    expect(g.textContent).toContain("Not recorded whether an essay is required");
    expect(g.textContent).not.toContain("No essay is required");
    expect(g.textContent).toContain("Recorded institution: Gamma Institute.");
  });

  it("each group fails into its own unavailable state, and Attach is disabled while saved reads are unavailable", async () => {
    await mountComponent(<Harness initial={[]} savedUnavailable />);
    expect(hasText("Couldn't load your saved scholarships.")).toBe(true);
    expect(button("Attach a saved scholarship").disabled).toBe(true);
    expect(hasText("You haven't attached a scholarship to this application.")).toBe(false);
  });
});

describe("attach and detach", () => {
  it("attaches a suggestion through the owner write, then shows its checklist", async () => {
    await mountComponent(<Harness initial={[saved("b")]} />);
    const pending = deferred();
    io.attachScholarship.mockReturnValueOnce(pending.promise);
    await click(button("Attach Scholarship b"));
    expect(io.attachScholarship).toHaveBeenCalledWith("b", 7);
    expect(button("Attach Scholarship b").disabled).toBe(true);
    expect(attachedGroup()?.textContent ?? "").not.toContain("Scholarship b");
    pending.resolve();
    await flush();
    expect(attachedGroup()!.textContent).toContain("Scholarship b");
    expect(suggestions()).toBeNull();
  });

  it("keeps everything in place and explains when attach fails", async () => {
    io.attachScholarship.mockRejectedValueOnce(new Error("Couldn't attach. Make sure you still have this application, then try again."));
    await mountComponent(<Harness initial={[saved("b")]} />);
    await click(button("Attach Scholarship b"));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("Couldn't attach. Make sure you still have this application, then try again.");
    expect(suggestions()!.textContent).toContain("Scholarship b");
  });

  it("detach writes null and returns a name-matched scholarship to the suggestions", async () => {
    await mountComponent(<Harness initial={[saved("a", { schoolId: 7, attachedSchoolName: "Alpha University" })]} />);
    await click(button("Detach Scholarship a"));
    await flush();
    expect(io.detachScholarship).toHaveBeenCalledWith("a");
    expect(attachedGroup()!.textContent).toContain("You haven't attached a scholarship to this application.");
    expect(suggestions()!.textContent).toContain("Scholarship a");
  });

  it("the dialog lists every saved scholarship with its current attachment and confirms a move", async () => {
    await mountComponent(<Harness initial={[
      saved("b"),
      saved("c", { scholarshipSchoolName: "Beta College", schoolId: 9, attachedSchoolName: "Beta College" }),
    ]} />);
    await click(button("Attach a saved scholarship"));
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain("Scholarship b");
    expect(dialog.textContent).toContain("Scholarship c");
    expect(dialog.textContent).toContain("Attached to Beta College");
    expect(dialog.textContent).toContain("It does not mean you are eligible, and it does not apply for you.");
    expect(dialog.textContent).toContain("A scholarship can be attached to one application at a time.");
    await click(button("Move Scholarship c here", dialog));
    expect(io.attachScholarship).not.toHaveBeenCalled();
    expect(dialog.textContent).toContain("Currently attached to Beta College. Move it here?");
    await click(button("Confirm move", dialog));
    await flush();
    expect(io.attachScholarship).toHaveBeenCalledTimes(1);
    expect(io.attachScholarship).toHaveBeenCalledWith("c", 7);
    expect(attachedGroup()!.textContent).toContain("Scholarship c");
  });
});

describe("preparation ticks", () => {
  const attached = () => [saved("a", { schoolId: 7, attachedSchoolName: "Alpha University" })];

  it("shows persisted ticks, ignores keys that no longer match an item", async () => {
    await mountComponent(<Harness initial={attached()} prepChecks={{ a: ["essay", "rule:ffffffffffffffff"] }} />);
    expect(checkbox("An essay is required (recorded)").checked).toBe(true);
    expect(checkbox("No closing date recorded")).toBeNull();
    expect(document.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(1);
  });

  it("ticks optimistically with a per-key guard and rolls back only that key on failure", async () => {
    await mountComponent(<Harness initial={attached()} />);
    const pending = deferred();
    io.setPrepCheck.mockReturnValueOnce(pending.promise);
    const essay = checkbox("An essay is required (recorded)");
    await click(essay);
    expect(essay.checked).toBe(true);
    expect(essay.disabled).toBe(true);
    await click(essay);
    expect(io.setPrepCheck).toHaveBeenCalledTimes(1);
    expect(io.setPrepCheck).toHaveBeenCalledWith("a", "essay", true);
    await click(checkbox("Read the official scholarship page"));
    expect(io.setPrepCheck).toHaveBeenCalledTimes(2);
    pending.reject(new Error("boom"));
    await flush();
    expect(checkbox("An essay is required (recorded)").checked).toBe(false);
    expect(checkbox("Read the official scholarship page").checked).toBe(true);
    expect(io.toast.error).toHaveBeenCalledWith("Couldn't save that tick. Try again.");
  });

  it("unticks through the same write", async () => {
    await mountComponent(<Harness initial={attached()} prepChecks={{ a: ["essay"] }} />);
    await click(checkbox("An essay is required (recorded)"));
    await flush();
    expect(io.setPrepCheck).toHaveBeenCalledWith("a", "essay", false);
    expect(checkbox("An essay is required (recorded)").checked).toBe(false);
  });

  it("ticks are unavailable separately and are not offered while their read failed", async () => {
    await mountComponent(<Harness initial={attached()} prepUnavailable />);
    expect(hasText("Couldn't load your ticks. Retry to tick items.")).toBe(true);
    expect(checkbox("An essay is required (recorded)").disabled).toBe(true);
  });

  it("offers Retry for unavailable reads", async () => {
    const onRetry = vi.fn();
    await mountComponent(<Harness initial={[]} savedUnavailable onRetry={onRetry} />);
    await click(button("Retry loading saved scholarships"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(queryButton("Attach a saved scholarship")?.disabled).toBe(true);
  });
});
