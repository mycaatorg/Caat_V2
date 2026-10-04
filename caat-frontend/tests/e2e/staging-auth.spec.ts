/**
 * End-to-end Auth lifecycle against disposable local Supabase only.
 * Never bypasses the UI preflight, Turnstile, or Supabase password grant.
 */
import { expect, test, type Page } from "@playwright/test";
import routeCoverage from "./route-coverage.json";

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const EMAIL = `e2e.signup.${RUN_ID}@caat.local.test`;
const FULL_NAME = `E2E Signup ${RUN_ID}`;

test.setTimeout(90_000);

type RouteContract = { route: string; access: string; kind: string; coverage: string; expected?: string };

function routeContract(path: string): RouteContract {
  const contract = routeCoverage.routes.find((route) => route.route === path);
  expect(contract, `route-coverage.json must define ${path}`).toBeDefined();
  return contract!;
}

function assertLoopbackUrl(value: string | undefined, label: string): URL {
  if (!value) throw new Error(`${label} must be set for isolated Auth journeys`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error(`${label} must use an HTTP loopback URL`);
  }
  return url;
}

test.beforeAll(() => {
  if (process.env.CAAT_ISOLATED_E2E !== "1") {
    throw new Error("Refusing signup writes without CAAT_ISOLATED_E2E=1");
  }
  assertLoopbackUrl(process.env.PLAYWRIGHT_BASE_URL, "PLAYWRIGHT_BASE_URL");
  assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.E2E_TEST_PASSWORD || process.env.E2E_TEST_PASSWORD.length < 12) {
    throw new Error("E2E_TEST_PASSWORD must be a disposable local password of at least 12 characters");
  }
});

async function signOutFromSidebar(page: Page) {
  const accountMenu = page.getByRole("button").filter({ hasText: EMAIL }).last();
  await expect(accountMenu).toBeVisible({ timeout: 10_000 });
  await accountMenu.click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await page.waitForURL(/\/login(?:$|\?)/, { timeout: 15_000 });
}

async function signInWithNewAccount(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });
}

async function expectSignedInDashboard(page: Page, dashboardLabel: string) {
  // The dashboard's h1 is personalized (for example, "Good afternoon, Ada");
  // its stable route label is the breadcrumb, not a literal h1 named Dashboard.
  await expect(page.getByRole("navigation", { name: "breadcrumb" }).getByRole("link", { name: dashboardLabel, exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(FULL_NAME, { timeout: 15_000 });
}

test("new account signs up, logs out, logs in, and can delete its own account", async ({ page }) => {
  const signupRoute = routeContract("/signup");
  const dashboardRoute = routeContract("/dashboard");
  const settingsRoute = routeContract("/settings");
  expect(signupRoute.access).toBe("public");
  expect(dashboardRoute.access).toBe("authenticated");
  expect(settingsRoute.access).toBe("authenticated");

  const password = process.env.E2E_TEST_PASSWORD!;
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: signupRoute.expected!, exact: true })).toBeVisible();
  await page.getByLabel("Full Name", { exact: true }).fill(FULL_NAME);
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create Account", exact: true }).click();

  // Local Supabase is configured with confirmations disabled, so a real signup
  // must establish a session. A confirmation screen is deliberately a failure.
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });
  await expectSignedInDashboard(page, dashboardRoute.expected!);
  await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();

  await signOutFromSidebar(page);
  await page.goto("/dashboard");
  await page.waitForURL(/\/login(?:$|\?)/, { timeout: 15_000 });

  await signInWithNewAccount(page);
  await expectSignedInDashboard(page, dashboardRoute.expected!);
  await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();

  // Delete only this newly-created synthetic account through the real settings UI.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: settingsRoute.expected!, exact: true })).toBeVisible({ timeout: 15_000 });
  const accountSection = page.getByRole("region", { name: "Data and account" });
  await accountSection.getByRole("button", { name: "Delete my account", exact: true }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Delete your account?" });
  await confirmDialog.getByPlaceholder("DELETE").fill("DELETE");
  await confirmDialog.getByRole("button", { name: "Delete my account", exact: true }).click();
  await expect(page.getByText("Your account has been deleted.", { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.goto("/dashboard");
  await page.waitForURL(/\/login(?:$|\?)/, { timeout: 15_000 });
});
