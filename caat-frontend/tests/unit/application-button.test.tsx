// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { button, click, deferred, flush, mountComponent, queryButton, unmountAll } from "./dom-helpers";

const io = vi.hoisted(() => ({
  fetchApplicationForSchool: vi.fn(),
  addApplication: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/app/(main)/applications/api", () => ({
  fetchApplicationForSchool: io.fetchApplicationForSchool,
  addApplication: io.addApplication,
}));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import ApplicationButton from "@/app/(main)/schools/[id]/application-button";

const tracked = { id: "app-9", school_id: 9, status: "researching" };
const statusLink = () => document.querySelector('a[href="/applications"]');

beforeEach(() => {
  vi.clearAllMocks();
  io.fetchApplicationForSchool.mockResolvedValue(null);
});
afterEach(() => unmountAll());

describe("school page application button", () => {
  it("shows the current status for an already tracked school", async () => {
    io.fetchApplicationForSchool.mockResolvedValue({ ...tracked, status: "submitted" });
    await mountComponent(<ApplicationButton schoolId={9} />);
    await flush();
    expect(io.fetchApplicationForSchool).toHaveBeenCalledWith(9);
    expect(statusLink()?.textContent).toContain("Submitted");
    expect(queryButton(/Track Application/)).toBeNull();
  });

  it("tracks once even when clicked twice, then links to the application", async () => {
    const insert = deferred<typeof tracked>();
    io.addApplication.mockReturnValueOnce(insert.promise);
    await mountComponent(<ApplicationButton schoolId={9} />);
    await flush();
    const track = button(/Track Application/);
    await click(track);
    expect(track.disabled).toBe(true);
    await click(track);
    await act(async () => insert.resolve(tracked));

    expect(io.addApplication).toHaveBeenCalledTimes(1);
    expect(io.addApplication).toHaveBeenCalledWith(9);
    expect(statusLink()?.textContent).toContain("Researching");
    expect(io.toast.success).toHaveBeenCalledWith("School added to your applications.");
  });

  it("reports a failed track and re-enables the button for retry", async () => {
    io.addApplication.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(tracked);
    await mountComponent(<ApplicationButton schoolId={9} />);
    await flush();
    await click(button(/Track Application/));
    await flush();
    expect(io.toast.error).toHaveBeenCalledWith("Failed to track application.");
    expect(statusLink()).toBeNull();
    expect(button(/Track Application/).disabled).toBe(false);

    await click(button(/Track Application/));
    await flush();
    expect(statusLink()?.textContent).toContain("Researching");
  });
});
