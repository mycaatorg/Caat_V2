/**
 * 2.1 Authentication Flows (unauthenticated paths)
 * 2.2 Route Protection
 *
 * These run WITHOUT saved auth state.
 */
import { test, expect } from "@playwright/test";

// ── 2.2 Route protection ───────────────────────────────────────────────────────

const PROTECTED_ROUTES = [
  "/dashboard",
  "/profile",
  "/schools",
  "/majors",
  "/scholarships",
  "/documents",
  "/essays",
  "/resume-builder",
];

for (const route of PROTECTED_ROUTES) {
  test(`unauthenticated visit to ${route} redirects to /login`, async ({ page }) => {
    await page.goto(route);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain("/login");
  });

  test(`redirect to ${route} preserves next param`, async ({ page }) => {
    await page.goto(route);
    await page.waitForURL(/\/login/);
    expect(page.url()).toContain(`next=${encodeURIComponent(route)}`);
  });
}

// ── 2.2 Public routes ──────────────────────────────────────────────────────────

test("public: /login accessible without auth", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
});

test("public: /signup accessible without auth", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
});

test("public: /forgot-password accessible without auth", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("button", { name: /send|reset|submit/i })).toBeVisible();
});

test("public: /reset-password accessible without auth", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByText("Invalid or expired link")).toBeVisible({ timeout: 10_000 });
});

// ── 2.1 Login form ─────────────────────────────────────────────────────────────

test("login: renders email + password inputs and submit button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /login/i })).toBeVisible();
});

test("login: link to signup page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible();
});

test("login: link to forgot password page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();
});

test("login: invalid credentials shows error message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("notareal@example.com");
  await page.getByLabel("Password").fill("wrongpassword123");
  await page.getByRole("button", { name: /login/i }).click();
  await expect(page.getByText(/invalid|credentials|incorrect/i)).toBeVisible({ timeout: 10_000 });
});

// ── 2.1 Signup form ────────────────────────────────────────────────────────────

test("signup: renders name, email, password, confirm password inputs", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByLabel(/name/i)).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/^password/i)).toBeVisible();
  await expect(page.getByLabel(/confirm/i)).toBeVisible();
});

test("signup: link back to login", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("link", { name: /log in|login|sign in/i })).toBeVisible();
});

test("signup: mismatched passwords shows error", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel(/name/i).fill("Test User");
  await page.getByLabel(/email/i).fill("test@example.com");
  await page.getByLabel(/^password/i).fill("password123");
  await page.getByLabel(/confirm/i).fill("differentpassword");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/do not match/i)).toBeVisible({ timeout: 5_000 });
});

// ── 2.1 Forgot password ────────────────────────────────────────────────────────

test("forgot-password: renders email input and submit button", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /send|reset|submit/i })).toBeVisible();
});

test("forgot-password: back to login link", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("link", { name: /back|login/i })).toBeVisible();
});

// ── 2.1 Reset password (no token) ─────────────────────────────────────────────

test("reset-password: without token shows invalid link message", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByText("Invalid or expired link")).toBeVisible({ timeout: 10_000 });
});

test("reset-password: shows link to request new reset when invalid", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page.getByRole("button", { name: /request new link/i })).toBeVisible({ timeout: 10_000 });
});
