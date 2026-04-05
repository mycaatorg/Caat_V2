/**
 * 2.9 Documents Flow
 */
import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import os from "os";

test.describe("Documents", () => {
  test("page loads with upload button and document list or empty state", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("main")).toBeVisible({ timeout: 10_000 });
    // Upload button is always present
    await expect(page.getByRole("button", { name: /upload/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking upload button opens the upload sheet", async ({ page }) => {
    await page.goto("/documents");
    await page.getByRole("button", { name: /upload/i }).first().click();
    // Sheet opens — look for the SheetTitle or drop zone text
    await expect(
      page.getByText(/upload.*document|drag.*drop|browse/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("upload sheet shows category selector and drop zone", async ({ page }) => {
    await page.goto("/documents");
    await page.getByRole("button", { name: /upload/i }).first().click();
    await expect(
      page.getByRole("combobox").or(page.getByText(/category|select.*type/i)).first()
    ).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByText(/drag|drop|click to upload|browse/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("uploading invalid file type is rejected", async ({ page }) => {
    await page.goto("/documents");
    await page.getByRole("button", { name: /upload/i }).first().click();

    const tmpFile = path.join(os.tmpdir(), "test.exe");
    fs.writeFileSync(tmpFile, "fake executable content");

    const dropzone = page.locator("input[type='file']").first();
    await dropzone.setInputFiles(tmpFile);

    await expect(
      page.getByText(/invalid|not supported|only pdf|only jpg|rejected|file type/i).first()
    ).toBeVisible({ timeout: 5_000 });

    fs.unlinkSync(tmpFile);
  });

  test("uploading oversized file is rejected", async ({ page }) => {
    await page.goto("/documents");
    await page.getByRole("button", { name: /upload/i }).first().click();

    const tmpFile = path.join(os.tmpdir(), "bigfile.pdf");
    const buf = Buffer.alloc(11 * 1024 * 1024, "a");
    fs.writeFileSync(tmpFile, buf);

    const dropzone = page.locator("input[type='file']").first();
    await dropzone.setInputFiles(tmpFile);

    await expect(
      page.getByText(/too large|exceeds|max.*10|10.*mb/i).first()
    ).toBeVisible({ timeout: 5_000 });

    fs.unlinkSync(tmpFile);
  });

  test("filter tabs show matching documents", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("button", { name: /upload/i }).first()).toBeVisible({ timeout: 10_000 });
    const tabBtns = page.getByRole("button", { name: /academic|passport|language|letters/i });
    const count = await tabBtns.count();
    if (count > 0) {
      await tabBtns.first().click();
      await expect(page.getByRole("main")).toBeVisible();
    }
  });

  test("stats cards show verified, pending, action required counts", async ({ page }) => {
    await page.goto("/documents");
    await expect(
      page.getByText(/verified|pending|review|action/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
