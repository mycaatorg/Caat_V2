// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, link, mountComponent, queryButton, queryLink, unmountAll } from "./dom-helpers";
import { normalizeHubCourse } from "@/lib/course-data";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a>,
}));

import { SavedCoursesCard } from "@/components/applications/saved-courses-card";
import type { HubCourse } from "@/app/(main)/applications/[id]/api";

const CHECKED = "2026-10-23T12:00:00Z";
const course = (patch: Partial<HubCourse> = {}): HubCourse => ({
  id: "unsw-3778-kensington",
  name: "Bachelor of Science (Computer Science)",
  campus: "Kensington",
  application_route: "Domestic applicants apply through UAC.",
  application_url: "https://www.uac.edu.au/apply",
  source_url: "https://www.unsw.edu.au/cs",
  verified_at: "2026-10-20T00:00:00.000Z",
  active: true,
  prerequisites: null, prerequisites_url: null, assumed_knowledge: null, source_year: null,
  ...patch,
});
const card = () => document.querySelector('[aria-label="Courses you saved at UNSW Sydney"]') as HTMLElement;

afterEach(unmountAll);

describe("SavedCoursesCard (PROD-148)", () => {
  it("distinguishes recorded prerequisites from assumed knowledge with source year", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[course({prerequisites: "Mathematics prerequisite applies", prerequisites_url: "https://www.unsw.edu.au/entry", assumed_knowledge: "Mathematics Extension 1", source_year: 2027})]} unavailable={false} retrying={false} onRetry={vi.fn()} checkedAt={CHECKED} />);
    expect(card().textContent).toContain("Recorded prerequisites");
    expect(card().textContent).toContain("Mathematics prerequisite applies");
    expect(card().textContent).toContain("Assumed knowledge");
    expect(card().textContent).toContain("Preparation guidance, not automatically an entry requirement.");
    expect(card().textContent).toContain("Source year: 2027");
    expect(link(/^Check prerequisite details/).getAttribute("href")).toBe("https://www.unsw.edu.au/entry");
    expect(card().querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });
  it("never turns missing prerequisites into no prerequisites", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[course()]} unavailable={false} retrying={false} onRetry={vi.fn()} checkedAt={CHECKED} />);
    expect(card().textContent).toContain("Prerequisites not recorded. Check the provider before planning your application.");
    expect(card().textContent).toContain("Assumed knowledge not recorded.");
    expect(card().textContent).toContain("Source year not recorded.");
    expect(queryLink(/^Check prerequisite details/)).toBeNull();
  });
  it("lists a saved course with its route, official link, source and verification date", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[course()]} unavailable={false} retrying={false} onRetry={vi.fn()} checkedAt={CHECKED} />);
    expect(card().querySelector("h2, h3, [data-card-title]")?.textContent).toBe("Courses you saved at UNSW Sydney");
    expect(link("Bachelor of Science (Computer Science)").getAttribute("href")).toBe("/courses?course=unsw-3778-kensington");
    expect(card().textContent).toContain("Kensington");
    expect(card().textContent).toContain("Domestic applicants apply through UAC.");
    expect(link(/^Official application page/).getAttribute("href")).toBe("https://www.uac.edu.au/apply");
    expect(link(/^View official course details/).getAttribute("href")).toBe("https://www.unsw.edu.au/cs");
    expect(card().querySelector("time")?.getAttribute("dateTime")).toBe("2026-10-20T00:00:00.000Z");
    expect(card().textContent).toContain("Source checked 20 Oct 2026.");
  });

  it("says when the route is not recorded and never links an unsafe application URL", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[course({ application_route: null, application_url: null })]} unavailable={false} retrying={false} onRetry={vi.fn()} checkedAt={CHECKED} />);
    expect(card().textContent).toContain("Application route not recorded. Check the provider.");
    expect(queryLink(/^Official application page/)).toBeNull();
  });

  it("keeps unknown verification unknown and stale sources stale", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[
      course({ id: "a", name: "Unverified course", verified_at: null }),
      course({ id: "b", name: "Stale course", verified_at: "2026-01-02T00:00:00.000Z" }),
    ]} unavailable={false} retrying={false} onRetry={vi.fn()} checkedAt={CHECKED} />);
    const [unverified, stale] = [...card().querySelectorAll("li")];
    expect(unverified.textContent).toContain("Verification not confirmed. Check the provider.");
    expect(unverified.querySelector("time")).toBeNull();
    expect(stale.textContent).toContain("More than 90 days ago; details may have changed.");
  });

  it("keeps an inactive saved course listed with the catalogue copy", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[course({ active: false })]} unavailable={false} retrying={false} onRetry={vi.fn()} checkedAt={CHECKED} />);
    expect(link("Bachelor of Science (Computer Science)")).toBeTruthy();
    expect(card().textContent).toContain("No longer in the active catalogue. Check current availability.");
  });

  it("shows the empty state with a link to browse courses", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[]} unavailable={false} retrying={false} onRetry={vi.fn()} checkedAt={CHECKED} />);
    expect(card().textContent).toContain("You haven't saved a course at UNSW Sydney.");
    expect(link("Browse university courses").getAttribute("href")).toBe("/courses");
  });

  it("shows unavailable with Retry, never the empty copy, when the read failed", async () => {
    const onRetry = vi.fn();
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[]} unavailable retrying={false} onRetry={onRetry} checkedAt={CHECKED} />);
    expect(card().textContent).toContain("Couldn't load your saved courses.");
    expect(card().textContent).not.toContain("You haven't saved a course");
    await click(button("Retry loading saved courses"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables Retry while retrying", async () => {
    await mountComponent(<SavedCoursesCard schoolName="UNSW Sydney" courses={[]} unavailable retrying onRetry={vi.fn()} checkedAt={CHECKED} />);
    expect(button("Retry loading saved courses").disabled).toBe(true);
    expect(queryButton("Browse university courses")).toBeNull();
  });
});

describe("normalizeHubCourse (PROD-148)", () => {
  const raw = { id: "c1", name: " Computing ", campus: "", application_route: "UAC", application_url: "javascript:alert(1)", source_url: "https://example.edu.au/c", verified_at: "2026-02-30T00:00:00Z", active: true };
  it("drops unsafe links and impossible dates instead of showing them", () => {
    expect(normalizeHubCourse(raw)).toEqual({ id: "c1", name: "Computing", campus: null, application_route: "UAC", application_url: null, source_url: "https://example.edu.au/c", verified_at: null, active: true, prerequisites: null, prerequisites_url: null, assumed_knowledge: null, source_year: null });
  });
  it("rejects rows without an id or name and treats a missing active flag as inactive", () => {
    expect(normalizeHubCourse({ ...raw, id: "" })).toBeNull();
    expect(normalizeHubCourse({ ...raw, name: null })).toBeNull();
    expect(normalizeHubCourse({ ...raw, active: undefined })?.active).toBe(false);
  });
});

describe("hub course requirement normalization", () => {
 it("normalizes recorded text and suppresses unsafe source links and invalid years", () => {
  expect(normalizeHubCourse({id:"c",name:"Course", prerequisites:" Maths ", prerequisites_url:"javascript:alert(1)", assumed_knowledge:" ", source_year:2027.5})).toMatchObject({prerequisites:"Maths",prerequisites_url:null,assumed_knowledge:null,source_year:null});
  expect(normalizeHubCourse({id:"c",name:"Course", source_year:2027, prerequisites_url:"https://example.edu.au/entry"})).toMatchObject({source_year:2027,prerequisites_url:"https://example.edu.au/entry"});
 });
});

vi.mock("@/components/dashboard/api", () => ({ addTodo: vi.fn() }));
