// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { link, mountComponent, unmountAll } from "./dom-helpers";
import { normalizeCourse } from "@/lib/course-data";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a>,
}));

import { MajorCourses } from "@/components/majors/major-courses";

const offering = (id: string, name: string, institution: string, campus: string | null, active = true) => normalizeCourse({
  id, institution_key: "k", institution_name: institution, program_code: id, name, source_url: "https://example.edu.au/c", campus, active,
})!;
const catalogue = [
  offering("unsw-3778-kensington", "Bachelor of Science (Computer Science)", "UNSW Sydney", "Kensington"),
  offering("anu-aacom", "Bachelor of Advanced Computing (Honours)", "Australian National University", null),
  offering("unsw-3502-kensington", "Bachelor of Commerce", "UNSW Sydney", "Kensington"),
];

afterEach(unmountAll);

describe("MajorCourses (PROD-148)", () => {
  it("lists reviewed catalogue courses for the major with institution and campus, linking to /courses", async () => {
    const root = await mountComponent(<MajorCourses majorName="Computer Science" courses={catalogue} />);
    const section = root.querySelector('section[aria-label="University courses in CAAT"]')!;
    expect(section.querySelector("h2")?.textContent).toBe("University courses in CAAT");
    expect(link("Bachelor of Science (Computer Science)").getAttribute("href")).toBe("/courses?course=unsw-3778-kensington");
    expect(link("Bachelor of Advanced Computing (Honours)").getAttribute("href")).toBe("/courses?course=anu-aacom");
    expect(section.textContent).toContain("UNSW Sydney · Kensington");
    expect(section.textContent).toContain("Australian National University");
    expect(section.textContent).not.toContain("Bachelor of Commerce");
    expect(section.textContent).toContain("A reviewed starter list, not every course that teaches this major.");
  });

  it("renders no section for a major without reviewed courses", async () => {
    const root = await mountComponent(<MajorCourses majorName="History" courses={catalogue} />);
    expect(root.innerHTML).toBe("");
  });

  it("renders no section for a near-miss name", async () => {
    const root = await mountComponent(<MajorCourses majorName="computer science" courses={catalogue} />);
    expect(root.innerHTML).toBe("");
  });

  it("says the catalogue could not load rather than hiding the section or claiming none", async () => {
    const root = await mountComponent(<MajorCourses majorName="Computer Science" courses={null} />);
    expect(root.textContent).toContain("Couldn't load university courses.");
  });
});
