// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({ load: vi.fn(), missing: vi.fn(() => { throw new Error("NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ notFound: state.missing }));
vi.mock("@/app/(main)/communities/actions", () => ({ fetchCommunityProfileAction: state.load, fetchPostsByUserAction: vi.fn() }));
vi.mock("@/lib/supabase-server", () => ({ createSupabaseServer: vi.fn() }));
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => null }));
vi.mock("@/components/communities/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/communities/PostCard", () => ({ PostCard: () => null }));
vi.mock("@/components/communities/FollowButton", () => ({ FollowButton: () => null }));
vi.mock("@/components/communities/PrivacySettingsPanel", () => ({ PrivacySettingsPanel: () => null }));
vi.mock("@/components/communities/FollowersSheet", () => ({ FollowersSheet: () => null }));
import Page from "@/app/(main)/communities/profile/[userId]/page";
beforeEach(() => vi.clearAllMocks());
it("shows an honest retry state for failed reads instead of404", async () => {
  state.load.mockResolvedValue({ profile: null, error: "Could not load this community profile. Please try again." });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ userId: "profile-id" }) }));
  const dom = new DOMParser().parseFromString(html, "text/html");
  expect(dom.querySelector("h1")?.textContent).toBe("Could not load this profile");
  expect(dom.querySelector("a")?.getAttribute("href")).toBe("/communities/profile/profile-id");
  expect(dom.querySelector("a")?.textContent).toBe("Try again");
  expect(state.missing).not.toHaveBeenCalled();
});
it("keeps404 for a successful missing-profile lookup", async () => {
  state.load.mockResolvedValue({ profile: null, error: null });
  await expect(Page({ params: Promise.resolve({ userId: "missing" }) })).rejects.toThrow("NOT_FOUND");
});
it("encodes the profile segment in the retry destination", async () => {
  state.load.mockResolvedValue({ profile: null, error: "unavailable" });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ userId: "a/b?c#d" }) }));
  const dom = new DOMParser().parseFromString(html, "text/html");
  expect(dom.querySelector("a")?.getAttribute("href")).toBe("/communities/profile/a%2Fb%3Fc%23d");
});
