/**
 * Tier-1 runtime smoke — read-only. Loads every critical authenticated route
 * and asserts the server didn't 500 and the page actually rendered. This is the
 * cheap check that would have caught the /communities production 500
 * (build passed, runtime crashed). NO data is created, so it is safe to run
 * against the shared/prod Supabase.
 */
import { test, expect } from "@playwright/test";
import routeCoverage from "./route-coverage.json";

const ROUTES = routeCoverage.routes.filter(
  (entry) => entry.coverage === "authenticated-content",
);

for (const { route, expected, expectedRole } of ROUTES) {
  test(`loads ${route} with authenticated page content`, async ({ page }) => {
    expect(expected, `${route} needs expected content in route-coverage.json`).toBeTruthy();
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
    const content = page.getByRole("main").last();
    const expectedContent = new RegExp(expected!, "i");
    const assertion = expectedRole === "text"
      ? content.getByText(expectedContent).first()
      : expectedRole === "tab"
        ? content.getByRole("tab", { name: expectedContent }).first()
      : content.getByRole("heading", { name: expectedContent }).first();
    await expect(assertion, `${route} content`).toBeVisible();
    if (route === "/communities") {
      await expect(content.getByRole("textbox", { name: "Search posts…" })).toBeVisible();
    }
  });
}
