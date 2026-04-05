/**
 * 2.1 Authentication Flows — authenticated paths (login, logout, session)
 */
import { test, expect } from "@playwright/test";

test("login: successful login redirects to /dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("main").first()).toBeVisible();
});

test("login: ?next param redirects to target page after login", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile/);
});

test("logout: after logout visiting /dashboard redirects to /login", async ({ browser }) => {
  // Use a fresh isolated context to avoid invalidating the shared auth session stored in .auth/user.json.
  // Supabase invalidates tokens server-side on signOut, so we must use separate tokens.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const freshPage = await context.newPage();

  // Fresh login — gets new session tokens distinct from the shared storageState
  await freshPage.goto("/login");
  await freshPage.getByLabel("Email").fill("test@gmail.com");
  await freshPage.getByLabel("Password").fill("testtest123");
  await freshPage.getByRole("button", { name: /login/i }).click();
  await freshPage.waitForURL(/\/dashboard/, { timeout: 15_000 });

  // Wait for the nav-user button to load (rendered asynchronously after supabase.auth.getUser)
  const navUserBtn = freshPage.locator("[data-sidebar='menu-button']").filter({ hasText: /test@gmail\.com/ });
  await expect(navUserBtn).toBeVisible({ timeout: 10_000 });
  await navUserBtn.click();

  await freshPage.getByText("Log out").click();
  await freshPage.waitForURL(/\/login/, { timeout: 10_000 });
  await expect(freshPage).toHaveURL(/\/login/);

  // After logout, /dashboard should redirect back to /login
  await freshPage.goto("/dashboard");
  await freshPage.waitForURL(/\/login/);
  expect(freshPage.url()).toContain("/login");

  await context.close();
});

test("session: reloading dashboard keeps user logged in", async ({ page }) => {
  await page.goto("/dashboard");
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("main").first()).toBeVisible();
});
