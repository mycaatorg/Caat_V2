/**
 * Auth setup — runs once before the "e2e" project.
 * Signs in and saves the session to tests/e2e/.auth/user.json so all
 * authenticated tests can reuse the session without re-logging in.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

const TEST_EMAIL = "test@gmail.com";
const TEST_PASSWORD = "testtest123";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /login/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: AUTH_FILE });
});
