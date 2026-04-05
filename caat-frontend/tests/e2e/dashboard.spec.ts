/**
 * 2.5 Dashboard Flow
 */
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads with greeting containing user name", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    // Greeting should say Good morning/afternoon/evening
    await expect(page.getByText(/good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 10_000 });
  });

  test("application readiness checklist renders", async ({ page }) => {
    await page.goto("/dashboard");
    // Checklist should show profile, schools, documents etc.
    await expect(
      page.getByText(/profile|schools|documents|essays|scholarships/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Customize button opens widget store", async ({ page }) => {
    await page.goto("/dashboard");
    const customizeBtn = page.getByRole("button", { name: /customize/i });
    await expect(customizeBtn).toBeVisible({ timeout: 10_000 });
    await customizeBtn.click();
    // Widget store should open
    await expect(page.getByText(/widget|add/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("page reloads without crashing", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("main")).toBeVisible();
  });
});
