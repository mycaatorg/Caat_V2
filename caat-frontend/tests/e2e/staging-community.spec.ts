/**
 * Write journey for the disposable local Supabase instance only.
 * The staging Playwright project must opt into this spec explicitly.
 */
import { expect, test, type Page } from "@playwright/test";
import routeCoverage from "./route-coverage.json";

declare global {
  interface Window { __caatClipboardWrites?: string[] }
}

const STUDENT_EMAIL = "e2e.student@caat.local.test";
const GROUP_SLUG = "e2e-test-community";
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const GROUP_URL = `/communities/c/${GROUP_SLUG}`;

function assertLocalUrl(value: string | undefined, label: string): URL {
  if (!value) throw new Error(`${label} must be set for isolated community journeys`);
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

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

test.beforeAll(() => {
  if (process.env.CAAT_ISOLATED_E2E !== "1") {
    throw new Error("Refusing community writes without CAAT_ISOLATED_E2E=1");
  }
  assertLocalUrl(process.env.PLAYWRIGHT_BASE_URL, "PLAYWRIGHT_BASE_URL");
  assertLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.E2E_TEST_PASSWORD) {
    throw new Error("E2E_TEST_PASSWORD is required for the seeded local student");
  }
});

async function signInToLocalStudent(page: Page) {
  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(STUDENT_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });
  await expect(page.getByRole("main")).toBeVisible();
}

async function removeSyntheticPost(page: Page, content: string) {
  await page.goto(GROUP_URL);
  const card = page.locator("div.bg-card").filter({ hasText: content }).first();
  if (!(await card.count())) return;
  await card.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Delete post", exact: true }).click();
  await expect(page.locator("div.bg-card").filter({ hasText: content })).toHaveCount(0, { timeout: 15_000 });
}

test("seeded community post, comment, and save persist across detail reloads", async ({ page }) => {
  await signInToLocalStudent(page);
  await page.addInitScript(() => {
    const writes: string[] = [];
    Object.defineProperty(window, "__caatClipboardWrites", { value: writes, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { writes.push(text); } },
    });
  });
  await page.goto(GROUP_URL);
  const groupRoute = routeCoverage.routes.find((route) => route.route === "/communities/c/[slug]");
  expect(groupRoute?.coverage).toBe("isolated-detail");
  expect(groupRoute?.expected).toBeTruthy();
  await expect(page.getByText(groupRoute!.expected!, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

  const content = `E2E community journey ${RUN_ID}`;
  const comment = `E2E community comment ${RUN_ID}`;

  try {
    const groupMain = page.getByRole("main").last();
    const composer = groupMain.locator("div.cursor-text").filter({ hasText: "Share your experience, results, or advice" });
    await expect(composer).toHaveCount(1);
    await composer.click();
    const editor = groupMain.locator(".ProseMirror").first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await page.keyboard.type(content);
    await page.getByText("Select a topic").click();
    await page.getByRole("option", { name: "Advice", exact: true }).click();
    await page.getByRole("button", { name: "Post", exact: true }).click();

    const groupPost = page.locator("div.bg-card").filter({ hasText: content }).first();
    await expect(groupPost.getByText(content, { exact: true })).toBeVisible({ timeout: 15_000 });

    // Keep the actual Share action; capture only the OS clipboard boundary so
    // browser runners don't hang on clipboard permission prompts.
    await groupPost.getByRole("button", { name: "Share post", exact: true }).click();
    await expect(page.getByText("Link copied.", { exact: true })).toBeVisible({ timeout: 5_000 });
    const copiedUrl = await page.evaluate(() =>
      window.__caatClipboardWrites?.at(-1),
    );
    expect(copiedUrl, "Share action should write a permalink").toBeTruthy();
    const postUrl = new URL(copiedUrl!);
    expect(postUrl.origin).toBe(new URL(process.env.PLAYWRIGHT_BASE_URL!).origin);
    expect(postUrl.pathname).toMatch(/^\/communities\/[0-9a-f-]{36}$/i);

    await page.goto(postUrl.pathname);
    const detailCard = page.locator("div.bg-card").filter({ hasText: content }).first();
    await expect(detailCard.getByText(content, { exact: true })).toBeVisible({ timeout: 15_000 });

    await detailCard.getByRole("button", { name: /Show comments/ }).click();
    const commentBox = detailCard.getByPlaceholder(/Write a comment/);
    await commentBox.fill(comment);
    await commentBox.press("ControlOrMeta+Enter");
    await expect(detailCard.getByText(comment, { exact: true })).toBeVisible({ timeout: 15_000 });

    await detailCard.getByRole("button", { name: "Save post", exact: true }).click();
    await expect(detailCard.getByRole("button", { name: "Unsave post", exact: true })).toHaveAttribute("aria-pressed", "true");
    // The pressed state is optimistic. Wait for the server-action success toast
    // before navigating so reload tests persisted state, not an interrupted write.
    await expect(page.getByText("Post saved", { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.reload();
    const reloadedCard = page.locator("div.bg-card").filter({ hasText: content }).first();
    await expect(reloadedCard.getByText(content, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(reloadedCard.getByRole("button", { name: "Unsave post", exact: true })).toHaveAttribute("aria-pressed", "true");
    await reloadedCard.getByRole("button", { name: /Show comments/ }).click();
    await expect(reloadedCard.getByText(comment, { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goto("/communities/saved");
    await expect(page.getByRole("heading", { name: "Saved Posts", exact: true })).toBeVisible({ timeout: 15_000 });
    const savedCard = page.locator("div.bg-card").filter({ hasText: content }).first();
    await expect(savedCard.getByText(content, { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.reload();
    const reloadedSavedCard = page.locator("div.bg-card").filter({ hasText: content }).first();
    await expect(reloadedSavedCard.getByText(content, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    const profileRoute = routeCoverage.routes.find((route) => route.route === "/communities/profile/[userId]");
    expect(profileRoute?.coverage).toBe("isolated-detail");
    expect(profileRoute?.expected).toBeTruthy();
    const authorLink = reloadedSavedCard.locator('a[href^="/communities/profile/"]').first();
    const displayedAuthorName = await authorLink.locator("p").first().innerText();
    expect(displayedAuthorName).toBeTruthy();
    await authorLink.click();
    await expect(page).toHaveURL(/\/communities\/profile\/[0-9a-f-]{36}$/i, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: displayedAuthorName, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(profileRoute!.expected!, { exact: true })).toBeVisible();
    // Profile feeds intentionally exclude group-scoped posts; verify this post
    // remains in the community/detail surfaces instead of leaking into profile.
    await expect(page.getByText(content, { exact: true })).toHaveCount(0);
  } finally {
    // Preserve the original failure if Playwright already closed the page after
    // a timeout; otherwise require cleanup to succeed.
    if (!page.isClosed()) await removeSyntheticPost(page, content);
  }
});

test("community post draft survives a failed request and retry persists once", async ({ page }) => {
  await signInToLocalStudent(page);
  await page.goto(GROUP_URL);
  const content = `E2E community retry ${RUN_ID}`;
  const main = page.getByRole("main").last();
  await main.locator("div.cursor-text").filter({ hasText: "Share your experience, results, or advice" }).click();
  const editor = main.locator(".ProseMirror").first();
  await expect(editor).toBeVisible();
  await editor.fill(content);
  await page.getByText("Select a topic").click();
  await page.getByRole("option", { name: "Advice", exact: true }).click();

  let failedRequests = 0;
  await page.route("**/communities/**", async (route) => {
    const request = route.request();
    if (failedRequests === 0 && request.method() === "POST" &&
        request.headers()["next-action"] && request.postData()?.includes(content)) {
      failedRequests += 1;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect.poll(() => failedRequests).toBe(1);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /could not|failed|try again/i }).first()).toBeVisible();
    await expect(editor).toHaveText(content);
    await expect(page.getByRole("button", { name: "Post", exact: true })).toBeEnabled();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Post shared." })).toHaveCount(0);

    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByText("Post shared.", { exact: true })).toBeVisible();
    await page.reload();
    const cards = page.locator("div.bg-card").filter({ hasText: content });
    await expect(cards).toHaveCount(1);
    await expect(cards.getByText(content, { exact: true })).toBeVisible();
  } finally {
    await page.unroute("**/communities/**");
    if (!page.isClosed()) await removeSyntheticPost(page, content);
  }
});
