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
    // The active link should have some visual distinction (aria-current or active class)
    const activeLink = page.getByRole("link", { name: /profile/i }).first();
    await expect(activeLink).toHaveAttribute("data-active", "true", { timeout: 5_000 })
      .catch(async () => {
        // Some sidebar implementations use aria-current
        await expect(activeLink).toHaveAttribute("aria-current", "page");
      });
  });

  test("theme toggle switches between light and dark mode", async ({ page }) => {
    await page.goto("/dashboard");
    // Open user menu
    const userMenu = page.locator("[data-sidebar='menu-button']").last();
    await userMenu.click();
    const themeToggle = page.getByRole("menuitem", { name: /theme|dark|light/i });
    await expect(themeToggle).toBeVisible({ timeout: 5_000 });
    await themeToggle.click();
    // HTML element should have dark class or data-theme changed
    await expect(page.locator("html")).toHaveAttribute("class", /dark/, { timeout: 3_000 })
      .catch(async () => {
        await expect(page.locator("html")).toHaveAttribute("data-theme", /dark/);
      });
  });
});
