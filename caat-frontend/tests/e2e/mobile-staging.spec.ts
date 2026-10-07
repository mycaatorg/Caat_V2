/**
 * Signed-in phone checks for a disposable local Supabase instance only: every
 * student page fits the screen and the menu reaches the core tools.
 */
import { expect, test, type Page } from "@playwright/test";
import { sidewaysOverflow } from "./phone";
import routeCoverage from "./route-coverage.json";

const STUDENT_EMAIL = "e2e.student@caat.local.test";

// Every signed-in page in the route manifest.
const STUDENT_PAGES = routeCoverage.routes
  .filter((entry) => entry.kind === "static" && entry.access === "authenticated")
  .map((entry) => entry.route);

test.beforeAll(() => {
  if (process.env.CAAT_ISOLATED_E2E !== "1") {
    throw new Error("Refusing to run signed-in phone checks without CAAT_ISOLATED_E2E=1");
  }
  for (const name of ["PLAYWRIGHT_BASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    const host = new URL(process.env[name] ?? "http://invalid").hostname;
    if (!["localhost", "127.0.0.1"].includes(host)) throw new Error(`${name} must point at a loopback host`);
  }
  if (!process.env.E2E_TEST_PASSWORD) throw new Error("E2E_TEST_PASSWORD must be set for the seeded local student");
});

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(STUDENT_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|today|welcome)(?:$|\?)/, { timeout: 20_000 });
}

test("every student page fits a phone screen without sideways scrolling", { tag: "@phone" }, async ({ page }) => {
  // Sign-in plus every signed-in page; a cold dev server compiles each route.
  test.setTimeout(120_000);
  await signIn(page);
  const problems: string[] = [];
  for (const route of STUDENT_PAGES) {
    await page.goto(route);
    await expect(page.getByRole("main").first()).toBeVisible({ timeout: 15_000 });
    // Let late content (lists, images) settle before measuring.
    await page.waitForLoadState("networkidle").catch(() => {});
    const overflow = await sidewaysOverflow(page);
    if (overflow.length) problems.push(`${route}: ${overflow.join(", ")}`);
  }
  expect(problems).toEqual([]);
});

test("the phone menu opens, reaches a tool and closes again", { tag: "@phone" }, async ({ page }) => {
  await signIn(page);
  const toggle = page.getByRole("button", { name: "Toggle Sidebar" }).first();
  await expect(toggle).toBeVisible();
  await toggle.click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  // "Applications" today, "My applications" once M2 lands.
  await menu.getByRole("link", { name: /^(my )?applications$/i }).click();
  await expect(page).toHaveURL(/\/applications$/);
  await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the phone menu works from the keyboard and Escape closes it", { tag: "@phone" }, async ({ page }) => {
  await signIn(page);
  const toggle = page.getByRole("button", { name: "Toggle Sidebar" }).first();
  await toggle.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  // Focus moves into the menu, so keyboard users are not left behind it.
  await expect.poll(() => menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
