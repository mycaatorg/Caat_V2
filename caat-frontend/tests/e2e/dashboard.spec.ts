/**
 * 2.5 Dashboard Flow
 */
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads with greeting", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 10_000 });
  });

  test("application readiness checklist renders", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByText(/profile|schools|documents|essays|scholarships/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Widget Store button is visible and opens store", async ({ page }) => {
    await page.goto("/dashboard");
    // Button text is "Widget Store"
    const storeBtn = page.getByRole("button", { name: /widget store/i });
    await expect(storeBtn).toBeVisible({ timeout: 10_000 });
    await storeBtn.click();
    // Sheet should open showing "Widget Store" title
    await expect(page.getByText("Widget Store").nth(1)).toBeVisible({ timeout: 5_000 });
  });

  test("page reloads without crashing", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("main")).toBeVisible();
  });
});
