/**
 * 2.3 Browsing Flows — Schools
 */
import { test, expect } from "@playwright/test";

test.describe("Schools browsing", () => {
  test("page loads with school cards", async ({ page }) => {
    await page.goto("/schools");
    // Wait for content to load (not the loading skeleton)
    await expect(page.getByRole("main")).toBeVisible();
    // At least one school card or empty state should be present
    const cards = page.locator("article, [data-testid='school-card'], .card, [class*='CardContent']");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
  });

  test("search input updates URL q param after debounce", async ({ page }) => {
    await page.goto("/schools");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("MIT");
    // Debounce is ~300ms — wait for URL update
    await page.waitForURL(/q=MIT/, { timeout: 5_000 });
    expect(page.url()).toContain("q=MIT");
  });

  test("clearing search removes q param from URL", async ({ page }) => {
    await page.goto("/schools?q=MIT");
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.clear();
    await page.waitForURL(/\/schools(?!\?q=)/, { timeout: 5_000 });
    expect(page.url()).not.toContain("q=");
  });

  test("country filter updates URL param", async ({ page }) => {
    await page.goto("/schools");
    // Find the country select and change it
    const countrySelect = page.getByRole("combobox").filter({ hasText: /country|all/i });
    await countrySelect.click();
    await page.getByRole("option", { name: /united states|US/i }).click();
    await expect(page).toHaveURL(/country=/);
  });

  test("pagination: next button updates page param", async ({ page }) => {
    await page.goto("/schools");
    const nextBtn = page.getByRole("button", { name: /next/i });
    // Only test if next button is enabled (there are multiple pages)
    const isDisabled = await nextBtn.isDisabled().catch(() => true);
    if (!isDisabled) {
      await nextBtn.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test("pagination: previous button disabled on page 1", async ({ page }) => {
    await page.goto("/schools");
    const prevBtn = page.getByRole("button", { name: /prev/i });
    await expect(prevBtn).toBeDisabled();
  });

  test("school card links to detail page", async ({ page }) => {
    await page.goto("/schools");
    // Click first school card link
    const firstLink = page.locator("a[href^='/schools/']").first();
    await expect(firstLink).toBeVisible({ timeout: 10_000 });
    const href = await firstLink.getAttribute("href");
    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});
