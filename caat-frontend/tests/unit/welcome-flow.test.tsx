// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { button, click, flush, mountComponent, unmountAll } from "./dom-helpers";
import type { OnboardingProfile } from "@/lib/onboarding";

const io = vi.hoisted(() => ({
  save: vi.fn(), complete: vi.fn(), dismiss: vi.fn(), track: vi.fn(), saveScholarship: vi.fn(), trackedIds: vi.fn(), push: vi.fn(),
  scholarships: { data: [] as unknown[], error: null as unknown },
  toast: { error: vi.fn() },
}));
vi.mock("@/lib/onboarding", async (original) => ({
  ...(await original<object>()),
  saveOnboardingAnswers: io.save,
  completeOnboarding: io.complete,
  dismissOnboarding: io.dismiss,
  saveScholarshipIfNew: io.saveScholarship,
  fetchTrackedIds: io.trackedIds,
}));
vi.mock("@vercel/analytics", () => ({ track: io.track }));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: io.push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/lib/supabase/client", () => {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "limit", "or", "order"]) q[m] = () => q;
  q.then = (f: (v: unknown) => unknown) => Promise.resolve(io.scholarships).then(f);
  return { supabase: { from: () => q } };
});

import { WelcomeFlow } from "@/components/onboarding/WelcomeFlow";

const blank = (patch: Partial<OnboardingProfile> = {}): OnboardingProfile => ({
  year_level: null, student_status: null, journey_stage: null, preferred_countries: [], target_majors: [],
  graduation_year: null, onboarding_completed_at: null, ...patch,
});
const option = (name: RegExp) => [...document.querySelectorAll<HTMLButtonElement>('[role="radio"],[role="checkbox"]')].find((b) => name.test(b.textContent ?? ""))!;
const heading = () => document.querySelector("h1")?.textContent ?? "";
const scholarship = (id: string, title: string, tags: string[], citizenships: string[] | null = null) => ({
  id, slug: id, title, provider_name: "Harbourside University", description: null, amount_display: "AUD $5,000",
  country: "Australia", tags, citizenships, study_level: ["undergraduate"], school_name: "Harbourside University", deadline_at: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  io.save.mockResolvedValue(undefined);
  io.complete.mockResolvedValue(undefined);
  io.saveScholarship.mockResolvedValue(undefined);
  io.trackedIds.mockResolvedValue(new Set());
  io.scholarships = { data: [], error: null };
});
afterEach(() => unmountAll());

describe("onboarding", () => {
  it("saves the year level with a derived final year and moves on", async () => {
    await mountComponent(<WelcomeFlow initial={blank()} />);
    expect(document.body.textContent).toContain("Step 1 of 5");
    expect(button(/Continue/).disabled).toBe(true);
    await click(option(/Year 12/));
    expect(option(/Year 12/).getAttribute("aria-checked")).toBe("true");
    await click(button(/Continue/));
    await flush();
    expect(io.save).toHaveBeenCalledWith({ year_level: "year_12", graduation_year: new Date().getFullYear() });
    expect(heading()).toContain("domestic");
    expect(io.track).toHaveBeenCalledWith("onboarding_step_completed", { step: 1, skipped: false });
  });

  it("supports arrow keys with a single tab stop in single-choice questions", async () => {
    await mountComponent(<WelcomeFlow initial={blank()} />);
    const radios = [...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    const group = document.querySelector('[role="radiogroup"]')!;
    await act(async () => { group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); });
    expect(option(/Year 11/).getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(option(/Year 11/));
    await act(async () => { group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); });
    await act(async () => { group.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })); });
    expect(option(/Not sure/).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps an existing graduation year rather than overwriting it", async () => {
    await mountComponent(<WelcomeFlow initial={blank({ graduation_year: 2030 })} />);
    await click(option(/Year 10/));
    await click(button(/Continue/));
    await flush();
    expect(io.save).toHaveBeenCalledWith({ year_level: "year_10" });
  });

  it("stays on the question with the answer selected when saving fails", async () => {
    io.save.mockRejectedValueOnce(new Error("offline"));
    await mountComponent(<WelcomeFlow initial={blank()} />);
    await click(option(/Year 11/));
    await click(button(/Continue/));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("Could not save that answer. Please try again.");
    expect(document.body.textContent).toContain("Step 1 of 5");
    expect(option(/Year 11/).getAttribute("aria-checked")).toBe("true");
  });

  it("resumes at the first unanswered question and lets the student skip without saving", async () => {
    await mountComponent(<WelcomeFlow initial={blank({ year_level: "year_12", student_status: "domestic", preferred_countries: ["Australia"] })} />);
    expect(document.body.textContent).toContain("Step 4 of 5");
    await click(button("Skip"));
    expect(io.save).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Step 5 of 5");
    expect(io.track).toHaveBeenCalledWith("onboarding_step_completed", { step: 4, skipped: true });
    await click(button(/Back/));
    expect(document.body.textContent).toContain("Step 4 of 5");
  });

  it("adds chosen places and interests to what the profile already has", async () => {
    await mountComponent(<WelcomeFlow initial={blank({ year_level: "year_12", student_status: "domestic", preferred_countries: ["United Kingdom"] , target_majors: [] })} />);
    // Resumes at interests (places already answered); go back to places.
    await click(button(/Back/));
    await click(option(/^Australia$/));
    await click(button(/Continue/));
    await flush();
    expect(io.save).toHaveBeenLastCalledWith({ preferred_countries: ["United Kingdom", "Australia"] });
    await click(option(/^Engineering$/));
    await click(button(/Continue/));
    await flush();
    expect(io.save).toHaveBeenLastCalledWith({ target_majors: ["Engineering"] });
  });

  it("ends with ranked scholarships, saves one and completes onboarding", async () => {
    io.scholarships = { data: [scholarship("s1", "General Bursary", []), scholarship("s2", "Engineering Excellence Scholarship", ["Engineering"])], error: null };
    await mountComponent(<WelcomeFlow initial={blank({ year_level: "year_12", student_status: "domestic", preferred_countries: ["Australia"], target_majors: ["Engineering"], journey_stage: "applying" })} />);
    await flush();
    await flush();
    expect(heading()).toBe("Scholarships that could fit");
    const titles = [...document.querySelectorAll("li a")].map((a) => a.textContent);
    expect(titles[0]).toBe("Engineering Excellence Scholarship");
    await click(button("Save"));
    await flush();
    expect(io.saveScholarship).toHaveBeenCalledWith("s2");
    expect(io.complete).toHaveBeenCalledTimes(1);
    expect(io.track).toHaveBeenCalledWith("first_item_saved", { kind: "scholarship" });
    expect(document.body.textContent).toContain("Saved to your shortlist");
    await click(button("Go to Today"));
    await flush();
    expect(io.push).toHaveBeenCalledWith("/today");
  });

  it("shows awards the student already tracks as saved and never re-saves them", async () => {
    io.scholarships = { data: [scholarship("s1", "Engineering Award", ["Engineering"]), scholarship("s2", "Science Award", ["Science"])], error: null };
    io.trackedIds.mockResolvedValue(new Set(["s1"]));
    await mountComponent(<WelcomeFlow initial={blank({ year_level: "year_12", student_status: "domestic", preferred_countries: ["Australia"], target_majors: ["Engineering"], journey_stage: "applying" })} />);
    await flush();
    await flush();
    const cards = [...document.querySelectorAll("li")];
    const savedCard = cards.find((c) => c.textContent?.includes("Engineering Award"))!;
    expect(savedCard.querySelector("button")!.textContent).toContain("Saved");
    expect((savedCard.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
    // Saving a second award keeps the first shown as saved.
    await click(button("Save"));
    await flush();
    expect(io.saveScholarship).toHaveBeenCalledTimes(1);
    expect(io.saveScholarship).toHaveBeenCalledWith("s2");
    expect([...document.querySelectorAll("li button")].every((b) => b.textContent?.includes("Saved"))).toBe(true);
  });

  it("re-derives the final school year when the student goes back and changes year level", async () => {
    await mountComponent(<WelcomeFlow initial={blank()} />);
    await click(option(/Year 12/));
    await click(button(/Continue/));
    await flush();
    await click(button(/Back/));
    await click(option(/Year 10/));
    await click(button(/Continue/));
    await flush();
    expect(io.save).toHaveBeenLastCalledWith({ year_level: "year_10", graduation_year: new Date().getFullYear() + 2 });
  });

  it("moves focus to the results heading", async () => {
    await mountComponent(<WelcomeFlow initial={blank({ year_level: "year_12", student_status: "domestic", preferred_countries: ["Australia"], target_majors: ["Law"], journey_stage: "exploring" })} />);
    await flush();
    expect(document.activeElement).toBe(document.querySelector("h1"));
  });

  it("offers a way forward when scholarships cannot load", async () => {
    io.scholarships = { data: null as unknown as unknown[], error: { message: "offline" } };
    await mountComponent(<WelcomeFlow initial={blank({ year_level: "year_12", student_status: "domestic", preferred_countries: ["Australia"], target_majors: ["Law"], journey_stage: "exploring" })} />);
    await flush();
    await act(async () => {});
    expect(document.body.textContent).toContain("We could not load scholarships just now.");
  });
});
