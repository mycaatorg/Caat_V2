/** Read-only public page content and navigation checks; no forms are submitted. */
import { test, expect } from "@playwright/test";
import routeCoverage from "./route-coverage.json";

const PUBLIC_PAGES = routeCoverage.routes.filter(
  (entry) => entry.coverage === "public-content",
);
const PUBLIC_NOT_FOUND = routeCoverage.routes.find(
  (entry) => entry.access === "public" && entry.kind === "dynamic" && entry.notFoundExpected,
);
const PUBLIC_DETAIL = routeCoverage.routes.find((entry) => entry.coverage === "public-detail");

for (const { route, expected } of PUBLIC_PAGES) {
  test(`public page ${route} renders its expected heading`, async ({ page }) => {
    expect(expected, `${route} needs an expected heading in route-coverage.json`).toBeTruthy();
    const response = await page.goto(route);
    expect(new URL(page.url()).pathname, `${route} redirected elsewhere`).toBe(route);
    expect(response?.status(), `${route} response`).toBe(200);
    const escaped = expected!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(page.getByRole("heading", { name: new RegExp(escaped, "i") }).first()).toBeVisible();
  });
}

test("public scholarship detail shows the not-found page for a missing slug", async ({ page }) => {
  expect(PUBLIC_NOT_FOUND, "route manifest needs a public detail 404 case").toBeTruthy();
  const route = PUBLIC_NOT_FOUND!.route.replace("[slug]", "codex-ci-missing-scholarship-fixture");
  const response = await page.goto(route);
  expect(new URL(page.url()).pathname).toBe(route);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: PUBLIC_NOT_FOUND!.notFoundExpected })).toBeVisible();
});

test("public scholarship detail renders catalog content", async ({ page }) => {
  expect(PUBLIC_DETAIL, "route manifest needs a public successful detail case").toBeTruthy();
  let detailHref: string | null = null;
  let expectedTitle: string;

  if (process.env.CAAT_ISOLATED_E2E === "1") {
    expectedTitle = PUBLIC_DETAIL!.expected!;
    detailHref = `/scholarship/e2e-test-scholarship`;
  } else {
    await page.goto("/scholarship");
    const detailLink = page.locator("a[href^='/scholarship/']").first();
    await expect(detailLink, "public catalog needs at least one active scholarship").toBeVisible();
    expectedTitle = (await detailLink.locator("h2").innerText()).trim();
    detailHref = await detailLink.getAttribute("href");
  }

  expect(detailHref).toMatch(/^\/scholarship\/[^/]+$/);
  const response = await page.goto(detailHref!);
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(detailHref);
  await expect(page.getByRole("heading", { name: expectedTitle, exact: true, level: 1 })).toBeVisible();
});

test("public account forms render without submitting authentication requests", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  await page.goto("/signup");
  await expect(page.getByLabel(/full name/i)).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel(/confirm password/i)).toBeVisible();
});

test("forgot-password and reset-password show their safe initial states", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();

  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Link expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: /request new link/i })).toBeVisible();
});

test("public scholarship directory links into signup without submitting a form", async ({ page }) => {
  await page.goto("/scholarship");
  await expect(page.getByRole("heading", { name: /find scholarships for your australian university journey/i })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search scholarships" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Study level" })).toBeVisible();
  await page.getByRole("link", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});
