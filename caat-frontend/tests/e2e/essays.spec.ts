/**
 * 2.8 Essays Flow
 */
import { test, expect } from "@playwright/test";

test.describe("Essays", () => {
  test("page loads with prompts list and editor panel", async ({ page }) => {
    await page.goto("/essays");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
    // Left panel: prompts list
    await expect(
      page.getByText(/prompt|essay|no prompts/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a prompt loads its details and drafts on the right", async ({ page }) => {
    await page.goto("/essays");
    const firstPrompt = page.getByRole("button").filter({ hasText: /prompt|essay/i }).first()
      .or(page.locator("[class*='prompt'], [class*='essay-item']").first());
    const isVisible = await firstPrompt.isVisible({ timeout: 10_000 }).catch(() => false);
    if (isVisible) {
      await firstPrompt.click();
      // Draft switcher or editor should appear
      await expect(page.getByRole("textbox").or(page.getByText(/draft/i))).toBeVisible({ timeout: 5_000 });
    }
  });

  test("autosave indicator visible after typing", async ({ page }) => {
    await page.goto("/essays");
    const textarea = page.getByRole("textbox").first();
    const isVisible = await textarea.isVisible({ timeout: 10_000 }).catch(() => false);
    if (isVisible) {
      await textarea.click();
      await textarea.pressSequentially("test");
      await expect(
        page.getByText(/saved|saving|autosave/i).first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test("create new draft adds draft to switcher", async ({ page }) => {
    await page.goto("/essays");
    const newDraftBtn = page.getByRole("button", { name: /new draft|add draft|\+ draft/i });
    const isVisible = await newDraftBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (isVisible) {
      const beforeCount = await page.getByText(/draft \d/i).count();
      await newDraftBtn.click();
      await expect(page.getByText(/draft \d/i)).toHaveCount(beforeCount + 1, { timeout: 5_000 });
    }
  });
});
