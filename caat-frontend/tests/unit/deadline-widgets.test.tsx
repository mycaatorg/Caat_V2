// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, link, mountComponent, unmountAll } from "./dom-helpers";
import { toDateKey } from "@/lib/calendar-utils";
import type { UnifiedDeadline } from "@/lib/unified-deadlines";

const io = vi.hoisted(() => ({ fetchUnifiedDeadlines: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/current-user", () => ({ getClientUserId: () => Promise.resolve("student-1") }));
vi.mock("@/lib/supabase/client", () => {
  // CalendarWidget reads its own calendar_events: from().select().eq().order().
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
  };
  return { supabase: { from: () => builder } };
});
vi.mock("@/lib/unified-deadlines", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/unified-deadlines")>()),
  fetchUnifiedDeadlines: io.fetchUnifiedDeadlines,
}));

import { CalendarWidget } from "@/components/dashboard/widgets/CalendarWidget";
import { UpcomingDeadlinesWidget } from "@/components/dashboard/widgets/UpcomingDeadlinesWidget";

const customRow = (): UnifiedDeadline => ({
  id: "cus-c1",
  source: "custom",
  title: "Rotary Club Bursary",
  dateISO: toDateKey(new Date()),
  href: "/scholarships?view=mine",
});

beforeEach(() => {
  io.fetchUnifiedDeadlines.mockResolvedValue([customRow()]);
});
afterEach(() => unmountAll());

describe("custom scholarship deadline pills (PROD-146)", () => {
  it("UpcomingDeadlinesWidget shows a Custom pill that links to My Scholarships", async () => {
    await mountComponent(<UpcomingDeadlinesWidget />);
    await flush();
    const row = link(/Rotary Club Bursary/);
    expect(row.getAttribute("href")).toBe("/scholarships?view=mine");
    expect(row.querySelector('[aria-hidden="true"]')?.textContent).toBe("Custom");
    expect(row.querySelector(".sr-only")?.textContent).toBe("Your own scholarship");
  });

  it("CalendarWidget lists the custom deadline on its day with a Custom pill and a separate label", async () => {
    await mountComponent(<CalendarWidget />);
    await flush();
    const title = link("Rotary Club Bursary");
    expect(title.getAttribute("href")).toBe("/scholarships?view=mine");
    const item = title.closest("li")!;
    expect(item.querySelector('[aria-hidden="true"]')?.textContent).toBe("Custom");
    expect(item.querySelector(".sr-only")?.textContent).toBe("Your own scholarship");
    // Words stay separate for screen readers, never "CustomScholarship deadline".
    expect(item.textContent?.replace(/\s+/g, " ")).toContain("Your own scholarship Scholarship deadline");
  });
});
