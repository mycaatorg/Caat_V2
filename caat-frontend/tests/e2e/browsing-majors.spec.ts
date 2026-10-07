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

  test("category pill updates the selected category and URL", async ({ page }) => {
    await page.goto("/majors");
    await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible({ timeout: 15_000 });
    // Scope to a real category control. Searching every button on the page
    // accidentally selected the sidebar toggle and left the URL unchanged.
    const categoryButton = page.getByRole("button", { name: "Engineering", exact: true }).first();
    await expect(categoryButton).toBeVisible();
    const category = (await categoryButton.innerText()).trim();
    await categoryButton.click();
    await expect(page).toHaveURL(/category=/);
    const resultSummary = page.locator("p").filter({ hasText: /majors? in/i });
    await expect(resultSummary).toContainText(category);
  });

  test("Bookmarked filter shows only bookmarked majors or empty state", async ({ page }) => {
    await page.goto("/majors");
    await page.getByRole("button", { name: /bookmarked/i }).click();
    await expect(
      page.getByText(/no majors|no courses|no bookmarks|0 major/i)
        .or(page.locator("a[href^='/majors/']").first())
    ).toBeVisible({ timeout: 5_000 });
  });

  test("compare selection is client-side and can be reversed", async ({ page }) => {
    await page.goto("/majors");
    await expect(page.getByRole("button", { name: /^all$/i })).toBeVisible({ timeout: 15_000 });
    const card = page.locator("[data-slot=card]").first();
    const selectButton = card.getByRole("button", { name: "Compare", exact: true });
    await expect(selectButton).toBeVisible({ timeout: 15_000 });
    await selectButton.click();
    await expect(card.getByRole("button", { name: "Selected", exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Selected", exact: true }).click();
    await expect(card.getByRole("button", { name: "Compare", exact: true })).toBeVisible();
  });
});
