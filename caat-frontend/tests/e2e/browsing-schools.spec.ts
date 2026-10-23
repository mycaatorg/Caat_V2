/**
 * 2.3 Browsing Flows — Schools
 */
import { test, expect } from "@playwright/test";

test.describe("Schools browsing", () => {
  test("page loads with school cards or empty state", async ({ page }) => {
    await page.goto("/schools");
    // SidebarInset + page <main> both match — use .first() to avoid strict mode violation
    await expect(page.getByRole("main").first()).toBeVisible();
    // Wait for the loading state to resolve — either cards or empty state
    await expect(
      page.locator("a[href^='/schools/']").first()
        .or(page.getByText(/no (schools|universities) found/i))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("search input updates URL q param after debounce", async ({ page }) => {
    await page.goto("/schools");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("MIT");
    await page.waitForURL(/q=MIT/, { timeout: 5_000 });
    expect(page.url()).toContain("q=MIT");
  });

  test("clearing search removes q param from URL", async ({ page }) => {
    await page.goto("/schools?q=MIT");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.clear();
    await page.waitForURL(/\/schools(?!\?.*q=)/, { timeout: 5_000 });
    expect(page.url()).not.toContain("q=");
  });

  test("country filter updates URL param", async ({ page }) => {
    await page.goto("/schools");
    // CountrySelect is the first combobox; SortSelect is the second — use .first() to avoid strict mode
    const trigger = page.getByRole("combobox").first();
    await trigger.click();
    await page.getByRole("option", { name: /united states/i }).click();
    await expect(page).toHaveURL(/country=/, { timeout: 5_000 });
  });

});
