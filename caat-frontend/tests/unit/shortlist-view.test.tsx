// @vitest-environment jsdom
import React, { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { button, change, click, deferred, flush, hasText, link, mountComponent, queryButton, queryLink, unmountAll } from "./dom-helpers";
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
  courses: [],
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
afterEach(() => {
  unmountAll();
  window.history.replaceState({}, "", "/shortlist");
});

const manySaved = (count: number): Shortlist => ({
  courses: [],
  scholarships: Array.from({ length: count }, (_, i) => ({
    id: `sch-${i + 1}`,
    title: `Scholarship ${i + 1}`,
    provider: "Test provider",
    amount: "$1,000",
    deadlineAt: null,
    status: i % 2 === 0 ? "interested" : "applied",
  })),
  schools: Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `University ${i + 1}`, country: "Australia", application: null })),
  majors: Array.from({ length: count }, (_, i) => ({ id: `course-${i + 1}`, name: `Course ${i + 1}`, category: "Study" })),
});

function setSearch(search: string) {
  window.history.replaceState({}, "", `/shortlist${search}`);
}

describe("My shortlist", () => {
  it("keeps university courses separate from majors and restores a failed course removal", async () => {
    const pending = deferred(); io.remove.mockReturnValueOnce(pending.promise);
    const initial = { ...list(), courses: [{ id: 'offering-1', name: 'Advanced Computing', institutionName: 'Example University', campus: 'Main', active: false, sourceUrl: 'https://example.edu.au/computing' }] };
    await mountComponent(<ShortlistView initial={initial} />);
    await click(button('University courses'));
    expect(queryLink(/Civil Engineering/)).toBeNull();
    expect(link(/Advanced Computing/).getAttribute('href')).toBe('/courses?course=offering-1');
    expect(document.body.textContent).toContain('No longer in the active catalogue');
    await click(button('Remove Advanced Computing from shortlist'));
    await act(async () => pending.reject(new Error('offline')));
    expect(queryLink(/Advanced Computing/)).not.toBeNull();
    expect(io.remove).toHaveBeenCalledWith({}, 'student-1', 'course', 'offering-1');
    await click(button('Majors'));
    expect(queryLink(/Civil Engineering/)).not.toBeNull();
  });

  it("keeps a provider link on an inactive saved course, and only safe links", async () => {
    const initial = { ...list(), courses: [
      { id: 'offering-1', name: 'Advanced Computing', institutionName: 'Example University', campus: 'Main', active: false, sourceUrl: 'https://example.edu.au/computing' },
      { id: 'offering-2', name: 'Applied Data', institutionName: 'Example University', campus: null, active: false, sourceUrl: 'javascript:alert(1)' },
    ] };
    await mountComponent(<ShortlistView initial={initial} />);
    await click(button('University courses'));
    const provider = link(/^Check with the provider about Advanced Computing/);
    expect(provider.getAttribute('href')).toBe('https://example.edu.au/computing');
    expect(provider.getAttribute('rel')).toBe('noopener noreferrer');
    expect(queryLink(/^Check with the provider about Applied Data/)).toBeNull();
  });

  it("locates the restored item using current order after another removal succeeds", async () => {
    const removal = deferred(); io.remove.mockReturnValueOnce(removal.promise).mockResolvedValueOnce(undefined);
    setSearch("?tab=school&page=2");
    await mountComponent(<ShortlistView initial={manySaved(21)} />);
    await click(button("Remove University 21 from shortlist"));
    await click(button("Remove University 1 from shortlist"));
    await act(async () => removal.reject(new Error("offline")));
    await click(button("Show restored item"));
    expect(queryLink(/University 21/)).not.toBeNull();
    expect(queryLink(/^University 1$/)).toBeNull();
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
  });

  it("renders the URL-selected category and page before hydration", () => {
    const html = renderToStaticMarkup(<ShortlistView initial={manySaved(21)} initialQuery="tab=school&page=2" />);
    const content = document.createElement("div"); content.innerHTML = html;
    expect(content.querySelector('[aria-label="Universities"]')?.textContent).toContain("University 21");
    expect(content.querySelector('[aria-label="Scholarships"]')).toBeNull();
    expect(content.querySelectorAll('[aria-label="Universities"] li')).toHaveLength(1);
  });

  it("does not hijack navigation after failure and can locate the restored item", async () => {
    const removal = deferred(); io.remove.mockReturnValueOnce(removal.promise);
    setSearch("?tab=school&page=2");
    await mountComponent(<ShortlistView initial={manySaved(21)} />);
    await click(button("Remove University 21 from shortlist"));
    await click(button("Majors"));
    await act(async () => removal.reject(new Error("offline")));
    expect(button("Majors").getAttribute("aria-pressed")).toBe("true");
    await click(button("Show restored item"));
    expect(button("Universities").getAttribute("aria-pressed")).toBe("true");
    expect(queryLink(/University 21/)).not.toBeNull();
  });

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
    await click(button("Majors"));
    expect(queryLink(/Regional Engineering Scholarship/)).toBeNull();
    expect(queryLink(/Civil Engineering/)).not.toBeNull();
    expect(button("Majors").getAttribute("aria-pressed")).toBe("true");
  });

  it("limits the all view to five items per category and opens all scholarships in the category view", async () => {
    setSearch("");
    await mountComponent(<ShortlistView initial={manySaved(100)} />);

    expect(document.querySelectorAll('[aria-label="Scholarships"] li')).toHaveLength(5);
    expect(document.querySelectorAll('[aria-label="Universities"] li')).toHaveLength(5);
    expect(document.querySelectorAll('[aria-label="Majors"] li')).toHaveLength(5);
    await click(button("View all scholarships (100)"));
    expect(document.querySelectorAll('[aria-label="Scholarships"] li')).toHaveLength(20);
    expect(queryLink(/Scholarship 20/)).not.toBeNull();
    expect(queryLink(/Scholarship 21/)).toBeNull();
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("scholarship");
    await click(button("All"));
    await click(button("View all universities (100)"));
    expect(document.querySelectorAll('[aria-label="Universities"] li')).toHaveLength(20);
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("school");
    await click(button("All"));
    await click(button("View all majors (100)"));
    expect(document.querySelectorAll('[aria-label="Majors"] li')).toHaveLength(20);
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("major");
  });

  it("paginates a category and writes the selected page to the URL", async () => {
    setSearch("");
    await mountComponent(<ShortlistView initial={manySaved(21)} />);
    await click(button("Universities"));
    expect(document.querySelectorAll('[aria-label="Universities"] li')).toHaveLength(20);
    await click(button("Next page"));
    expect(document.querySelectorAll('[aria-label="Universities"] li')).toHaveLength(1);
    expect(queryLink(/University 21/)).not.toBeNull();
    expect(new URLSearchParams(window.location.search).get("page")).toBe("2");
  });

  it("resets pagination when search or scholarship status changes", async () => {
    setSearch("?tab=scholarship&page=2");
    await mountComponent(<ShortlistView initial={manySaved(100)} />);
    const search = document.querySelector<HTMLInputElement>('input[aria-label="Search scholarships"]');
    expect(search).not.toBeNull();
    await change(search!, "Scholarship 1");
    expect(document.querySelectorAll('[aria-label="Scholarships"] li')).toHaveLength(12);
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("q")).toBe("Scholarship 1");

    setSearch("?tab=scholarship&page=2");
    unmountAll();
    await mountComponent(<ShortlistView initial={manySaved(25)} />);
    const status = document.querySelector<HTMLSelectElement>('select[aria-label="Scholarship status"]');
    expect(status).not.toBeNull();
    await change(status!, "applied");
    expect(document.querySelectorAll('[aria-label="Scholarships"] li')).toHaveLength(12);
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("status")).toBe("applied");
  });

  it("restores a valid tab, page, search and status from the URL and safely ignores invalid state", async () => {
    setSearch("?tab=scholarship&page=2&q=Scholarship&status=applied");
    await mountComponent(<ShortlistView initial={manySaved(100)} />);
    expect(button("Scholarships").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll('[aria-label="Scholarships"] li')).toHaveLength(20);
    expect(queryLink(/Scholarship 42/)).not.toBeNull();
    expect((document.querySelector('input[aria-label="Search scholarships"]') as HTMLInputElement).value).toBe("Scholarship");
    expect((document.querySelector('select[aria-label="Scholarship status"]') as HTMLSelectElement).value).toBe("applied");

    setSearch("?tab=not-a-category&page=-3&q=%20%20&status=not-a-status");
    unmountAll();
    await mountComponent(<ShortlistView initial={manySaved(25)} />);
    expect(button("All").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll('[aria-label="Scholarships"] li')).toHaveLength(5);
    expect(document.querySelectorAll('[aria-label="Universities"] li')).toHaveLength(5);
    expect(document.querySelectorAll('[aria-label="Majors"] li')).toHaveLength(5);
  });

  it("clamps to the last available page after removing the only item on that page", async () => {
    setSearch("?tab=school&page=2");
    await mountComponent(<ShortlistView initial={manySaved(21)} />);
    expect(queryLink(/University 21/)).not.toBeNull();
    await click(button("Remove University 21 from shortlist"));
    await flush();
    expect(document.querySelectorAll('[aria-label="Universities"] li')).toHaveLength(20);
    expect(document.body.textContent).toContain("20 saved");
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
    expect(queryButton("Next page")).toBeNull();
  });

  it("restores a failed removal from the last page after pagination clamps", async () => {
    const removal = deferred();
    io.remove.mockReturnValueOnce(removal.promise);
    setSearch("?tab=school&page=2");
    await mountComponent(<ShortlistView initial={manySaved(21)} />);
    await click(button("Remove University 21 from shortlist"));
    await flush();
    expect(new URLSearchParams(window.location.search).get("page")).toBeNull();
    await act(async () => removal.reject(new Error("offline")));
    await flush();
    expect(document.body.textContent).toContain("21 saved");
    await click(button("Show restored item"));
    expect(queryLink(/University 21/)).not.toBeNull();
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

  it("restores only the failed item when another removal succeeded meanwhile", async () => {
    const first = deferred();
    io.remove.mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
    await mountComponent(<ShortlistView initial={list()} />);
    await click(button("Remove Harbourside University from shortlist"));
    await click(button("Remove Banksia College from shortlist"));
    await flush();
    await act(async () => first.reject(new Error("offline")));
    await flush();
    const names = [...document.querySelectorAll("a")].map((a) => a.textContent);
    expect(names).toContain("Harbourside University");
    expect(names).not.toContain("Banksia College");
  });

  it("removes an item after the write succeeds", async () => {
    await mountComponent(<ShortlistView initial={list()} />);
    await click(button("Remove Regional Engineering Scholarship from shortlist"));
    await flush();
    expect(io.remove).toHaveBeenCalledWith({}, "student-1", "scholarship", "s1");
    expect(queryLink(/Regional Engineering Scholarship/)).toBeNull();
  });

  it("explains an empty shortlist and a failed load", async () => {
    await mountComponent(<ShortlistView initial={{ scholarships: [], schools: [], majors: [], courses: [] }} />);
    expect(hasText("Nothing saved yet")).toBe(true);
    unmountAll();
    await mountComponent(<ShortlistView initial={null} />);
    expect(hasText("Couldn't load your shortlist.")).toBe(true);
    await click(button("Try again"));
    expect(io.refresh).toHaveBeenCalled();
  });
});
