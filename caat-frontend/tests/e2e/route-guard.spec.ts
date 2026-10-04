/** Read-only auth middleware coverage for every protected App Router page. */
import { test, expect } from "@playwright/test";
import routeCoverage from "./route-coverage.json";

const PROTECTED_ROUTES = routeCoverage.routes.filter(
  (entry) => entry.access === "authenticated",
);

for (const { route } of PROTECTED_ROUTES) {
  const requestedPath = route.replace(/\[[^\]]+\]/g, "codex-route-probe");

  test(`unauthenticated ${route} redirects to login and preserves its target`, async ({ page }) => {
    await page.goto(requestedPath);
    await expect(page).toHaveURL(/\/login\?/);

    const loginUrl = new URL(page.url());
    expect(loginUrl.pathname).toBe("/login");
    expect(loginUrl.searchParams.get("next")).toBe(requestedPath);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
}
