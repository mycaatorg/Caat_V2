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
    const navUserBtn = page.locator("[data-sidebar='menu-button']").filter({ hasText: /test@gmail\.com/ });
    await expect(navUserBtn).toBeVisible({ timeout: 10_000 });
    await navUserBtn.click();
    // Theme toggle item — text is "Light Mode" or "Dark Mode" depending on current theme
    const themeItem = page.getByText(/light mode|dark mode/i);
    await expect(themeItem).toBeVisible({ timeout: 5_000 });
    const currentThemeText = await themeItem.textContent();
    await themeItem.click();
    // Dropdown closes after click; re-open to verify theme toggled
    await navUserBtn.click();
    const newThemeText = await page.getByText(/light mode|dark mode/i).textContent().catch(() => null);
    if (newThemeText && currentThemeText) {
      expect(newThemeText).not.toBe(currentThemeText);
    }
  });
});
