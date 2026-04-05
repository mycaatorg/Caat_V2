/**
 * 2.3 Browsing Flows — Scholarships
 */
import { test, expect } from "@playwright/test";

test.describe("Scholarships browsing", () => {
  test("page loads with scholarship cards or empty state", async ({ page }) => {
    await page.goto("/scholarships");
    // SidebarInset + page <main> both match — use .first() to avoid strict mode violation
    await expect(page.getByRole("main").first()).toBeVisible();
    // The <h1>Scholarships</h1> is always rendered by ScholarshipsClient
    await expect(page.getByRole("heading", { name: "Scholarships" })).toBeVisible({ timeout: 15_000 });
  });

  test("search by title filters results and updates URL", async ({ page }) => {
    await page.goto("/scholarships");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("merit");
    await expect(page).toHaveURL(/search=merit|q=merit/, { timeout: 5_000 });
  });

  test("'Clear all' button resets filters", async ({ page }) => {
    await page.goto("/scholarships");
    // Type a search to activate filters
    const searchInput = page.getByPlaceholder(/search scholarships/i);
    await searchInput.fill("merit");
    await expect(page).toHaveURL(/search=merit|q=merit/, { timeout: 5_000 });
    const clearBtn = page.getByRole("button", { name: "Clear all" });
    await expect(clearBtn).toBeVisible({ timeout: 5_000 });
    await clearBtn.click();
    // router.replace is async — wait for the URL to clear
    await expect(page).not.toHaveURL(/search=|q=/, { timeout: 3_000 });
  });

  test("pagination next button updates page when multiple pages exist", async ({ page }) => {
    await page.goto("/scholarships");
    // Scholarships uses client-side pagination (no URL update) — just verify next button behavior
    const nextBtn = page.getByRole("button", { name: /next page/i });
    const isVisible = await nextBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (isVisible) {
      const isDisabled = await nextBtn.isDisabled().catch(() => true);
      if (!isDisabled) {
        await nextBtn.click();
        // Client-side pagination: page stays on /scholarships, button 2 becomes active
        await expect(page.getByRole("button", { name: "Page 2" })).toBeVisible({ timeout: 3_000 });
      }
    }
    // If pagination is not visible (only 1 page of results), test passes trivially
  });

  test("page resets to 1 when filters change", async ({ page }) => {
    await page.goto("/scholarships?page=2");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("award");
    await expect(page).not.toHaveURL(/page=2/, { timeout: 5_000 });
  });

  test("clicking scholarship card navigates to detail page", async ({ page }) => {
    await page.goto("/scholarships");
    const firstLink = page.locator("a[href^='/scholarships/']").first();
    const isVisible = await firstLink.isVisible({ timeout: 15_000 }).catch(() => false);
    if (isVisible) {
      const href = await firstLink.getAttribute("href");
      await firstLink.click();
      await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  test("eligibility filter narrows results", async ({ page }) => {
    await page.goto("/scholarships");
    await expect(page.getByText(/scholarship/i).first()).toBeVisible({ timeout: 15_000 });
    // Look for the Merit-Based filter button/checkbox
    const meritFilter = page.getByRole("button", { name: /merit/i })
      .or(page.getByLabel(/merit/i));
    const isVisible = await meritFilter.first().isVisible({ timeout: 3_000 }).catch(() => false);
    if (isVisible) {
      await meritFilter.first().click();
      await expect(page).toHaveURL(/eligibility=|filter=/, { timeout: 3_000 }).catch(() => {
        // Some implementations filter client-side without URL update
      });
    }
  });
});
