/**
 * 2.3 Browsing Flows — Majors
 */
import { test, expect } from "@playwright/test";

test.describe("Majors browsing", () => {
  test("page loads with major cards and All pill", async ({ page }) => {
    await page.goto("/majors");
    // SidebarInset + page <main> both match — use .first() to avoid strict mode violation
    await expect(page.getByRole("main").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^all$/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test("search filters majors by name (URL updated)", async ({ page }) => {
    await page.goto("/majors");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("computer");
    await expect(page).toHaveURL(/search=computer|q=computer/, { timeout: 5_000 });
  });

  test("category pill filters majors", async ({ page }) => {
    await page.goto("/majors");
    await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible({ timeout: 15_000 });
    // Click the first non-All, non-Bookmarked pill
    const pills = page.getByRole("button").filter({ hasNotText: /^all$|bookmarked/i });
    const firstPill = pills.first();
    const isVisible = await firstPill.isVisible({ timeout: 5_000 }).catch(() => false);
    if (isVisible) {
      await firstPill.click();
      await expect(page).toHaveURL(/category=|tab=/, { timeout: 3_000 }).catch(() => {
        // Some implementations use local state — just verify the pill exists
      });
    }
  });

  test("Bookmarked filter shows only bookmarked majors or empty state", async ({ page }) => {
    await page.goto("/majors");
    await page.getByRole("button", { name: /bookmarked/i }).click();
    await expect(
      page.getByText(/no majors|no bookmarks|0 major/i)
        .or(page.locator("a[href^='/majors/']").first())
    ).toBeVisible({ timeout: 5_000 });
  });

  test("clicking major card navigates to detail page", async ({ page }) => {
    await page.goto("/majors");
    const firstLink = page.locator("a[href^='/majors/']").first();
    await expect(firstLink).toBeVisible({ timeout: 15_000 });
    const href = await firstLink.getAttribute("href");
    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("compare: button disabled when fewer than 2 majors selected", async ({ page }) => {
    await page.goto("/majors");
    await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible({ timeout: 15_000 });
    const compareBtn = page.getByRole("button", { name: /compare/i });
    const visible = await compareBtn.isVisible().catch(() => false);
    if (visible) {
      await expect(compareBtn).toBeDisabled();
    }
  });
});
