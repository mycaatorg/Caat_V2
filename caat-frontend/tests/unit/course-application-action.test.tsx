// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { button, click, link, mountComponent, queryButton, queryLink, unmountAll } from "./dom-helpers";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a>,
}));

import { CourseApplicationAction } from "@/components/courses/course-application-action";

const TRACK = "Track an application at UNSW Sydney";
const base = { institutionName: "UNSW Sydney", schoolId: 7 as number | null, application: null, busy: false, unavailable: false };

afterEach(unmountAll);

describe("CourseApplicationAction (PROD-148)", () => {
  it("offers to track an application, with help text that says it does not apply", async () => {
    const onStart = vi.fn();
    await mountComponent(<CourseApplicationAction {...base} onStart={onStart} onRetry={vi.fn()} />);
    const track = button(TRACK);
    const help = document.getElementById(track.getAttribute("aria-describedby")!);
    expect(help?.textContent).toBe("Adds UNSW Sydney to My applications so you can prepare. It does not apply to the university.");
    expect(onStart).not.toHaveBeenCalled();
    await click(track);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("links to the existing application with its status instead of offering to create one", async () => {
    const onStart = vi.fn();
    await mountComponent(<CourseApplicationAction {...base} application={{ id: "app-7", status: "applying" }} onStart={onStart} onRetry={vi.fn()} />);
    expect(link("Open your UNSW Sydney application").getAttribute("href")).toBe("/applications/app-7");
    expect(document.body.textContent).toContain("Applying");
    expect(queryButton(TRACK)).toBeNull();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("explains a course with no linked university and never shows a create button", async () => {
    await mountComponent(<CourseApplicationAction {...base} schoolId={null} onStart={vi.fn()} onRetry={vi.fn()} />);
    expect(document.body.textContent).toContain("This course isn't linked to a university in CAAT yet.");
    expect(queryButton(TRACK)).toBeNull();
    expect(queryLink(/Open your/)).toBeNull();
  });

  it("shows Retry, never a create button, when the applications read failed", async () => {
    const onRetry = vi.fn();
    const onStart = vi.fn();
    await mountComponent(<CourseApplicationAction {...base} unavailable onStart={onStart} onRetry={onRetry} />);
    expect(document.body.textContent).toContain("Couldn't check your applications.");
    expect(queryButton(TRACK)).toBeNull();
    await click(button("Retry checking your applications"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("disables the button while a start is in flight", async () => {
    await mountComponent(<CourseApplicationAction {...base} busy onStart={vi.fn()} onRetry={vi.fn()} />);
    expect(button(TRACK).disabled).toBe(true);
  });
});
