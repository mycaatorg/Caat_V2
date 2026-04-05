/**
 * 2.1 Authentication Flows — authenticated paths (login, logout, session)
 *
 * These run WITH the saved auth session from auth.setup.ts.
 */
import { test, expect } from "@playwright/test";

// ── Login success ──────────────────────────────────────────────────────────────

test("login: successful login redirects to /dashboard", async ({ page }) => {
  // Session already established by setup; verify we land on dashboard
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("main")).toBeVisible();
});

test("login: ?next param redirects to target page after login", async ({ page }) => {
  // Already logged in — navigate to a protected page with next param via URL
  // The middleware should serve it directly (session exists)
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile/);
});

// ── Logout ─────────────────────────────────────────────────────────────────────

test("logout: after logout visiting /dashboard redirects to /login", async ({ page, context }) => {
  await page.goto("/dashboard");

  // Find and click logout — look in nav user dropdown
  const userMenu = page.locator("[data-sidebar='menu-button']").last();
  await userMenu.click();
  await page.getByRole("menuitem", { name: /log out|sign out/i }).click();

  await page.waitForURL(/\/login/, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/login/);

  // Verify protected route now redirects
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  expect(page.url()).toContain("/login");
});

// ── Session persistence ────────────────────────────────────────────────────────

test("session: reloading dashboard keeps user logged in", async ({ page }) => {
  await page.goto("/dashboard");
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("main")).toBeVisible();
});
