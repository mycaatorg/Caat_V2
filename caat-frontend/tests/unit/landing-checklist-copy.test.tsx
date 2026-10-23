// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flush, mountComponent, unmountAll } from "./dom-helpers";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-image={alt} />,
}));
vi.mock("@/components/landing/Navbar", () => ({ default: () => null }));
vi.mock("@/components/landing/FeaturePreviewCarousel", () => ({ FeaturePreviewCarousel: () => null }));
vi.mock("@/components/landing/DemoPlayer", () => ({ DemoPlayer: () => null }));

import LandingPage from "@/components/landing/LandingPage";

afterEach(() => unmountAll());

describe("landing page preparation checklist mock (PROD-147)", () => {
  it("shows the 3-step preparation checklist, scored as n of 3 steps", async () => {
    await mountComponent(<LandingPage />);
    await flush();
    const text = document.body.textContent ?? "";
    expect(text).toContain("Preparation checklist");
    expect(text).toMatch(/[0-3] of 3 steps/);
    expect(text).not.toMatch(/of 10 steps|Application Readiness/);
  });

  it("never presents submission as a checklist step or as the result of a readiness check", async () => {
    await mountComponent(<LandingPage />);
    await flush();
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("Submitted through UAC");
    expect(text).not.toMatch(/readiness check is complete/i);
  });
});
