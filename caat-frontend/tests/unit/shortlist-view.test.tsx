// @vitest-environment jsdom
import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { button, click, deferred, flush, hasText, link, mountComponent, queryButton, queryLink, unmountAll } from "./dom-helpers";
import type { Shortlist } from "@/lib/shortlist";

const io = vi.hoisted(() => ({ remove: vi.fn(), addApplication: vi.fn(), refresh: vi.fn(), toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/shortlist", () => ({ removeFromShortlist: io.remove }));
vi.mock("@/app/(main)/applications/api", () => ({ addApplication: io.addApplication }));
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/current-user", () => ({ getClientUserId: () => Promise.resolve("student-1") }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: io.refresh }) }));
vi.mock("sonner", () => ({ toast: io.toast }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a>,
}));

import { ShortlistView } from "@/components/shortlist/ShortlistView";

const list = (): Shortlist => ({
  scholarships: [{ id: "s1", title: "Regional Engineering Scholarship", provider: "Harbourside University", amount: "AUD $5,000", deadlineAt: "2026-11-30T13:00:00Z", status: "interested" }],
  schools: [
    { id: 7, name: "Harbourside University", country: "Australia", application: null },
    { id: 8, name: "Banksia College", country: "Australia", application: { id: "app-8", status: "applying" } },
  ],
  majors: [{ id: "m1", name: "Civil Engineering", category: "Engineering" }],
});

beforeEach(() => {
  vi.clearAllMocks();
  io.remove.mockResolvedValue(undefined);
});
afterEach(() => unmountAll());

describe("My shortlist", () => {
  it("shows each saved item with its next action", async () => {
    await mountComponent(<ShortlistView initial={list()} />);
    expect(link(/Check eligibility/).getAttribute("href")).toBe("/scholarships/s1");
    expect(document.body.textContent).toContain("Closes 1 Dec 2026");
    expect(button("Start application")).toBeTruthy();
    expect(link(/Open application/).getAttribute("href")).toBe("/applications/app-8");
    expect(link(/See where to study it/).getAttribute("href")).toBe("/majors/m1");
  });

  it("filters by kind", async () => {
    await mountComponent(<ShortlistView initial={list()} />);
    await click(button("Courses"));
    expect(queryLink(/Regional Engineering Scholarship/)).toBeNull();
    expect(queryLink(/Civil Engineering/)).not.toBeNull();
    expect(button("Courses").getAttribute("aria-pressed")).toBe("true");
  });

  it("starts an application once and swaps the button for a link", async () => {
    const insert = deferred<{ id: string; status: string }>();
    io.addApplication.mockReturnValueOnce(insert.promise);
    await mountComponent(<ShortlistView initial={list()} />);
    const start = button("Start application");
    await click(start);
    await click(start);
    await act(async () => insert.resolve({ id: "app-7", status: "researching" }));
    expect(io.addApplication).toHaveBeenCalledTimes(1);
    expect(io.addApplication).toHaveBeenCalledWith(7);
    expect(queryButton("Start application")).toBeNull();
    const hrefs = [...document.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/applications/app-7");
    expect(hrefs).toContain("/applications/app-8");
  });

  it("restores an item when removing it fails", async () => {
    io.remove.mockRejectedValueOnce(new Error("offline"));
    await mountComponent(<ShortlistView initial={list()} />);
    await click(button("Remove Civil Engineering from shortlist"));
    await flush();
    expect(queryLink(/Civil Engineering/)).not.toBeNull();
    expect(io.toast.error).toHaveBeenCalledWith("Could not remove Civil Engineering. Please try again.");
  });

  it("removes an item after the write succeeds", async () => {
    await mountComponent(<ShortlistView initial={list()} />);
    await click(button("Remove Regional Engineering Scholarship from shortlist"));
    await flush();
    expect(io.remove).toHaveBeenCalledWith({}, "student-1", "scholarship", "s1");
    expect(queryLink(/Regional Engineering Scholarship/)).toBeNull();
  });

  it("explains an empty shortlist and a failed load", async () => {
    await mountComponent(<ShortlistView initial={{ scholarships: [], schools: [], majors: [] }} />);
    expect(hasText("Nothing saved yet")).toBe(true);
    unmountAll();
    await mountComponent(<ShortlistView initial={null} />);
    expect(hasText("Couldn't load your shortlist.")).toBe(true);
    await click(button("Try again"));
    expect(io.refresh).toHaveBeenCalled();
  });
});
