/**
 * Auth setup — runs once before the "e2e" project.
 * Signs in and saves the session to tests/e2e/.auth/user.json so all
 * authenticated tests can reuse the session without re-logging in.
 */
import { test as setup, expect } from "@playwright/test";
import path from "path";
import { assertIsolatedE2EEnvironment } from "../../lib/isolated-e2e-csp";

const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  assertIsolatedE2EEnvironment(process.env);
  const TEST_EMAIL = process.env.E2E_TEST_EMAIL;
  const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("E2E_TEST_EMAIL and E2E_TEST_PASSWORD are required; E2E never falls back to a shared account.");
  }

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/today/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/today/);

  await page.context().storageState({ path: AUTH_FILE });
});
