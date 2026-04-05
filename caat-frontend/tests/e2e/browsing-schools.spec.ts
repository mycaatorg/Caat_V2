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
        .or(page.getByText(/no schools found/i))
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

  test("pagination: next link updates page param", async ({ page }) => {
    await page.goto("/schools");
    // Schools uses Link not button for pagination
    const nextLink = page.getByRole("link", { name: /next/i });
    const isVisible = await nextLink.isVisible({ timeout: 5_000 }).catch(() => false);
    if (isVisible) {
      await nextLink.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test("pagination: previous is absent or disabled on page 1", async ({ page }) => {
    await page.goto("/schools");
    // On page 1 there should be no previous link
    const prevLink = page.getByRole("link", { name: /prev/i });
    const prevVisible = await prevLink.isVisible({ timeout: 3_000 }).catch(() => false);
    expect(prevVisible).toBe(false);
  });

  test("school card links to detail page", async ({ page }) => {
    await page.goto("/schools");
    const firstLink = page.locator("a[href^='/schools/']").first();
    await expect(firstLink).toBeVisible({ timeout: 15_000 });
    const href = await firstLink.getAttribute("href");
    await firstLink.click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});
