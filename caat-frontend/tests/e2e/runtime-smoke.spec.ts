/**
 * Tier-1 runtime smoke — read-only. Loads every critical authenticated route
 * and asserts the server didn't 500 and the page actually rendered. This is the
 * cheap check that would have caught the /communities production 500
 * (build passed, runtime crashed). NO data is created, so it is safe to run
 * against the shared/prod Supabase.
 */
import { test, expect } from "@playwright/test";

const ROUTES = [
  "/dashboard",
  "/communities",
  "/communities/groups",
  "/communities/notifications",
  "/communities/saved",
  "/resume-builder",
  "/profile",
  "/scholarships",
  "/majors",
  "/schools",
  "/applications",
  "/essays",
  "/documents",
];

for (const route of ROUTES) {
  test(`loads ${route} without a server error`, async ({ page }) => {
    const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
    // Every listed path is a real route and should render directly for the
    // authenticated test account. A redirect to /login must not count as green.
    expect(new URL(page.url()).pathname, `${route} redirected elsewhere`).toBe(route);
    expect(resp?.status(), `${route} returned ${resp?.status()}`).toBe(200);
    // No Next error page leaked into the body.
    const body = (await page.locator("body").innerText().catch(() => "")) ?? "";
    expect(body).not.toMatch(/Internal Server Error|Application error|500\s*\|/i);
    // Something actually rendered (sidebar/app shell is always present when authed).
    await expect(page.locator("body")).not.toBeEmpty();
  });
}
