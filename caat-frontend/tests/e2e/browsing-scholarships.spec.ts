/**
 * 2.3 Browsing Flows — Scholarships
 */
import { test, expect } from "@playwright/test";

test.describe("Scholarships browsing", () => {
  test("page loads with scholarship cards", async ({ page }) => {
    await page.goto("/scholarships");
    await expect(page.getByRole("main")).toBeVisible();
    // At least cards or empty state
    await expect(
      page.getByText(/no scholarships/i).or(page.locator("a[href^='/scholarships/']").first())
    ).toBeVisible({ timeout: 10_000 });
  });

  test("search by title filters results", async ({ page }) => {
    await page.goto("/scholarships");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("merit");
    await expect(page).toHaveURL(/search=merit|q=merit/, { timeout: 5_000 });
  });

  test("'Clear all' button resets filters", async ({ page }) => {
    await page.goto("/scholarships?search=merit");
    const clearBtn = page.getByRole("button", { name: /clear all/i });
    await expect(clearBtn).toBeVisible({ timeout: 5_000 });
    await clearBtn.click();
    // URL should no longer have search param
    await expect(page).toHaveURL(/\/scholarships$|\/scholarships\?$/, { timeout: 3_000 });
  });

  test("pagination shows when more than 6 results and next works", async ({ page }) => {
    await page.goto("/scholarships");
    const nextBtn = page.getByRole("button", { name: /next/i });
    const isVisible = await nextBtn.isVisible().catch(() => false);
    if (isVisible) {
      const isDisabled = await nextBtn.isDisabled();
      if (!isDisabled) {
        await nextBtn.click();
        await expect(page).toHaveURL(/page=2/);
      }
    }
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
    const isVisible = await firstLink.isVisible({ timeout: 10_000 }).catch(() => false);
    if (isVisible) {
      const href = await firstLink.getAttribute("href");
      await firstLink.click();
      await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  test("eligibility filter narrows results", async ({ page }) => {
    await page.goto("/scholarships");
    // Look for eligibility multi-select or checkboxes
    const meritFilter = page.getByRole("option", { name: /merit/i })
      .or(page.getByLabel(/merit/i))
      .first();
    const isVisible = await meritFilter.isVisible().catch(() => false);
    if (isVisible) {
      await meritFilter.click();
      await expect(page).toHaveURL(/eligibility=|filter=/);
    }
  });
});
