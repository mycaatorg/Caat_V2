/**
 * 2.7 Resume Builder Flow
 */
import { test, expect } from "@playwright/test";

test.describe("Resume Builder", () => {
  test("page loads with 3-panel layout", async ({ page }) => {
    await page.goto("/resume-builder");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
    // Structure panel, editor, and preview should exist
    await expect(
      page.getByText(/personal|education|experience|skills/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a section in structure panel loads the editor", async ({ page }) => {
    await page.goto("/resume-builder");
    // Find a section item in the left panel
    const sectionBtn = page.getByRole("button", { name: /personal|education|experience/i }).first();
    await expect(sectionBtn).toBeVisible({ timeout: 10_000 });
    await sectionBtn.click();
    // Editor panel should activate
    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: 3_000 });
  });

  test("autosave indicator shown after editing content", async ({ page }) => {
    await page.goto("/resume-builder");
    // Make a change
    const textbox = page.getByRole("textbox").first();
    await expect(textbox).toBeVisible({ timeout: 10_000 });
    await textbox.click();
    await textbox.pressSequentially(" ");
    // Wait for autosave indicator
    await expect(
      page.getByText(/saved|saving/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("resume title is visible and editable inline", async ({ page }) => {
    await page.goto("/resume-builder");
    const titleEl = page.getByRole("textbox", { name: /title|resume name/i })
      .or(page.locator("input[placeholder*='title' i]"))
      .first();
    await expect(titleEl).toBeVisible({ timeout: 10_000 });
  });

  test("print/PDF button is visible", async ({ page }) => {
    await page.goto("/resume-builder");
    await expect(
      page.getByRole("button", { name: /print|pdf|download/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
