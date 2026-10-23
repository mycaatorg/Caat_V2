// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplicationRow } from "@/types/applications";
import { flush, link, mountComponent, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({
  fetchApplications: vi.fn(),
  fetchPreparationInputs: vi.fn(),
}));

vi.mock("@/app/(main)/applications/api", () => ({
  fetchApplications: io.fetchApplications,
  fetchPreparationInputs: io.fetchPreparationInputs,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import { ApplicationsRollup } from "@/components/dashboard/ApplicationsRollup";

function row(id: string, schoolId: number, name: string, patch: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id,
    user_id: "student-1",
    school_id: schoolId,
    status: "applying",
    deadline_at: null,
    notes: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    intended_majors: [],
    schools: { id: schoolId, name, country: "Australia" },
    ...patch,
  };
}

const apps = () => [
  row("app-1", 1, "Alpha University", { deadline_at: "2099-01-10" }),
  row("app-2", 2, "Beta College", { status: "submitted" }),
];

const mixedInputs = {
  prompts: [
    { id: "p-why", scope: "per_school" },
    { id: "p-personal", scope: "shared" },
  ],
  drafts: [
    { prompt_id: "p-why", school_id: 2 }, // attached to Beta
    { prompt_id: "p-why", school_id: 99 }, // another school
    { prompt_id: "p-why", school_id: null }, // untagged per-school draft: counts nowhere
  ],
  documents: [
    { category: "identity", school_id: 1 }, // attached to Alpha
    { category: "other", school_id: null }, // shared, not a key document
    { category: "letters", school_id: 99 }, // another school
  ],
};

const scoreOf = (name: string) =>
  link(new RegExp(name)).querySelector("[data-prep-score]")?.textContent?.replace(/\s+/g, " ").trim() ?? null;

async function mount() {
  await mountComponent(<ApplicationsRollup />);
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks();
  io.fetchApplications.mockResolvedValue(apps());
  io.fetchPreparationInputs.mockResolvedValue(mixedInputs);
});

afterEach(() => unmountAll());

describe("dashboard applications summary", () => {
  it("scores each application with the hub's rule from mixed attached, shared and other-school items", async () => {
    await mount();
    // Alpha: deadline + attached document. Beta: attached essay only; its Submitted status is not a step.
    expect(scoreOf("Alpha University")).toBe("Preparation checklist: 2 of 3 steps");
    expect(scoreOf("Beta College")).toBe("Preparation checklist: 1 of 3 steps");
    expect(link(/Beta College/).getAttribute("href")).toBe("/applications/app-2");
  });

  it("counts a shared essay and a shared key document for every application", async () => {
    io.fetchPreparationInputs.mockResolvedValue({
      ...mixedInputs,
      drafts: [{ prompt_id: "p-personal", school_id: null }],
      documents: [{ category: "language", school_id: null }],
    });
    await mount();
    expect(scoreOf("Alpha University")).toBe("Preparation checklist: 3 of 3 steps");
    expect(scoreOf("Beta College")).toBe("Preparation checklist: 2 of 3 steps");
  });

  it("never shows an x/4 score or submission wording for the checklist", async () => {
    await mount();
    const scores = [...document.querySelectorAll("[data-prep-score]")].map((el) => el.textContent ?? "");
    expect(scores).toHaveLength(2);
    for (const text of scores) expect(text).not.toMatch(/of 4|submit|complete|ready/i);
  });

  it("shows no score rather than a wrong one when the inputs fail to load", async () => {
    io.fetchPreparationInputs.mockRejectedValue(new Error("offline"));
    await mount();
    expect(scoreOf("Alpha University")).toBeNull();
    expect(link(/Alpha University/).getAttribute("href")).toBe("/applications/app-1");
  });
});
