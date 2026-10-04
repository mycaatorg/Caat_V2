import { test, expect } from "@playwright/test";

test("public home page renders its main content", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("link", { name: /scholarships/i }).first()).toBeVisible();
});

test("login and signup render without submitting authentication forms", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();

  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("public scholarship directory renders stable search controls", async ({ page }) => {
  const response = await page.goto("/scholarship");
  expect(response?.status(), "public scholarship directory response").toBeLessThan(500);
  await expect(
    page.getByRole("heading", { name: "Find scholarships for your Australian university journey" }),
  ).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search scholarships" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Study level" })).toBeVisible();
});

test("unknown public scholarship slug returns the not-found page", async ({ page }) => {
  const response = await page.goto("/scholarship/codex-ci-missing-scholarship-fixture");
  expect(response?.status(), "unknown scholarship should use the 404 route").toBe(404);
  await expect(page.getByRole("main")).toBeVisible();
});

test("protected route redirects unauthenticated visitors to login with the target", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?/);

  const loginUrl = new URL(page.url());
  expect(loginUrl.searchParams.get("next")).toBe("/dashboard");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});
