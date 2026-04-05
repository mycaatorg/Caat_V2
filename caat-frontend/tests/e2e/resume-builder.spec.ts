/**
 * 2.7 Resume Builder Flow
 */
import { test, expect } from "@playwright/test";

test.describe("Resume Builder", () => {
  test("page loads with 3-panel layout", async ({ page }) => {
    await page.goto("/resume-builder");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/personal|education|experience|skills/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("clicking a section in structure panel loads the editor", async ({ page }) => {
    await page.goto("/resume-builder");
    const sectionBtn = page.getByRole("button", { name: /personal|education|experience/i }).first();
    await expect(sectionBtn).toBeVisible({ timeout: 10_000 });
    await sectionBtn.click();
    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: 3_000 });
  });

  test("autosave indicator shown after editing content", async ({ page }) => {
    await page.goto("/resume-builder");
    // Must select a section first to load its editor (textboxes are only visible inside an active section)
    const sectionBtn = page.getByRole("button", { name: /personal|education|experience/i }).first();
    await expect(sectionBtn).toBeVisible({ timeout: 10_000 });
    await sectionBtn.click();
    // Now the editor panel renders its textboxes
    const textbox = page.getByRole("textbox").first();
    await expect(textbox).toBeVisible({ timeout: 5_000 });
    await textbox.click();
    await textbox.pressSequentially(" ");
    // Autosave shows "Saving…" then "Last saved on: ..."
    await expect(
      page.getByText(/saving|last saved/i).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test("resume title select is visible", async ({ page }) => {
    await page.goto("/resume-builder");
    // Title is rendered as a <select> in view mode
    const titleSelect = page.locator("select").first();
    await expect(titleSelect).toBeVisible({ timeout: 10_000 });
  });

  test("print/PDF button is visible", async ({ page }) => {
    await page.goto("/resume-builder");
    await expect(
      page.getByRole("button", { name: /print.*pdf|pdf|print/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
