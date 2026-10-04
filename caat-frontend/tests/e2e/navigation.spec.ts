/**
 * 2.10 Navigation & Layout
 */
import { test, expect } from "@playwright/test";

const NAV_ITEMS = [
  { name: /dashboard/i, url: /\/dashboard/ },
  { name: /profile/i, url: /\/profile/ },
  { name: /schools/i, url: /\/schools/ },
  { name: /majors/i, url: /\/majors/ },
  { name: /scholarships/i, url: /\/scholarships/ },
  { name: /documents/i, url: /\/documents/ },
  { name: /essays/i, url: /\/essays/ },
  { name: /resume/i, url: /\/resume-builder/ },
];

test.describe("Navigation", () => {
  test("sidebar renders all 8 navigation items", async ({ page }) => {
    await page.goto("/dashboard");
    for (const { name } of NAV_ITEMS) {
      await expect(page.getByRole("link", { name }).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  for (const { name, url } of NAV_ITEMS) {
    test(`clicking ${name.source} nav item navigates correctly`, async ({ page }) => {
      await page.goto("/dashboard");
      await page.getByRole("link", { name }).first().click();
      await expect(page).toHaveURL(url, { timeout: 10_000 });
    });
  }

  test("active nav item is highlighted on current page", async ({ page }) => {
    await page.goto("/profile");
    const activeLink = page.getByRole("link", { name: /profile/i }).first();
    // Sidebar sets data-active="true" on the active item
    await expect(activeLink).toHaveAttribute("data-active", "true", { timeout: 5_000 });
  });

  test("theme toggle switches theme", async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for nav-user to load (rendered asynchronously after supabase.auth.getUser)
    const testEmail = process.env.E2E_TEST_EMAIL;
    expect(testEmail, "isolated browser job must configure E2E_TEST_EMAIL").toBeTruthy();
    const navUserBtn = page.locator("[data-sidebar='menu-button']").filter({ hasText: testEmail! });
    await expect(navUserBtn).toBeVisible({ timeout: 10_000 });
    await navUserBtn.click();
    const isDark = await page.locator("html").evaluate((html) => html.classList.contains("dark"));
    const targetTheme = isDark ? "Light" : "Dark";
    const themeItem = page.getByRole("menuitem", { name: targetTheme, exact: true });
    await expect(themeItem).toBeVisible({ timeout: 5_000 });
    await themeItem.click();
    await expect.poll(() => page.locator("html").evaluate((html) => html.classList.contains("dark"))).toBe(!isDark);
  });
});
