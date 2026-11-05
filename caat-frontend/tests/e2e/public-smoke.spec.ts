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

test("public sitemap contains unique scholarship URLs and matches an explicit release count", async ({ page }, testInfo) => {
  const configuredCount = process.env.CAAT_EXPECTED_SITEMAP_AWARDS;
  let expectedCount: number | undefined;
  if (configuredCount !== undefined) {
    expect(configuredCount, "Expected sitemap count must be a positive integer").toMatch(/^[1-9]\d*$/);
    expectedCount = Number(configuredCount);
    expect(Number.isSafeInteger(expectedCount), "Expected sitemap count must be a safe integer").toBe(true);
  }

  const response = await page.goto("/sitemap.xml");
  expect(response?.status(), "Sitemap must be available").toBe(200);
  expect(response?.headers()["content-type"]).toMatch(/(?:application|text)\/xml\b/);
  const parsed = await page.evaluate(source => {
    const document = new DOMParser().parseFromString(source, "application/xml");
    return {
      malformed: document.getElementsByTagName("parsererror").length > 0,
      root: document.documentElement.localName,
      namespace: document.documentElement.namespaceURI,
      urls: Array.from(document.getElementsByTagNameNS("http://www.sitemaps.org/schemas/sitemap/0.9", "loc"), node => node.textContent?.trim() ?? ""),
    };
  }, await response!.text());
  expect(parsed.malformed, "Sitemap XML must parse successfully").toBe(false);
  expect(parsed.root).toBe("urlset");
  expect(parsed.namespace).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
  const urls = parsed.urls.map(value => new URL(value));
  for (const url of urls) expect(["http:", "https:"]).toContain(url.protocol);
  // Preserve award query IDs: multiple valid records can share a readable slug.
  const awards = urls.filter(url => /^\/scholarship\/[^/]+\/?$/.test(url.pathname)).map(url => url.href);
  expect(awards.length, "A static-only sitemap hides the scholarship catalogue").toBeGreaterThan(0);
  expect(new Set(awards).size, "Scholarship sitemap URLs must be unique").toBe(awards.length);
  // Without this explicit count, this checks structure, not database parity.
  if (expectedCount !== undefined) expect(awards.length).toBe(expectedCount);
  await testInfo.attach("sitemap-coverage", {
    body: Buffer.from(JSON.stringify({ total: urls.length, awards: awards.length, expectedCount: expectedCount ?? null })),
    contentType: "application/json",
  });
});

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
  // Exercise the same directory link in isolated CI and production. A selected
  // award may carry a query string; dropping it would lose record identity.
  await page.goto("/scholarship");
  const detailLink = page.locator("a[href^='/scholarship/']").first();
  await expect(detailLink, "public catalog needs at least one active scholarship").toBeVisible();
  const expectedTitle = (await detailLink.locator("h2").innerText()).trim();
  const detailHref = await detailLink.getAttribute("href");
  expect(detailHref).toBeTruthy();
  const target = new URL(detailHref!, page.url());
  expect(target.pathname).toMatch(/^\/scholarship\/[^/]+$/);
  const response = await page.goto(detailHref!);
  expect(response?.status()).toBe(200);
  const actual = new URL(page.url());
  expect(actual.pathname + actual.search).toBe(target.pathname + target.search);
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
