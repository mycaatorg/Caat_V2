/**
 * Full-stack journeys for a disposable local Supabase instance only.
 * This spec is intentionally excluded from the default Playwright project.
 */
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import routeCoverage from "./route-coverage.json";

const STUDENT_EMAIL = "e2e.student@caat.local.test";
const SCHOOL_ID = 900001;
const MAJOR_ID = "e2000000-0000-4000-8000-000000000001";
const SCHOLARSHIP_ID = "e2000000-0000-4000-8000-000000000002";
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function assertLoopbackUrl(value: string | undefined, label: string): URL {
  if (!value) throw new Error(`${label} must be set for isolated staging journeys`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error(`${label} must use http://localhost or http://127.0.0.1`);
  }
  return url;
}

test.beforeAll(() => {
  if (process.env.CAAT_ISOLATED_E2E !== "1") {
    throw new Error("Refusing to run staging journeys without CAAT_ISOLATED_E2E=1");
  }
  assertLoopbackUrl(process.env.PLAYWRIGHT_BASE_URL, "PLAYWRIGHT_BASE_URL");
  assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.E2E_TEST_PASSWORD) {
    throw new Error("E2E_TEST_PASSWORD must be set for the seeded local student account");
  }
});

async function signInToIsolatedStudent(page: Page) {
  // The dedicated project normally starts with an empty browser context. Clear
  // any inherited state as a defense against accidentally reusing a shared DB
  // auth session from another Playwright project.
  await page.context().clearCookies();
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(STUDENT_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/today(?:$|\?)/, { timeout: 20_000 });
  await expect(page.getByRole("main")).toBeVisible();
}

function marker(prefix: string) {
  return `${prefix}-${RUN_ID}`;
}

async function assertIsolatedDetailRoute(page: Page, routePath: string, url: string) {
  const contract = routeCoverage.routes.find((route) => route.route === routePath);
  expect(contract, `route-coverage.json must define ${routePath}`).toBeDefined();
  expect(contract?.coverage, `${routePath} must have successful isolated detail coverage`).toBe("isolated-detail");
  expect(contract?.expected, `${routePath} must define its expected visible content`).toBeTruthy();
  await page.goto(url);
  await expect(page.getByRole("main").getByRole("heading", { name: contract!.expected!, exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
}

test("seeded profile edits persist after reload and satisfy the route-coverage contract", async ({ page }) => {
  await signInToIsolatedStudent(page);
  await page.goto("/profile");

  const profileRoute = routeCoverage.routes.find((route) => route.route === "/profile");
  expect(profileRoute, "route-coverage.json must define /profile").toBeDefined();
  expect(profileRoute?.coverage).toBe("authenticated-content");
  expect(profileRoute?.expected).toBeTruthy();
  const main = page.getByRole("main");
  await expect(main.getByText(profileRoute!.expected!, { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(main.getByText("Profile Progress", { exact: true })).toBeVisible();

  const firstName = marker("E2EProfile");
  const personalCard = page.locator('[data-slot="card"]').filter({ hasText: "Personal Information" });
  await expect(personalCard).toHaveCount(1);
  await personalCard.getByRole("button", { name: "Edit" }).click();
  const fields = personalCard.getByRole("textbox");
  await fields.nth(0).fill(firstName);
  await personalCard.getByRole("button", { name: "Save", exact: true }).click();
  await expect(personalCard.getByText(firstName, { exact: false })).toBeVisible({ timeout: 10_000 });

  await page.reload();
  const reloadedCard = page.locator('[data-slot="card"]').filter({ hasText: "Personal Information" });
  await expect(reloadedCard).toHaveCount(1);
  await expect(reloadedCard.getByText(firstName, { exact: false })).toBeVisible({ timeout: 15_000 });
});

async function removeCustomEssay(page: Page, title: string) {
  const row = page.locator("div.group").filter({ hasText: title }).first();
  if (!(await row.count())) return;
  await row.hover();
  await row.getByRole("button", { name: "Delete", exact: true }).first().click();
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0, { timeout: 10_000 });
}

test("custom essay draft content autosaves and reloads from the real account", { tag: "@phone" }, async ({ page }) => {
  await signInToIsolatedStudent(page);
  const title = marker("E2E essay");
  const content = marker("Persisted essay response");
  // Hold the initial custom-essay list until the new essay is saved, so the
  // stale list response always lands after the create (PROD-93 race).
  const CUSTOM_PROMPTS = "**/rest/v1/custom_essay_prompts**";
  let releaseList!: () => void;
  const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
  let heldLists = 0;
  await page.route(CUSTOM_PROMPTS, async (route) => {
    if (route.request().method() !== "GET" || heldLists > 0) return route.continue();
    heldLists += 1;
    // Read the list now (before the create), deliver it after: a stale response.
    const response = await route.fetch();
    await listGate;
    await route.fulfill({ response });
  });
  await page.goto("/essays");
  await expect(page.getByRole("main").getByText("Essay prompts", { exact: true })).toBeVisible({ timeout: 15_000 });

  try {
    await page.getByRole("button", { name: "Add custom essay" }).click();
    await page.getByPlaceholder("Essay title…").fill(title);
    const created = page.waitForResponse((r) => r.url().includes("/rest/v1/custom_essay_prompts") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm" }).click();
    expect((await created).ok()).toBe(true);
    // Let the stale list response land now; the new essay must survive it.
    const staleList = page.waitForResponse((r) => r.url().includes("/rest/v1/custom_essay_prompts") && r.request().method() === "GET");
    releaseList();
    await staleList;
    await expect(page.getByRole("button", { name: new RegExp(title) }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: /new draft/i }).first().click();
    const editor = page.getByPlaceholder("Start writing your essay here.");
    await expect(editor).toBeVisible({ timeout: 10_000 });
    const persistedDraftUpdate = page.waitForResponse((response) => {
      const request = response.request();
      return request.method() === "PATCH"
        && new URL(response.url()).pathname.endsWith("/rest/v1/essay_drafts")
        && request.postData()?.includes(content) === true
        && response.ok();
    }, { timeout: 15_000 });
    await editor.fill(content);
    await persistedDraftUpdate;

    await page.reload();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await expect(page.getByPlaceholder("Start writing your essay here.")).toHaveValue(content, { timeout: 15_000 });
  } finally {
    releaseList();
    await page.unroute(CUSTOM_PROMPTS).catch(() => {});
    // Reload so cleanup sees the persisted list even if the UI dropped the row.
    await page.reload().catch(() => {});
    await removeCustomEssay(page, title).catch(() => {});
  }
});

/** Opens a resume section. Below the lg breakpoint (1024px) the builder shows
 *  Sections / Edit / Preview tabs, and the section list sits behind Sections. */
async function openResumeSection(page: Page, label: string) {
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    const sectionsTab = page.getByRole("button", { name: "Sections", exact: true });
    await sectionsTab.click();
    await expect(sectionsTab).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: label, exact: true }).filter({ visible: true }).first().click();
}

test("resume section content is saved and restored after reloading the builder", { tag: "@phone" }, async ({ page }) => {
  await signInToIsolatedStudent(page);
  const content = marker("Persisted resume education");
  await page.goto("/resume-builder");
  const resumeBreadcrumb = page.getByRole("main").getByRole("navigation", { name: "breadcrumb" });
  await expect(resumeBreadcrumb.getByText("Resume Builder", { exact: true })).toBeVisible({ timeout: 15_000 });
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });

  await openResumeSection(page, "Education");
  // The builder keeps its hidden desktop panels in the page on a phone.
  const editor = page.locator(".ProseMirror:visible").first();
  await expect(editor).toBeVisible({ timeout: 10_000 });
  const persistedSectionWrite = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST"
      && new URL(response.url()).pathname.endsWith("/rest/v1/resume_sections")
      && request.postData()?.includes(content) === true
      && response.ok();
  }, { timeout: 15_000 });
  await editor.fill(content);
  await saveButton.click();
  await persistedSectionWrite;
  await expect(saveButton).toBeEnabled();
  await expect(page.getByText(/last saved on:/i).first()).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(resumeBreadcrumb.getByText("Resume Builder", { exact: true })).toBeVisible({ timeout: 15_000 });
  await openResumeSection(page, "Education");
  await expect(page.locator(".ProseMirror:visible").first()).toContainText(content, { timeout: 15_000 });
});

/** content_html the builder upserted for one section, from the request body. */
function upsertedSectionHtml(postData: string | null, label: string): string | null {
  try {
    const rows = JSON.parse(postData ?? "[]") as Array<{ label?: string; content_html?: string }>;
    return rows.find((row) => row.label === label)?.content_html ?? null;
  } catch {
    return null;
  }
}

/** Page count from a PDF's page tree: trailer /Root -> catalog /Pages -> /Count. */
function pdfPageCount(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  const ref = (source: string, key: string) => {
    const match = new RegExp(`/${key}\\s+(\\d+)\\s+(\\d+)\\s+R`).exec(source);
    if (!match) throw new Error(`PDF has no /${key} reference`);
    return `${match[1]} ${match[2]}`;
  };
  const object = (id: string) => {
    const match = new RegExp(`(?:^|[^\\d])${id} obj([\\s\\S]*?)endobj`).exec(text);
    if (!match) throw new Error(`PDF object ${id} not found`);
    return match[1];
  };
  const catalog = object(ref(text.slice(text.lastIndexOf("/Root")), "Root"));
  const count = /\/Count\s+(\d+)/.exec(object(ref(catalog, "Pages")))?.[1];
  if (!count) throw new Error("PDF page tree has no /Count");
  return Number(count);
}

async function openResumeBuilder(page: Page) {
  await page.goto("/resume-builder");
  const breadcrumb = page.getByRole("main").getByRole("navigation", { name: "breadcrumb" });
  await expect(breadcrumb.getByText("Resume Builder", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled({ timeout: 15_000 });
}

async function removeResumeSection(page: Page, label: string) {
  await openResumeBuilder(page);
  const row = page.getByRole("button", { name: label, exact: true });
  if (!(await row.count())) return;
  page.once("dialog", (dialog) => dialog.accept());
  const deleted = page.waitForResponse((r) => r.request().method() === "DELETE"
    && new URL(r.url()).pathname.endsWith("/rest/v1/resume_sections") && r.ok(), { timeout: 15_000 });
  await row.locator("xpath=..").getByRole("button", { name: "Delete section" }).click();
  await deleted;
}

test("rich resume formatting survives a reload and is what Print / PDF exports", async ({ page }) => {
  // Two builder reloads, a PDF render and cleanup: allow more than the 30s default.
  test.setTimeout(90_000);
  await signInToIsolatedStudent(page);
  // A run-unique custom section, so the journey never edits seeded content.
  const label = marker("E2E Formatting");
  const [lead, detail, first, second] = ["Lead", "Detail", "First", "Second"].map((name) => marker(name));
  const tag = `lw${RUN_ID.replace(/\W/g, "").slice(-6)}`;
  // Long enough to break across printed pages.
  const longText = Array.from({ length: 400 }, (_, i) => `${tag}${i}`).join(" ");
  await openResumeBuilder(page);

  try {
    await page.getByRole("button", { name: "+ Add Section" }).click();
    await page.getByRole("button", { name: /^Custom\s*Custom Section$/ }).click();
    const renameInput = page.locator("input:focus");
    await expect(renameInput).toHaveValue("Custom Section");
    await renameInput.fill(label);
    await renameInput.press("Enter");
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();

    const editor = page.locator(".ProseMirror").first();
    const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
    const tool = (name: string) => toolbar.getByRole("button", { name, exact: true });
    const pick = async (combobox: string, option: string) => {
      await toolbar.getByRole("combobox", { name: combobox }).click();
      await page.getByRole("option", { name: option, exact: true }).click();
    };
    await editor.click();
    for (const line of [lead, detail, first, second]) {
      await page.keyboard.type(line);
      await page.keyboard.press("Enter");
    }
    await page.keyboard.insertText(longText);

    await editor.locator("p", { hasText: lead }).click({ clickCount: 3 });
    await tool("Bold").click();
    await tool("Align center").click();
    await editor.locator("p", { hasText: detail }).click({ clickCount: 3 });
    await tool("Italic").click();
    await pick("Font size", "18");
    await pick("Line spacing", "1.5");
    await tool("Increase indent").click();
    await editor.locator("p", { hasText: tag }).click({ clickCount: 3 });
    await tool("Bold").click();
    await tool("Justify").click();
    await editor.locator("p", { hasText: first }).click();
    await editor.locator("p", { hasText: second }).click({ modifiers: ["Shift"] });
    await tool("Numbered list").click();

    const persisted = page.waitForResponse((response) => {
      const request = response.request();
      if (request.method() !== "POST" || !new URL(response.url()).pathname.endsWith("/rest/v1/resume_sections")) return false;
      const html = upsertedSectionHtml(request.postData(), label);
      return response.ok() && html !== null && [
        `<strong>${lead}</strong>`, "text-align: center", "<em>", "font-size: 18px", "line-height: 1.5",
        "margin-left: 1.5em", "text-align: justify", longText, "list-style-type: lower-roman", first, second,
      ].every((fragment) => html.includes(fragment));
    }, { timeout: 20_000 });
    await tool("List style").click();
    await page.getByRole("menuitem", { name: /Roman/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await persisted;

    await page.reload();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("button", { name: label, exact: true }).click();
    const reloaded = page.locator(".ProseMirror").first();
    await expect(reloaded.locator('p[style*="text-align: center"] strong')).toHaveText(lead, { timeout: 15_000 });
    const detailParagraph = reloaded.locator('p[style*="line-height: 1.5"][style*="margin-left: 1.5em"]');
    await expect(detailParagraph).toHaveText(detail);
    await expect(detailParagraph.locator("em")).toHaveText(detail);
    await expect(detailParagraph.locator('span[style*="font-size: 18px"]')).toHaveText(detail);
    await expect(reloaded.locator('p[style*="text-align: justify"] strong')).toHaveText(longText);
    await expect(reloaded.locator('ol[style*="list-style-type: lower-roman"] > li')).toHaveText([first, second]);

    // Export: the browser prints only the [data-print-resume] portal. Capture
    // it at the moment Print / PDF hands it to window.print().
    await page.evaluate(() => {
      const w = window as Window & { __printed?: string[] };
      w.__printed = [];
      w.print = () => { w.__printed!.push(document.querySelector("[data-print-resume]")?.innerHTML ?? ""); };
    });
    await page.getByRole("button", { name: "Print / PDF" }).click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __printed?: string[] }).__printed?.length)).toBe(1);
    const printedHtml = await page.evaluate(() => (window as Window & { __printed?: string[] }).__printed![0]);
    for (const text of [label.toUpperCase(), lead, detail, first, second, `${tag}0 `, `${tag}399`]) {
      expect(printedHtml).toContain(text);
    }

    await page.emulateMedia({ media: "print" });
    const printRoot = page.locator("[data-print-resume]");
    await expect(printRoot).toBeVisible();
    await expect(editor).toBeHidden();
    const printedLead = printRoot.locator("p", { hasText: lead });
    await expect(printedLead).toHaveCSS("text-align", "center");
    await expect(printedLead.locator("strong")).toHaveCSS("font-weight", "700");
    const printedDetail = printRoot.locator("p", { hasText: detail });
    // Preview/print body text is 21px: 1.5 line spacing and one indent step.
    await expect(printedDetail).toHaveCSS("line-height", "31.5px");
    await expect(printedDetail).toHaveCSS("margin-left", "31.5px");
    await expect(printedDetail.locator("em")).toHaveCSS("font-style", "italic");
    await expect(printedDetail.locator('span[style*="font-size"]')).toHaveCSS("font-size", "18px");
    const printedItems = printRoot.locator('ol[style*="list-style-type: lower-roman"]').filter({ hasText: RUN_ID });
    await expect(printedItems).toHaveText([first, second]);
    await expect(printedItems.nth(1)).toHaveAttribute("start", "2");
    await expect(printedItems.first()).toHaveCSS("list-style-type", "lower-roman");
    // The long paragraph breaks across pages; every part keeps its formatting.
    const longParts = printRoot.locator("p").filter({ hasText: tag });
    expect(await longParts.count()).toBeGreaterThan(1);
    for (const part of await longParts.all()) {
      await expect(part).toHaveCSS("text-align", "justify");
      await expect(part.locator("strong")).toHaveCount(1);
    }
    expect((await longParts.allTextContents()).join(" ").replace(/\s+/g, " ").trim()).toBe(longText);

    const printPages = await printRoot.locator(".resume-print-page").count();
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // One PDF page per printed resume page: no clipped or overflowing pages.
    expect(pdfPageCount(pdf)).toBe(printPages);
    await page.emulateMedia({ media: "screen" });

    await removeResumeSection(page, label);
    await page.reload();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
  } finally {
    await page.emulateMedia({ media: "screen" }).catch(() => {});
    await removeResumeSection(page, label).catch(() => {});
  }
});

/** On the open major detail page, wait for the loaded bookmark state and leave it unbookmarked. */
async function resetMajorBookmark(page: Page) {
  const loaded = page.getByRole("button", { name: /^(Bookmark major|Remove bookmark)$/ });
  await expect(loaded).toBeEnabled({ timeout: 15_000 });
  const saved = page.getByRole("button", { name: "Remove bookmark" });
  if (await saved.count()) {
    await saved.click();
    await expect(page.getByRole("button", { name: "Bookmark major" })).toBeEnabled({ timeout: 15_000 });
  }
}

test("seeded major detail bookmark persists after reload and appears in the bookmarked list", async ({ page }) => {
  await signInToIsolatedStudent(page);
  const detailPath = `/majors/${MAJOR_ID}`;
  try {
    await assertIsolatedDetailRoute(page, "/majors/[id]", detailPath);
    // Reset first: a reused isolated database may still hold this bookmark from
    // an earlier interrupted run. Wait for the loaded state (the button is named
    // "Loading major bookmark" until the saved state is read) before acting.
    await resetMajorBookmark(page);
    const bookmark = page.getByRole("button", { name: "Bookmark major" });
    await expect(bookmark).toHaveAttribute("aria-pressed", "false");
    await bookmark.click();
    const saved = page.getByRole("button", { name: "Remove bookmark" });
    await expect(saved).toHaveAttribute("aria-pressed", "true");
    // Enabled again only once the write has settled, so the reload cannot cut it off.
    await expect(saved).toBeEnabled({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
    await page.goto("/majors?category=Bookmarked");
    await expect(page.getByRole("link", { name: /E2E Test Engineering/ }).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await page.goto(detailPath).catch(() => {});
    await resetMajorBookmark(page).catch(() => {});
  }
});

async function removeDocument(page: Page, fileName: string) {
  const name = page.getByText(fileName, { exact: true });
  if (!(await name.count())) return;
  const row = name.locator("xpath=../../..");
  await row.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(fileName, { exact: true })).toHaveCount(0, { timeout: 10_000 });
}

test("valid document upload persists file metadata after reload", async ({ page }) => {
  await signInToIsolatedStudent(page);
  const fileName = `${marker("transcript")}.pdf`;
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Document Vault" })).toBeVisible({ timeout: 15_000 });

  try {
    await page.getByRole("button", { name: "Upload New" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"),
    });
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText(fileName, { exact: true })).toBeVisible({ timeout: 20_000 });
    // Scope to this file's row: a reused isolated database may hold other documents.
    const uploadedRow = () => page.getByText(fileName, { exact: true }).locator("xpath=../../..");
    await expect(uploadedRow().getByText("In Review", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText(fileName, { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(uploadedRow().getByText("Transcripts", { exact: true })).toBeVisible();
  } finally {
    await removeDocument(page, fileName).catch(() => {});
  }
});

async function untrackSeedScholarship(page: Page) {
  const trackedButton = page.getByRole("button", { name: /^(Interested|Applied|Awarded|Not selected)$/ }).first();
  if (!(await trackedButton.count())) return;
  await trackedButton.click();
  await page.getByRole("menuitem", { name: "Remove from saved" }).click();
}

test("scholarship status persists on detail and tracked-list views after reload", async ({ page }) => {
  await signInToIsolatedStudent(page);
  await assertIsolatedDetailRoute(page, "/scholarships/[id]", `/scholarships/${SCHOLARSHIP_ID}`);
  await expect(page.getByRole("heading", { name: "E2E Test Scholarship" })).toBeVisible();
  // Next.js may retain a hidden previous page; assert against the accessible region.
  const eligibility = page.getByRole('region', { name: 'Check your eligibility', exact: true });
  await expect(eligibility).toHaveCount(1);
  await expect(eligibility.getByRole('heading', { name: 'Check your eligibility', level: 2 })).toBeVisible();
  await expect(eligibility.getByText('No valid verification date is available. Eligibility remains unconfirmed.')).toBeVisible();
  await expect(eligibility.getByText('Needs checking', { exact: true }).first()).toBeVisible();
  await expect(eligibility.getByText('Matches your profile', { exact: true })).toHaveCount(0);

  try {
    const statusButton = page.getByRole("button", { name: /^(Save|Interested|Applied|Awarded|Not selected)$/ });
    await expect(statusButton).toBeVisible({ timeout: 15_000 });
    if ((await statusButton.innerText()).trim() !== "Applied") {
      await statusButton.click();
      await page.getByRole("menuitem", { name: "Applied", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Applied" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Applied" })).toBeVisible({ timeout: 15_000 });

    await page.goto("/scholarships?status=applied");
    await expect(page.getByLabel("breadcrumb").getByRole("link", { name: "Scholarships", exact: true })).toBeVisible({ timeout: 15_000 });
    const trackedScholarshipCard = page.locator('[data-slot="card"]:visible').filter({
      has: page.getByRole("heading", { name: "E2E Test Scholarship", exact: true }),
    });
    await expect(trackedScholarshipCard).toHaveCount(1, { timeout: 15_000 });
    await expect(trackedScholarshipCard.getByText("Applied", { exact: true })).toBeVisible();
  } finally {
    if (!page.isClosed()) {
      try {
        await page.goto(`/scholarships/${SCHOLARSHIP_ID}`);
        await untrackSeedScholarship(page);
      } catch {
        // The assertions above are the primary failure; cleanup must not mask
        // them if the browser context has already been torn down.
      }
    }
  }
});

async function chooseScholarshipStatus(page: Page, label: string) {
  const statusButton = page.getByRole("button", { name: /^(Save|Interested|Applied|Awarded|Not selected)$/ });
  await expect(statusButton).toBeVisible({ timeout: 15_000 });
  const saved = page.waitForResponse(
    (r) => r.url().includes("/rest/v1/user_bookmarked_scholarships") && r.request().method() === "POST",
  );
  await statusButton.click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await saved;
}

async function expectTrackedScholarshipStatus(page: Page, label: string) {
  // The scholarships list, filtered to the status, shows the seeded card with its label.
  await page.goto(`/scholarships?status=${label.toLowerCase()}`);
  const card = page.locator('[data-slot="card"]:visible').filter({
    has: page.getByRole("heading", { name: "E2E Test Scholarship", exact: true }),
  });
  await expect(card).toHaveCount(1, { timeout: 15_000 });
  await expect(card.getByText(label, { exact: true })).toBeVisible();
  // The shortlist's scholarship row carries the same status pill.
  await page.goto(`/shortlist?tab=scholarship&status=${label.toLowerCase()}`);
  const row = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "E2E Test Scholarship", exact: true }) });
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  await expect(row.getByText(label, { exact: true })).toBeVisible();
  await page.reload();
  await expect(row).toHaveCount(1, { timeout: 15_000 });
  await expect(row.getByText(label, { exact: true })).toBeVisible();
}

// PROD-150: changing an already-saved scholarship's status is an UPDATE of the
// existing row, which needs its own owner policy. Saving a new scholarship is an
// INSERT, so the journey above (straight to Applied) never exercised it.
test("an already-saved scholarship moves from Interested to Applied and stays Applied after reloads (PROD-150)", async ({ page }) => {
  await signInToIsolatedStudent(page);
  const detailPath = `/scholarships/${SCHOLARSHIP_ID}`;
  try {
    await page.goto(detailPath);
    await expect(page.getByRole("heading", { name: "E2E Test Scholarship" })).toBeVisible({ timeout: 15_000 });
    // A reused isolated database may still hold this save from an interrupted run.
    await expect(page.getByRole("button", { name: /^(Save|Interested|Applied|Awarded|Not selected)$/ })).toBeVisible({ timeout: 15_000 });
    await untrackSeedScholarship(page);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible({ timeout: 15_000 });

    await chooseScholarshipStatus(page, "Interested");
    await page.reload();
    await expect(page.getByRole("button", { name: "Interested", exact: true })).toBeVisible({ timeout: 15_000 });
    await expectTrackedScholarshipStatus(page, "Interested");

    await page.goto(detailPath);
    await chooseScholarshipStatus(page, "Applied");
    await expect(page.getByRole("button", { name: "Applied", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Applied", exact: true })).toBeVisible({ timeout: 15_000 });
    await expectTrackedScholarshipStatus(page, "Applied");
  } finally {
    if (!page.isClosed()) {
      try {
        await page.goto(detailPath);
        await untrackSeedScholarship(page);
      } catch {
        // Cleanup must not mask the assertion that failed above.
      }
    }
  }
});

test("school notes and application status/checklist persist across list and detail reloads", { tag: "@phone" }, async ({ page }) => {
  await signInToIsolatedStudent(page);
  const schoolNote = marker("School note");
  const applicationNote = marker("Application note");
  try {
    await assertIsolatedDetailRoute(page, "/schools/[id]", `/schools/${SCHOOL_ID}`);
    await expect(page.getByRole("heading", { name: "E2E Test University", exact: true })).toBeVisible();

    const schoolNotes = page.locator('textarea[placeholder*="Jot down anything you want to remember about this school"]:visible');
    await expect(schoolNotes).toHaveCount(1);
    await schoolNotes.fill(schoolNote);
    await expect(page.getByText(/last saved/i).last()).toBeVisible({ timeout: 10_000 });
    await page.reload();
    const reloadedSchoolNotes = page.locator('textarea[placeholder*="Jot down anything you want to remember about this school"]:visible');
    await expect(reloadedSchoolNotes).toHaveCount(1);
    await expect(reloadedSchoolNotes).toHaveValue(schoolNote, { timeout: 15_000 });

    await page.getByRole("button", { name: "Track Application" }).click();
    await expect(page.getByRole("link", { name: "Researching" })).toBeVisible({ timeout: 15_000 });
    await page.goto("/applications");
    await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible({ timeout: 15_000 });
    const schoolLink = page.getByRole("link", { name: /E2E Test University/ }).first();
    await expect(schoolLink).toBeVisible({ timeout: 15_000 });
    const appCard = page.locator("div.rounded-lg.border.p-4").filter({ has: schoolLink }).first();
    const status = appCard.getByRole("combobox").first();
    await status.click();
    await page.getByRole("option", { name: "Applying", exact: true }).click();
    await expect(status).toContainText("Applying", { timeout: 10_000 });

    await appCard.getByRole("button", { name: "Notes", exact: true }).click();
    await appCard.getByPlaceholder("Add notes about this application…").fill(applicationNote);
    await expect(appCard.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.reload();
    const reloadedCard = page.locator("div.rounded-lg.border.p-4").filter({ has: page.getByRole("link", { name: /E2E Test University/ }).first() }).first();
    await expect(reloadedCard.getByRole("combobox")).toContainText("Applying");
    await reloadedCard.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(reloadedCard.getByPlaceholder("Add notes about this application…")).toHaveValue(applicationNote);
    // The list shows the hub's preparation checklist score, out of 3 steps.
    await expect(reloadedCard.locator("[data-prep-score]")).toHaveText(/^Preparation checklist: [0-3] of 3 steps$/);

    const applicationHref = await reloadedCard.getByRole("link", { name: /open/i }).getAttribute("href");
    expect(applicationHref).toMatch(/^\/applications\/[0-9a-f-]+$/i);
    await assertIsolatedDetailRoute(page, "/applications/[id]", applicationHref!);
    await expect(page.getByRole("heading", { name: "E2E Test University", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Status", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Applying/ })).toBeVisible();
    await expect(page.getByText("Preparation checklist", { exact: true })).toBeVisible();
    await expect(page.getByText("Deadline is set", { exact: true })).toBeVisible();
    await expect(page.getByText("An essay drafted for this school or shared", { exact: true })).toBeVisible();
    await expect(page.getByText("A document attached here or a shared key document", { exact: true })).toBeVisible();
    // The checklist is preparation only; the status is not one of its steps.
    await expect(page.locator("li[data-state]")).toHaveCount(3);
    await expect(page.getByText("Status reached Submitted", { exact: false })).toHaveCount(0);
    // The seeded open scholarship linked to this university (scholarship_schools) is listed and links to its page.
    const seededScholarship = page.locator("[data-hub-scholarship]").filter({ hasText: "E2E Test Scholarship" });
    await expect(seededScholarship).toBeVisible({ timeout: 15_000 });
    await expect(seededScholarship.getByRole("link")).toHaveAttribute("href", "/scholarships/e2000000-0000-4000-8000-000000000002");
    await expect(seededScholarship).toContainText("No closing date listed");
  } finally {
    await page.goto("/applications").catch(() => {});
    const schoolLink = page.getByRole("link", { name: /E2E Test University/ }).first();
    await schoolLink.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
    if (await schoolLink.count()) {
      const card = page.locator("div.rounded-lg.border.p-4").filter({ has: schoolLink }).first();
      await card.getByRole("button", { name: "Remove application" }).click().catch(() => {});
      await card.getByRole("button", { name: "Confirm", exact: true }).click().catch(() => {});
    }
    await page.goto(`/schools/${SCHOOL_ID}`).catch(() => {});
    const notesField = page.locator('textarea[placeholder*="Jot down anything you want to remember about this school"]:visible');
    if (await notesField.count()) {
      await notesField.fill("").catch(() => {});
      await page.waitForTimeout(2_000).catch(() => {});
    }
  }
});

const APPLICATION_WRITES = "**/rest/v1/user_school_applications**";

function seededApplicationCard(page: Page) {
  const schoolLink = page.getByRole("link", { name: /E2E Test University/ }).first();
  return { schoolLink, card: page.locator("div.rounded-lg.border.p-4").filter({ has: schoolLink }).first() };
}

async function removeSeededApplication(page: Page) {
  await page.goto("/applications");
  // The heading renders only after the list has loaded (a skeleton shows
  // until then), so the card count below is final rather than a race.
  await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Couldn't load your applications.")).toHaveCount(0);
  const { schoolLink, card } = seededApplicationCard(page);
  if (!(await schoolLink.count())) return;
  await card.getByRole("button", { name: "Remove application" }).click();
  await card.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("Application removed.", { exact: true })).toBeVisible({ timeout: 10_000 });
}

/** Abort exactly one matching write to the applications table, at the network
 *  boundary, so the app sees a real failed request. */
async function failNextApplicationWrite(page: Page, bodyFragment: string) {
  const state = { failed: 0 };
  await page.route(APPLICATION_WRITES, async (route) => {
    const request = route.request();
    if (state.failed === 0 && request.method() === "PATCH" && request.postData()?.includes(bodyFragment)) {
      state.failed += 1;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  return state;
}

test("application checklist edits recover from failed writes and persist after reload", { tag: "@phone" }, async ({ page }) => {
  test.setTimeout(90_000);
  await signInToIsolatedStudent(page);
  const note = marker("Recovered application note");
  let removed = false;
  try {
    // Start from a clean slate even if an earlier run left the seed tracked.
    await removeSeededApplication(page);
    await page.goto(`/schools/${SCHOOL_ID}`);
    await page.getByRole("button", { name: "Track Application" }).click();
    await expect(page.getByRole("link", { name: "Researching" })).toBeVisible({ timeout: 15_000 });

    await page.goto("/applications");
    const href = await seededApplicationCard(page).card.getByRole("link", { name: /open/i }).getAttribute("href");
    expect(href).toMatch(/^\/applications\/[0-9a-f-]+$/i);
    await page.goto(href!);
    await expect(page.getByRole("heading", { name: "E2E Test University", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });

    const checklist = (label: string) => page.locator("li[data-state]").filter({ hasText: label });
    const statusButton = page.getByRole("button", { name: /^(Researching|Submitted)$/ });
    // The student's own Submitted status shows in the status card, not as a checklist step.
    const submittedNote = page.getByText("Nice work. Now you wait.", { exact: true });
    await expect(checklist("Deadline is set")).toHaveAttribute("data-state", "todo");
    await expect(submittedNote).toHaveCount(0);

    // The checklist follows a saved deadline without a reload.
    const deadlineSaved = page.waitForResponse((r) => r.url().includes("/rest/v1/user_school_applications") && r.request().method() === "PATCH" && r.ok());
    await page.locator("#hub-deadline").fill("2027-03-15");
    await deadlineSaved;
    await expect(checklist("Deadline is set")).toHaveAttribute("data-state", "done");

    // A failed status write reverts the status, then a retry saves.
    let failure = await failNextApplicationWrite(page, '"status":"submitted"');
    await statusButton.click();
    await page.getByRole("menuitem", { name: "Submitted", exact: true }).click();
    await expect.poll(() => failure.failed).toBe(1);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /went wrong|try again/i }).first()).toBeVisible();
    await expect(statusButton).toHaveText("Researching");
    await expect(statusButton).toBeEnabled();
    await expect(submittedNote).toHaveCount(0);

    const statusSaved = page.waitForResponse((r) => r.url().includes("/rest/v1/user_school_applications") && r.request().method() === "PATCH" && r.ok());
    await statusButton.click();
    await page.getByRole("menuitem", { name: "Submitted", exact: true }).click();
    await statusSaved;
    await expect(submittedNote).toBeVisible();
    await page.unroute(APPLICATION_WRITES);

    await page.reload();
    await expect(statusButton).toHaveText("Submitted", { timeout: 15_000 });
    await expect(page.locator("#hub-deadline")).toHaveValue("2027-03-15");
    await expect(checklist("Deadline is set")).toHaveAttribute("data-state", "done");
    await expect(submittedNote).toBeVisible();

    // A failed notes save keeps the text and says so; Save retries it.
    await page.goto("/applications");
    let { card } = seededApplicationCard(page);
    await expect(card).toBeVisible({ timeout: 15_000 });
    failure = await failNextApplicationWrite(page, note);
    await card.getByRole("button", { name: "Notes", exact: true }).click();
    const notes = card.getByPlaceholder("Add notes about this application…");
    await notes.fill(note);
    await expect.poll(() => failure.failed).toBe(1);
    await expect(card.getByText("Not saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(notes).toHaveValue(note);
    await card.getByRole("button", { name: "Save", exact: true }).click();
    await expect(card.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.unroute(APPLICATION_WRITES);

    await page.reload();
    ({ card } = seededApplicationCard(page));
    await expect(card.getByRole("combobox")).toContainText("Submitted", { timeout: 15_000 });
    await expect(card.getByLabel("Application deadline for E2E Test University")).toHaveValue("2027-03-15");
    await card.getByRole("button", { name: "Notes", exact: true }).click();
    await expect(card.getByPlaceholder("Add notes about this application…")).toHaveValue(note);

    // Removal is persisted, not just hidden.
    await removeSeededApplication(page);
    removed = true;
    await page.reload();
    await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /E2E Test University/ })).toHaveCount(0);
  } finally {
    if (!page.isClosed()) {
      await page.unroute(APPLICATION_WRITES).catch(() => {});
      if (!removed) await removeSeededApplication(page).catch(() => {});
    }
  }
});

test("document upload and delete recover from failed requests, and deletion removes the stored file", async ({ page }) => {
  test.setTimeout(90_000);
  await signInToIsolatedStudent(page);
  const fileName = `${marker("recovery-transcript")}.pdf`;
  const pdfBody = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n";
  const STORAGE_UPLOADS = "**/storage/v1/object/user-documents/**";
  const DOCUMENT_ROWS = "**/rest/v1/documents**";
  let deleted = false;
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Document Vault" })).toBeVisible({ timeout: 15_000 });

  try {
    // The first storage upload fails at the network boundary: no row, sheet and file kept.
    let failedUploads = 0;
    await page.route(STORAGE_UPLOADS, async (route) => {
      if (failedUploads === 0 && route.request().method() === "POST") {
        failedUploads += 1;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "Upload New" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({ name: fileName, mimeType: "application/pdf", buffer: Buffer.from(pdfBody) });
    const upload = page.getByRole("button", { name: "Upload", exact: true });
    await upload.click();
    await expect.poll(() => failedUploads).toBe(1);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /went wrong|try again|failed/i }).first()).toBeVisible();
    await expect(upload).toBeEnabled();
    await expect(page.getByRole("dialog").getByText(fileName, { exact: true })).toBeVisible();
    await expect(page.getByText("Document uploaded successfully", { exact: true })).toHaveCount(0);

    await upload.click();
    await expect(page.getByText("Document uploaded successfully", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.unroute(STORAGE_UPLOADS);
    await page.reload();
    const listed = page.getByText(fileName, { exact: true });
    await expect(listed).toHaveCount(1, { timeout: 20_000 });

    // The stored file is reachable through the owner's signed link.
    const row = listed.locator("xpath=../../..");
    // Headless Chromium downloads a PDF instead of displaying it, so the popup
    // never commits a URL; read the link from the app's own signing response.
    const popupPromise = page.waitForEvent("popup");
    const signing = page.waitForResponse(
      (r) => r.url().includes("/storage/v1/object/sign/user-documents/") && r.request().method() === "POST",
    );
    await row.getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "View", exact: true }).click();
    const signed = await signing;
    expect(signed.ok()).toBe(true);
    const { signedURL } = (await signed.json()) as { signedURL: string };
    // Resolve against the storage origin the browser actually signed with.
    const signedUrl = `${signed.url().split("/object/sign/")[0]}${signedURL}`;
    const popup = await popupPromise;
    await popup.close();
    const stored = await page.request.get(signedUrl);
    expect(stored.status()).toBe(200);
    expect(await stored.text()).toBe(pdfBody);

    // Delete attempt 1 never reaches the database: document and file survive.
    // Attempt 2 commits but its response is lost; attempt 3 must still remove
    // the file even though the row is already gone.
    let failedDeletes = 0;
    await page.route(DOCUMENT_ROWS, async (route) => {
      if (route.request().method() === "DELETE" && failedDeletes < 2) {
        failedDeletes += 1;
        if (failedDeletes === 2) await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await row.getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => failedDeletes).toBe(1);
    await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
    await expect(page.getByText("Document deleted", { exact: true })).toHaveCount(0);
    expect((await page.request.get(signedUrl)).status()).toBe(200);

    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => failedDeletes).toBe(2);
    await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
    await expect(page.getByText("Document deleted", { exact: true })).toHaveCount(0);

    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Document deleted", { exact: true })).toBeVisible({ timeout: 10_000 });
    deleted = true;
    await page.unroute(DOCUMENT_ROWS);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Document Vault" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(fileName, { exact: true })).toHaveCount(0);
    // The object itself is gone, not just hidden from the list.
    await expect.poll(async () => (await page.request.get(signedUrl)).status()).not.toBe(200);
  } finally {
    if (!page.isClosed()) {
      await page.unroute(STORAGE_UPLOADS).catch(() => {});
      await page.unroute(DOCUMENT_ROWS).catch(() => {});
      if (!deleted) {
        await page.goto("/documents").catch(() => {});
        await removeDocument(page, fileName).catch(() => {});
      }
    }
  }
});

test("Today turns a missing application deadline into a task that clears once fixed", async ({ page }) => {
  test.setTimeout(90_000);
  await signInToIsolatedStudent(page);
  try {
    await removeSeededApplication(page);
    await page.goto(`/schools/${SCHOOL_ID}`);
    await page.getByRole("button", { name: "Track Application" }).click();
    await expect(page.getByRole("link", { name: "Researching" })).toBeVisible({ timeout: 15_000 });

    await page.goto("/today");
    const task = page.getByRole("region", { name: "Needs attention" }).getByRole("link", { name: /Add the deadline for E2E Test University/ });
    await expect(task).toBeVisible({ timeout: 15_000 });
    await task.click();
    await page.waitForURL(/\/applications\/[0-9a-f-]+$/i);
    const hubPath = new URL(page.url()).pathname;
    const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/user_school_applications") && r.request().method() === "PATCH" && r.ok());
    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await page.locator("#hub-deadline").fill(soon);
    await saved;

    await page.goto("/today");
    const comingUp = page.getByRole("region", { name: "Coming up" }).getByRole("link", { name: /E2E Test University/ });
    await expect(comingUp).toBeVisible({ timeout: 15_000 });
    // The deadline opens this application's hub, not the applications list.
    await expect(comingUp).toHaveAttribute("href", hubPath);
    await expect(page.getByRole("region", { name: "Needs attention" }).getByText(/Add the deadline for E2E Test University/)).toHaveCount(0);
  } finally {
    if (!page.isClosed()) await removeSeededApplication(page).catch(() => {});
  }
});

function customScholarshipCard(page: Page, title: string) {
  return page
    .getByRole("main")
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: title, exact: true, level: 3 }) });
}

async function removeCustomScholarship(page: Page, title: string) {
  await page.goto("/scholarships?view=mine");
  await expect(page.getByRole("main").getByRole("heading", { name: "My Scholarships", level: 2 })).toBeVisible({ timeout: 15_000 });
  const card = customScholarshipCard(page, title);
  // Let the owner's list load before deciding there is nothing to remove.
  await card.first().waitFor({ timeout: 10_000 }).catch(() => {});
  if (!(await card.count())) return;
  await card.getByRole("button", { name: "Delete scholarship" }).click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card).toHaveCount(0, { timeout: 10_000 });
}

/** Backstop cleanup that does not need the page: sign in as the seeded student
 *  through local Auth with the anon key and delete their own rows by the run's
 *  unique title. RLS keeps it owner-scoped; no service-role key is used. */
async function deleteCustomScholarshipByTitle(request: APIRequestContext, title: string) {
  const api = assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").origin;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for isolated cleanup");
  const auth = await request.post(`${api}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey },
    data: { email: STUDENT_EMAIL, password: process.env.E2E_TEST_PASSWORD },
  });
  expect(auth.ok(), "local student sign-in for cleanup").toBe(true);
  const { access_token: token } = (await auth.json()) as { access_token: string };
  const removed = await request.delete(`${api}/rest/v1/user_scholarships?title=eq.${encodeURIComponent(title)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  expect(removed.ok(), "custom scholarship cleanup").toBe(true);
}

test("a custom scholarship deadline becomes a Today task and Custom deadline that survive a reload (PROD-146)", async ({ page, request }) => {
  test.setTimeout(90_000);
  await signInToIsolatedStudent(page);
  const title = marker("E2E custom scholarship");
  // Three days out keeps it inside the 14-day window in any student time zone.
  const deadline = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  try {
    await page.goto("/scholarships?view=mine");
    await expect(page.getByRole("main").getByRole("heading", { name: "My Scholarships", level: 2 })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("main").getByRole("button", { name: "Add Scholarship", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Add Scholarship" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/Scholarship Name/).fill(title);
    await dialog.getByLabel(/University \/ Provider/).fill("E2E Test Rotary Club");
    await dialog.getByLabel("Application Deadline", { exact: true }).fill(deadline);
    const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/user_scholarships") && r.request().method() === "POST" && r.ok());
    await dialog.getByRole("button", { name: "Add Scholarship", exact: true }).click();
    await saved;
    await expect(dialog).toHaveCount(0);
    await expect(customScholarshipCard(page, title)).toHaveCount(1);

    await page.goto("/today");
    for (let pass = 0; pass < 2; pass += 1) {
      const task = page.getByRole("region", { name: "Needs attention" }).getByRole("link", { name: new RegExp(`${title} closes in \\d+ days`) });
      await expect(task).toBeVisible({ timeout: 15_000 });
      await expect(task).toHaveAttribute("href", "/scholarships?view=mine");
      const upcoming = page.getByRole("region", { name: "Coming up" }).getByRole("link", { name: new RegExp(title) });
      await expect(upcoming).toBeVisible();
      await expect(upcoming).toContainText("Custom");
      await expect(upcoming).toContainText("Your own scholarship");
      if (pass === 0) await page.reload();
    }
  } finally {
    if (!page.isClosed()) await removeCustomScholarship(page, title).catch(() => {});
    // Always runs, even after a timeout closed the page.
    await deleteCustomScholarshipByTitle(request, title);
  }
});

test('three-major comparison shows seeded careers, coursework and honest missing values', { tag: '@phone' }, async ({ page }) => {
  await signInToIsolatedStudent(page);
  await page.goto('/majors');
  for (const name of ['E2E Test Engineering', 'E2E Test Computing', 'E2E Test Economics']) {
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole('link', { name, exact: true }) });
    await card.getByRole('button', { name: 'Compare', exact: true }).click();
  }
  await expect(page.getByText('3 majors selected')).toBeVisible();
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  const comparison = page.getByRole('dialog', { name: 'Compare Majors' });
  await expect(comparison.getByText('Test engineer', { exact: true })).toBeVisible();
  await expect(comparison.getByText('Testing 101', { exact: true })).toBeVisible();
  await expect(comparison.getByText('Test developer', { exact: true })).toBeAttached();
  await expect(comparison.getByText('Algorithms 101', { exact: true })).toBeAttached();
  await expect(comparison.getByText('Career information not available')).toBeAttached();
  await expect(comparison.getByText('Coursework information not available')).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(comparison).toHaveCount(0);
});

// PROD-76: specific university course offerings. Seeded by
// supabase/migrations/20261023070000_course_offerings.sql (a public catalogue,
// so these ids and facts are the same in every isolated stack).
const COURSES = {
  unswCs: { id: "unsw-3778-kensington", name: "Bachelor of Science (Computer Science)", institution: "UNSW Sydney" },
  unswScienceCs: { id: "unsw-3789-kensington", name: "Bachelor of Science / Science (Computer Science)", institution: "UNSW Sydney" },
  anu: { id: "anu-aacom", name: "Bachelor of Advanced Computing (Honours)", institution: "Australian National University" },
  sydney: { id: "sydney-bpadvcmp1000-camperdown", name: "Bachelor of Advanced Computing", institution: "University of Sydney" },
} as const;
type SeededCourse = { id: string; name: string; institution: string };
const COURSE_SAVES = "/rest/v1/user_course_bookmarks";

async function openCourses(page: Page, path = "/courses") {
  await page.goto(path);
  await expect(page.getByRole("main").getByRole("heading", { name: "Find the degree behind your interests", level: 1 })).toBeVisible({ timeout: 15_000 });
}

/** The visible card for one offering; Next.js may retain a hidden previous page. */
function courseCard(page: Page, course: SeededCourse) {
  return page.getByRole("main").getByRole("article", { name: `${course.name} at ${course.institution}`, exact: true });
}

function courseSaveWrite(page: Page, method: "POST" | "DELETE") {
  return page.waitForResponse((r) => r.request().method() === method
    && new URL(r.url()).pathname.endsWith(COURSE_SAVES) && r.ok(), { timeout: 15_000 });
}

/** Persisted removal of one saved course, if a previous run left it saved. */
async function unsaveCourse(page: Page, course: SeededCourse) {
  await openCourses(page, `/courses?course=${course.id}`);
  const saveButton = courseCard(page, course).getByRole("button", { name: new RegExp(`^(Save ${escapeRegExp(course.name)}|Remove ${escapeRegExp(course.name)} from saved courses)$`) });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });
  if ((await saveButton.getAttribute("aria-label")) !== `Remove ${course.name} from saved courses`) return;
  const removed = courseSaveWrite(page, "DELETE");
  await saveButton.click();
  await removed;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bookmark (or un-bookmark) the seeded major and wait for the write to persist. */
async function setSeedMajorBookmark(page: Page, bookmarked: boolean) {
  // The button renders "not bookmarked" until its own read returns, so wait
  // for that read and its rendered state before deciding whether to toggle.
  const initialRead = page.waitForResponse((r) => r.request().method() === "GET"
    && new URL(r.url()).pathname.endsWith("/rest/v1/user_bookmarked_majors"), { timeout: 15_000 });
  await assertIsolatedDetailRoute(page, "/majors/[id]", `/majors/${MAJOR_ID}`);
  const read = await initialRead;
  const current = read.ok() && (await read.text()).includes(MAJOR_ID);
  const toggle = page.getByRole("button", { name: /^(Bookmark major|Remove bookmark)$/ });
  await expect(toggle).toHaveAttribute("aria-pressed", String(current));
  if (current === bookmarked) return;
  const written = page.waitForResponse((r) => r.request().method() !== "GET"
    && new URL(r.url()).pathname.endsWith("/rest/v1/user_bookmarked_majors") && r.ok(), { timeout: 15_000 });
  await toggle.click();
  await written;
  await expect(toggle).toHaveAttribute("aria-pressed", String(bookmarked));
}

test("a saved university course persists through reload, Shortlist and Today, and removal persists", { tag: "@phone" }, async ({ page }) => {
  await signInToIsolatedStudent(page);
  const course = COURSES.unswCs;
  const removeLabel = `Remove ${course.name} from saved courses`;
  let majorBookmarked = false;
  try {
    // Start clean, then hold one legacy save so Shortlist must keep both kinds.
    await unsaveCourse(page, course);
    await setSeedMajorBookmark(page, true);
    majorBookmarked = true;

    await openCourses(page);
    const card = courseCard(page, course);
    await expect(card).toHaveCount(1);
    // Same UAC code, different degree: saving one must not save the other.
    const sibling = courseCard(page, COURSES.unswScienceCs);
    await expect(sibling.getByRole("button", { name: `Save ${COURSES.unswScienceCs.name}`, exact: true })).toBeEnabled({ timeout: 15_000 });
    const save = card.getByRole("button", { name: `Save ${course.name}`, exact: true });
    await expect(save).toBeEnabled({ timeout: 15_000 });
    const saved = courseSaveWrite(page, "POST");
    await save.click();
    await saved;
    await expect(card.getByRole("button", { name: removeLabel, exact: true })).toHaveText("Saved");

    await page.reload();
    await expect(courseCard(page, course).getByRole("button", { name: removeLabel, exact: true })).toBeEnabled({ timeout: 15_000 });
    await expect(courseCard(page, COURSES.unswScienceCs).getByRole("button", { name: `Save ${COURSES.unswScienceCs.name}`, exact: true })).toBeVisible();
    const savedOnly = page.getByRole("main").getByRole("button", { name: "Saved courses", exact: true });
    await savedOnly.click();
    await expect(savedOnly).toHaveAttribute("aria-pressed", "true");
    await expect(courseCard(page, course)).toBeVisible();
    await expect(courseCard(page, COURSES.unswScienceCs)).toHaveCount(0);

    await page.goto("/shortlist");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: /Everything you have saved/, level: 1 })).toBeVisible({ timeout: 15_000 });
    const courseSection = main.getByRole("region", { name: "University courses", exact: true });
    await expect(courseSection.getByRole("link", { name: course.name, exact: true })).toHaveAttribute("href", `/courses?course=${course.id}`);
    await expect(courseSection.getByText(`${course.institution} · Kensington`, { exact: true })).toBeVisible();
    await expect(courseSection.getByRole("link", { name: COURSES.unswScienceCs.name, exact: true })).toHaveCount(0);
    // Legacy kinds keep their own sections; a course is not a major.
    const majorSection = main.getByRole("region", { name: "Majors", exact: true });
    await expect(majorSection.getByRole("link", { name: "E2E Test Engineering", exact: true })).toBeVisible();
    await expect(majorSection.getByRole("link", { name: course.name, exact: true })).toHaveCount(0);
    await expect(main.getByRole("region", { name: "Universities", exact: true })).toBeVisible();
    await expect(main.getByRole("region", { name: "Scholarships", exact: true })).toBeVisible();

    await page.goto("/today");
    const todayShortlist = page.getByRole("main").getByRole("region", { name: "My shortlist", exact: true });
    const todayCourse = todayShortlist.getByRole("link", { name: `${course.name} — ${course.institution}`, exact: true });
    await expect(todayCourse).toBeVisible({ timeout: 15_000 });
    await expect(todayShortlist.getByRole("link", { name: "E2E Test Engineering", exact: true })).toBeVisible();
    // The Today link returns to that specific saved offering.
    await todayCourse.click();
    await page.waitForURL((url) => url.pathname === "/courses" && url.searchParams.get("course") === course.id);
    await expect(courseCard(page, course).getByRole("button", { name: removeLabel, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("main").getByRole("article")).toHaveCount(1);

    await page.goto("/shortlist");
    const removeFromShortlist = page.getByRole("main").getByRole("region", { name: "University courses", exact: true })
      .getByRole("button", { name: `Remove ${course.name} from shortlist`, exact: true });
    const removed = courseSaveWrite(page, "DELETE");
    await removeFromShortlist.click();
    await removed;
    await expect(page.getByRole("main").getByRole("region", { name: "University courses", exact: true }).getByRole("link", { name: course.name, exact: true })).toHaveCount(0);

    await page.reload();
    const reloadedMain = page.getByRole("main");
    await expect(reloadedMain.getByRole("heading", { name: /Everything you have saved/, level: 1 })).toBeVisible({ timeout: 15_000 });
    const reloadedCourses = reloadedMain.getByRole("region", { name: "University courses", exact: true });
    await expect(reloadedCourses.getByText("No saved university courses.", { exact: false })).toBeVisible();
    await expect(reloadedCourses.getByRole("link", { name: course.name, exact: true })).toHaveCount(0);
    await expect(reloadedMain.getByRole("region", { name: "Majors", exact: true }).getByRole("link", { name: "E2E Test Engineering", exact: true })).toBeVisible();

    await openCourses(page);
    await expect(courseCard(page, course).getByRole("button", { name: `Save ${course.name}`, exact: true })).toBeEnabled({ timeout: 15_000 });
    await expect(courseCard(page, course).getByRole("button", { name: removeLabel, exact: true })).toHaveCount(0);
  } finally {
    if (!page.isClosed()) {
      await unsaveCourse(page, course).catch(() => {});
      if (majorBookmarked) await setSeedMajorBookmark(page, false).catch(() => {});
    }
  }
});

test("course comparison keeps shared-UAC degrees distinct and shows unknowns, fee years and sources honestly", async ({ page }) => {
  await signInToIsolatedStudent(page);
  await openCourses(page);
  const main = page.getByRole("main");
  const compareButton = (course: SeededCourse) => courseCard(page, course)
    .getByRole("button", { name: `Compare ${course.name} at ${course.institution}`, exact: true });
  for (const course of [COURSES.unswCs, COURSES.unswScienceCs, COURSES.anu]) {
    await compareButton(course).click();
    await expect(compareButton(course)).toHaveAttribute("aria-pressed", "true");
  }
  const selection = main.getByRole("region", { name: "Selected courses", exact: true });
  await expect(selection.getByText("3 of 3 courses selected", { exact: true })).toBeVisible();
  await expect(compareButton(COURSES.sydney)).toBeDisabled();

  // Search and the saved filter hide cards but keep the selection.
  const search = main.getByRole("searchbox", { name: "Search degrees, universities or campuses" });
  await search.fill("Advanced Computing");
  await expect(courseCard(page, COURSES.unswCs)).toHaveCount(0);
  await expect(courseCard(page, COURSES.sydney)).toBeVisible();
  await expect(selection.getByText("3 of 3 courses selected", { exact: true })).toBeVisible();
  const savedOnly = main.getByRole("button", { name: "Saved courses", exact: true });
  await savedOnly.click();
  await expect(savedOnly).toHaveAttribute("aria-pressed", "true");
  await expect(selection.getByRole("button", { name: `Remove ${COURSES.unswCs.name} from comparison`, exact: true })).toBeVisible();
  await savedOnly.click();
  await expect(savedOnly).toHaveAttribute("aria-pressed", "false");
  await expect(selection.getByText("3 of 3 courses selected", { exact: true })).toBeVisible();

  const comparison = page.getByRole("dialog", { name: "Compare university courses" });
  const table = comparison.getByRole("table", { name: "Side-by-side comparison of selected university courses" });
  const row = (label: string) => table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: label, exact: true }) }).getByRole("cell");
  const mixedYears = comparison.getByText(/These fees cover different years/);

  await selection.getByRole("button", { name: "Compare selected courses", exact: true }).click();
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader")).toHaveText([
    "Attribute",
    `${COURSES.unswCs.name}${COURSES.unswCs.institution}`,
    `${COURSES.unswScienceCs.name}${COURSES.unswScienceCs.institution}`,
    `${COURSES.anu.name}${COURSES.anu.institution}`,
  ]);
  // Same UAC code, two distinct programs.
  await expect(row("Program and application codes")).toHaveText(["Program 3778; UAC 425800", "Program 3789; UAC 425800", "Program AACOM; UAC 135705"]);
  // Unknown campus and fee are stated as unknown: never blank and never $0.
  await expect(row("Campus")).toHaveText(["Kensington", "Kensington", "Campus not confirmed"]);
  await expect(row("Duration")).toHaveText([/^3 years full-time/, /^4 years full-time/, "4 years full-time"]);
  await expect(row("Indicative fees")).toHaveText([/^\$8,500 AUD \(2026\)\. Domestic Commonwealth Supported Place\./, /^\$8,000 AUD \(2026\)\./, "Fee not confirmed. Check the provider."]);
  await expect(row("Indicative fees").nth(2)).not.toContainText("$0");
  // Prerequisites and assumed knowledge are separate rows with separate values.
  await expect(row("Prerequisites")).toHaveText([
    "Prerequisites not confirmed. Check the provider.",
    "Prerequisites not confirmed. Check the provider.",
    /^Mathematics prerequisite varies by qualification\..*Check prerequisite details/,
  ]);
  await expect(row("Assumed knowledge")).toHaveText(["Mathematics Extension 1", "Mathematics Extension 1", "Assumed knowledge not confirmed"]);
  await expect(row("Prerequisites").nth(2).getByRole("link", { name: /Check prerequisite details/ }))
    .toHaveAttribute("href", "https://programsandcourses.anu.edu.au/2027/program/aacom#admission-and-fees");
  // One known fee year among these three, so no mixed-year warning yet.
  await expect(mixedYears).toHaveCount(0);
  const sources = row("Source");
  await expect(sources).toHaveCount(3);
  for (const [index, url] of [
    "https://www.unsw.edu.au/study/undergraduate/bachelor-of-computer-science",
    "https://www.unsw.edu.au/study/undergraduate/bachelor-of-science-computer-science",
    "https://programsandcourses.anu.edu.au/2027/program/aacom",
  ].entries()) {
    await expect(sources.nth(index)).toContainText(/Source checked 23 Oct\.? 2026\./);
    await expect(sources.nth(index).getByRole("link", { name: /View official course details/ })).toHaveAttribute("href", url);
  }
  await page.keyboard.press("Escape");
  await expect(comparison).toHaveCount(0);

  // Remove one selected offering by keyboard only: Tab to it, press Enter.
  const clearComparison = selection.getByRole("button", { name: "Clear comparison", exact: true });
  await clearComparison.focus();
  for (const course of [COURSES.unswCs, COURSES.unswScienceCs, COURSES.anu]) {
    await page.keyboard.press("Tab");
    await expect(selection.getByRole("button", { name: `Remove ${course.name} from comparison`, exact: true })).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await expect(selection.getByText("2 of 3 courses selected", { exact: true })).toBeVisible();
  await expect(selection.getByRole("button", { name: `Remove ${COURSES.anu.name} from comparison`, exact: true })).toHaveCount(0);
  await expect(compareButton(COURSES.anu)).toHaveAttribute("aria-pressed", "false");

  // Swap in Sydney, whose published fee is for a different year.
  await compareButton(COURSES.sydney).click();
  await expect(selection.getByText("3 of 3 courses selected", { exact: true })).toBeVisible();
  await selection.getByRole("button", { name: "Compare selected courses", exact: true }).click();
  await expect(table).toBeVisible();
  await expect(mixedYears).toBeVisible();
  await expect(row("Indicative fees")).toHaveText([/^\$8,500 AUD \(2026\)\./, /^\$8,000 AUD \(2026\)\./, /^\$9,552 AUD \(2027\)\./]);
  await expect(row("Campus")).toHaveText(["Kensington", "Kensington", "Camperdown/Darlington"]);
  await comparison.getByRole("button", { name: "Close comparison" }).click();
  await expect(comparison).toHaveCount(0);
});

test("majors and university courses link to each other through the paired navigation", async ({ page }) => {
  await signInToIsolatedStudent(page);
  await page.goto("/majors");
  const pairedNav = () => page.getByRole("main").getByRole("navigation", { name: "Course exploration" });
  await expect(pairedNav().getByRole("link", { name: "Explore majors", exact: true })).toHaveAttribute("aria-current", "page", { timeout: 15_000 });
  await expect(page.getByRole("main").getByRole("link", { name: "E2E Test Engineering", exact: true })).toBeVisible();

  await pairedNav().getByRole("link", { name: "University courses", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/courses");
  await expect(page.getByRole("main").getByRole("heading", { name: "Find the degree behind your interests", level: 1 })).toBeVisible({ timeout: 15_000 });
  await expect(pairedNav().getByRole("link", { name: "University courses", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(courseCard(page, COURSES.unswCs)).toBeVisible();

  await pairedNav().getByRole("link", { name: "Explore majors", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/majors");
  await expect(pairedNav().getByRole("link", { name: "Explore majors", exact: true })).toHaveAttribute("aria-current", "page", { timeout: 15_000 });
  await expect(page.getByRole("main").getByRole("link", { name: "E2E Test Engineering", exact: true })).toBeVisible();
});

// PROD-148: a saved course leads to the application at its university.
// tests/staging/seed-courses.sql links this synthetic offering to school 900001.
const E2E_COURSE: SeededCourse = { id: "e2e-test-course-900001", name: "E2E Test Bachelor of Computing", institution: "E2E Test University" };
const TRACK_E2E = "Track an application at E2E Test University";
const OPEN_E2E = "Open your E2E Test University application";

/** E2E Test University application cards on /applications, after the list has loaded. */
async function e2eApplicationCount(page: Page) {
  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "My Applications" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Couldn't load your applications.")).toHaveCount(0);
  return seededApplicationCard(page).card.count();
}

test("a saved course tracks its university application on a click, and the hub lists it with route and source after reload (PROD-148)", { tag: "@phone" }, async ({ page }) => {
  await signInToIsolatedStudent(page);
  try {
    await removeSeededApplication(page);
    await unsaveCourse(page, E2E_COURSE);
    expect(await e2eApplicationCount(page)).toBe(0);

    // Saving a course never creates an application.
    await openCourses(page, `/courses?course=${E2E_COURSE.id}`);
    const card = courseCard(page, E2E_COURSE);
    await expect(card.getByRole("button", { name: TRACK_E2E })).toHaveCount(0);
    const save = card.getByRole("button", { name: `Save ${E2E_COURSE.name}`, exact: true });
    await expect(save).toBeEnabled({ timeout: 15_000 });
    const saved = courseSaveWrite(page, "POST");
    await save.click();
    await saved;
    await expect(card.getByRole("button", { name: TRACK_E2E, exact: true })).toBeVisible();
    await expect(card.getByText("It does not apply to the university.", { exact: false })).toBeVisible();
    await page.reload();
    await expect(courseCard(page, E2E_COURSE).getByRole("button", { name: TRACK_E2E, exact: true })).toBeEnabled({ timeout: 15_000 });
    expect(await e2eApplicationCount(page)).toBe(0);

    // The labelled click on the Shortlist course row creates exactly one application.
    await page.goto("/shortlist?tab=course");
    const courseSection = page.getByRole("main").getByRole("region", { name: "University courses", exact: true });
    const track = courseSection.getByRole("button", { name: TRACK_E2E, exact: true });
    await expect(track).toBeEnabled({ timeout: 15_000 });
    const created = page.waitForResponse((r) => r.request().method() === "POST"
      && new URL(r.url()).pathname.endsWith("/rest/v1/user_school_applications") && r.ok(), { timeout: 15_000 });
    await track.click();
    await created;
    await expect(courseSection.getByRole("link", { name: OPEN_E2E })).toBeVisible();
    await expect(courseSection.getByRole("button", { name: TRACK_E2E })).toHaveCount(0);

    // After a reload /courses opens the same application; there is still only one.
    await openCourses(page, `/courses?course=${E2E_COURSE.id}`);
    const reloadedCard = courseCard(page, E2E_COURSE);
    const open = reloadedCard.getByRole("link", { name: OPEN_E2E });
    await expect(open).toBeVisible({ timeout: 15_000 });
    await expect(reloadedCard.getByRole("button", { name: TRACK_E2E })).toHaveCount(0);
    const href = await open.getAttribute("href");
    expect(href).toMatch(/^\/applications\/[0-9a-f-]+$/i);
    expect(await e2eApplicationCount(page)).toBe(1);

    // The hub lists the saved course with its recorded route, official link, source and date.
    await page.goto(href!);
    const hubCard = page.getByRole("main").getByRole("region", { name: "Courses you saved at E2E Test University", exact: true });
    const checkHub = async () => {
      await expect(hubCard.getByRole("link", { name: E2E_COURSE.name, exact: true })).toHaveAttribute("href", `/courses?course=${E2E_COURSE.id}`, { timeout: 15_000 });
      await expect(hubCard.getByText("E2E route: apply through the synthetic admissions centre.", { exact: false })).toBeVisible();
      await expect(hubCard.getByRole("link", { name: /^Official application page/ })).toHaveAttribute("href", "https://university.example.test/apply");
      await expect(hubCard.getByRole("link", { name: /^View official course details/ })).toHaveAttribute("href", "https://university.example.test/courses/computing");
      await expect(hubCard.locator("time")).toHaveCount(1);
      await expect(hubCard.getByText(/^Source checked .+\. Confirm current requirements before applying\.$/)).toBeVisible();
      // Not a preparation step: the checklist keeps its three steps.
      await expect(page.locator("li[data-state]")).toHaveCount(3);
    };
    await checkHub();
    await page.reload();
    await checkHub();
  } finally {
    if (!page.isClosed()) {
      await unsaveCourse(page, E2E_COURSE).catch(() => {});
      await removeSeededApplication(page).catch(() => {});
    }
  }
  // Cleanup persisted: no application and no save after a reload.
  expect(await e2eApplicationCount(page)).toBe(0);
  await openCourses(page, `/courses?course=${E2E_COURSE.id}`);
  await expect(courseCard(page, E2E_COURSE).getByRole("button", { name: `Save ${E2E_COURSE.name}`, exact: true })).toBeEnabled({ timeout: 15_000 });
});

// PROD-77: a scholarship with recorded requirements (seed-opportunities.sql).
const REQ_SCHOLARSHIP = { id: "e2000000-0000-4000-8000-0000000000a1", title: "E2E Requirements Scholarship" };
const BOOKMARK_WRITES = "/rest/v1/user_bookmarked_scholarships";

/** Read the student's own saved row for a scholarship straight from the local
 *  REST API with their own token (RLS keeps it owner-scoped; no service key). */
async function ownBookmarkRow(request: APIRequestContext, scholarshipId: string) {
  const api = assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").origin;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY must be set for the isolated direct read");
  const auth = await request.post(`${api}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey },
    data: { email: STUDENT_EMAIL, password: process.env.E2E_TEST_PASSWORD },
  });
  expect(auth.ok(), "local student sign-in for the direct read").toBe(true);
  const { access_token: token } = (await auth.json()) as { access_token: string };
  const res = await request.get(`${api}${BOOKMARK_WRITES}?scholarship_id=eq.${scholarshipId}&select=status,school_id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), "direct read of the saved scholarship").toBe(true);
  return (await res.json()) as { status: string; school_id: number | null }[];
}

test("a saved scholarship attaches to an application with a recorded checklist, ticks persist, and deleting the application detaches it (PROD-77)", { tag: "@phone" }, async ({ page, request }) => {
  test.setTimeout(120_000);
  await signInToIsolatedStudent(page);
  const detailPath = `/scholarships/${REQ_SCHOLARSHIP.id}`;
  const attachedGroup = page.getByRole("main").getByRole("region", { name: "Attached to this application", exact: true });
  try {
    // Clean slate: no application at 900001 and this scholarship not saved.
    await removeSeededApplication(page);
    await page.goto(detailPath);
    await expect(page.getByRole("heading", { name: REQ_SCHOLARSHIP.title })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /^(Save|Interested|Applied|Awarded|Not selected)$/ })).toBeVisible({ timeout: 15_000 });
    await untrackSeedScholarship(page);
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible({ timeout: 15_000 });

    // Save as Interested, then change it to Applied (the PROD-150 update path).
    await chooseScholarshipStatus(page, "Interested");
    await page.reload();
    await expect(page.getByRole("button", { name: "Interested", exact: true })).toBeVisible({ timeout: 15_000 });
    await chooseScholarshipStatus(page, "Applied");
    await page.reload();
    await expect(page.getByRole("button", { name: "Applied", exact: true })).toBeVisible({ timeout: 15_000 });

    // Create the application at 900001 and open its hub.
    await page.goto(`/schools/${SCHOOL_ID}`);
    await page.getByRole("button", { name: "Track Application" }).click();
    await expect(page.getByRole("link", { name: "Researching" })).toBeVisible({ timeout: 15_000 });
    await page.goto("/applications");
    const href = await seededApplicationCard(page).card.getByRole("link", { name: /open/i }).getAttribute("href");
    expect(href).toMatch(/^\/applications\/[0-9a-f-]+$/i);
    await page.goto(href!);
    await expect(page.getByRole("heading", { name: "E2E Test University", exact: true, level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(attachedGroup.getByText("You haven't attached a scholarship to this application.")).toBeVisible({ timeout: 15_000 });

    // Attach from the dialog.
    await page.getByRole("button", { name: "Attach a saved scholarship", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Attach a saved scholarship" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("It does not mean you are eligible, and it does not apply for you.", { exact: false })).toBeVisible();
    const attachWrite = page.waitForResponse((r) => r.url().includes(BOOKMARK_WRITES) && r.request().method() === "PATCH" && r.ok());
    await dialog.getByRole("button", { name: `Attach ${REQ_SCHOLARSHIP.title}`, exact: true }).click();
    await attachWrite;
    await expect(dialog).toHaveCount(0);

    const officialTick = attachedGroup.getByRole("checkbox", { name: "I've prepared this: Read the official scholarship page", exact: true });
    const checkChecklist = async () => {
      await expect(attachedGroup.getByRole("link", { name: REQ_SCHOLARSHIP.title, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(attachedGroup.getByText("A separate scholarship application is required (recorded)", { exact: true })).toBeVisible();
      await expect(attachedGroup.getByText("Recorded application mode: online form", { exact: true })).toBeVisible();
      await expect(attachedGroup.getByText("An essay is required (recorded)", { exact: true })).toBeVisible();
      await expect(attachedGroup.getByText("Recorded rule: E2E rule one", { exact: true })).toBeVisible();
      await expect(attachedGroup.getByText("Recorded rule: E2E rule two", { exact: true })).toBeVisible();
      await expect(attachedGroup.getByText("Check with the provider", { exact: true }).first()).toBeVisible();
      // The seeded source was last verified 200 days ago, so it carries the stale label.
      await expect(attachedGroup.locator("[data-source-note]")).toHaveText(/^Last checked \d{1,2} \w{3,4} \d{4}\. Details may have changed\.$/);
      await expect(attachedGroup.getByText("Completing this checklist is not submitting an application.", { exact: false })).toBeVisible();
      await expect(attachedGroup.getByRole("link", { name: "Read the official scholarship page" })).toHaveAttribute("href", "https://scholarship.example.test/e2e-requirements");
      // Not a preparation step: the application checklist keeps its three steps.
      await expect(page.locator("li[data-state]")).toHaveCount(3);
    };
    await checkChecklist();

    // Tick one item; it persists across a reload.
    await expect(officialTick).not.toBeChecked();
    const tickWrite = page.waitForResponse((r) => r.url().includes("/rest/v1/user_scholarship_prep_checks") && r.request().method() === "POST" && r.ok());
    await officialTick.check();
    await tickWrite;
    await page.reload();
    await checkChecklist();
    await expect(officialTick).toBeChecked();

    // Shortlist names the application it is attached to.
    await page.goto("/shortlist?tab=scholarship");
    const shortlistRow = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: REQ_SCHOLARSHIP.title, exact: true }) });
    await expect(shortlistRow.getByRole("link", { name: "For E2E Test University", exact: true })).toHaveAttribute("href", href!, { timeout: 15_000 });

    // Detach: the checklist goes, the save stays (and Shortlist drops "For ...").
    await page.goto(href!);
    const detachWrite = page.waitForResponse((r) => r.url().includes(BOOKMARK_WRITES) && r.request().method() === "PATCH" && r.ok());
    await attachedGroup.getByRole("button", { name: `Detach ${REQ_SCHOLARSHIP.title}`, exact: true }).click({ timeout: 15_000 });
    await detachWrite;
    await page.reload();
    await expect(attachedGroup.getByText("You haven't attached a scholarship to this application.")).toBeVisible({ timeout: 15_000 });
    await expect(attachedGroup.getByRole("link", { name: REQ_SCHOLARSHIP.title })).toHaveCount(0);
    await page.goto("/shortlist?tab=scholarship");
    await expect(shortlistRow).toHaveCount(1, { timeout: 15_000 });
    await expect(shortlistRow.getByText(/^For /)).toHaveCount(0);

    // Attach again from the name-match suggestion, then delete the application:
    // the database detaches it and keeps the save.
    await page.goto(href!);
    const suggestions = page.getByRole("main").getByRole("region", { name: "Saved scholarships that mention E2E Test University", exact: true });
    const reattach = page.waitForResponse((r) => r.url().includes(BOOKMARK_WRITES) && r.request().method() === "PATCH" && r.ok());
    await suggestions.getByRole("button", { name: `Attach ${REQ_SCHOLARSHIP.title}`, exact: true }).click({ timeout: 15_000 });
    await reattach;
    expect(await ownBookmarkRow(request, REQ_SCHOLARSHIP.id)).toEqual([{ status: "applied", school_id: SCHOOL_ID }]);
    await removeSeededApplication(page);
    expect(await e2eApplicationCount(page)).toBe(0);
    expect(await ownBookmarkRow(request, REQ_SCHOLARSHIP.id)).toEqual([{ status: "applied", school_id: null }]);
  } finally {
    if (!page.isClosed()) {
      await removeSeededApplication(page).catch(() => {});
      try {
        await page.goto(detailPath);
        await expect(page.getByRole("button", { name: /^(Save|Interested|Applied|Awarded|Not selected)$/ })).toBeVisible({ timeout: 15_000 });
        await untrackSeedScholarship(page);
        await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible({ timeout: 15_000 });
      } catch {
        // Cleanup must not mask the assertion that failed above.
      }
    }
  }
  // Cleanup persisted: the save is gone (its ticks cascade with it).
  expect(await ownBookmarkRow(request, REQ_SCHOLARSHIP.id)).toEqual([]);
});

// PROD-78: a library document linked to an application, tailored there only.
const LINK_WRITES = "/rest/v1/application_evidence_links";
const linkWrite = (page: Page, method: "POST" | "PATCH" | "DELETE") =>
  page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(LINK_WRITES) && r.request().method() === method && r.ok(), { timeout: 15_000 });
const pdfBytes = (note: string) => Buffer.from(`%PDF-1.4\n% ${note}\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n`);

test("a library document links to an application, keeps its tailoring when the file is replaced, and unlinking keeps the document (PROD-78)", { tag: "@phone" }, async ({ page }) => {
  test.setTimeout(150_000);
  await signInToIsolatedStudent(page);
  const fileName = `${marker("portfolio")}.pdf`;
  const tailoredTitle = `Arts portfolio ${RUN_ID}`;
  const docRow = () => page.getByText(fileName, { exact: true }).locator("xpath=../../..");
  const linked = page.getByRole("main").getByRole("region", { name: "Linked from your documents", exact: true });
  const prep = page.locator("[data-prep-checklist]");
  try {
    await removeSeededApplication(page);

    // A document in the library.
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "Document Vault" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Upload New" }).click();
    await page.locator('input[type="file"]').last().setInputFiles({ name: fileName, mimeType: "application/pdf", buffer: pdfBytes("original") });
    const inserted = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/rest/v1/documents") && r.request().method() === "POST" && r.ok(), { timeout: 20_000 });
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await inserted;
    // The sheet also shows the chosen file's name: wait for the row itself.
    await expect(docRow().getByText("In Review", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(docRow().getByText(/^Used in /)).toHaveCount(0);

    // The 900001 application and its hub.
    await page.goto(`/schools/${SCHOOL_ID}`);
    await page.getByRole("button", { name: "Track Application" }).click();
    await expect(page.getByRole("link", { name: "Researching" })).toBeVisible({ timeout: 15_000 });
    await page.goto("/applications");
    const href = await seededApplicationCard(page).card.getByRole("link", { name: /open/i }).getAttribute("href");
    expect(href).toMatch(/^\/applications\/[0-9a-f-]+$/i);
    await page.goto(href!);
    await expect(linked.getByText("You haven't linked a document from your library to this application.")).toBeVisible({ timeout: 15_000 });
    const scoreBefore = await prep.locator("text=/\\d of 3 steps/").textContent();

    // Link it from the dialog.
    await linked.getByRole("button", { name: "Link a document", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Link a document" });
    await expect(dialog.getByText("It doesn't upload anything new or send anything to the university.", { exact: false })).toBeVisible();
    const created = linkWrite(page, "POST");
    await dialog.getByRole("button", { name: `Link ${fileName}`, exact: true }).click({ timeout: 15_000 });
    await created;
    await expect(dialog).toHaveCount(0);
    await expect(linked.getByRole("link", { name: fileName, exact: true })).toBeVisible();
    // Not a preparation step: the score and the three steps do not move.
    await expect(prep.locator("text=/\\d of 3 steps/")).toHaveText(scoreBefore!);
    await expect(page.locator("li[data-state]")).toHaveCount(3);

    // Tailor the title for this application; it survives a reload.
    await linked.getByRole("button", { name: `Tailor ${fileName}`, exact: true }).click();
    await linked.locator('input[name="tailored-title"]').fill(tailoredTitle);
    const tailored = linkWrite(page, "PATCH");
    await linked.getByRole("button", { name: "Save tailoring", exact: true }).click();
    await tailored;
    await page.reload();
    await expect(linked.getByRole("link", { name: tailoredTitle, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(linked.getByText(`Tailored for E2E Test University. Library file: ${fileName}`, { exact: true })).toBeVisible();
    await expect(linked.getByText("Library version updated since you tailored this.")).toHaveCount(0);

    // Documents shows where it is used; replacing the file moves uploaded_at.
    await page.goto("/documents");
    await expect(docRow().getByText("Used in 1 application", { exact: true })).toBeVisible({ timeout: 15_000 });
    await docRow().getByRole("button", { name: "More options" }).click();
    await page.getByRole("menuitem", { name: "Re-upload", exact: true }).click();
    await page.locator('input[type="file"]').last().setInputFiles({ name: fileName, mimeType: "application/pdf", buffer: pdfBytes("replacement") });
    const replaced = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/rest/v1/documents") && r.request().method() === "PATCH" && r.ok(), { timeout: 20_000 });
    await page.getByRole("button", { name: "Replace", exact: true }).click();
    await replaced;

    // The tailored link flags the newer file; Keep mine keeps the tailoring.
    await page.goto(href!);
    const notice = linked.getByText("Library version updated since you tailored this.");
    await expect(notice).toBeVisible({ timeout: 15_000 });
    await expect(linked.getByRole("link", { name: tailoredTitle, exact: true })).toBeVisible();
    const kept = linkWrite(page, "PATCH");
    await linked.getByRole("button", { name: "Keep mine", exact: true }).click();
    await kept;
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(linked.getByRole("link", { name: tailoredTitle, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(notice).toHaveCount(0);

    // Unlink: the link goes, the document stays.
    await linked.getByRole("button", { name: `Unlink ${tailoredTitle}`, exact: true }).click();
    await expect(linked.getByText("Removes it and its scholarship requirement links from this application. The file stays in Documents.")).toBeVisible();
    const unlinked = linkWrite(page, "DELETE");
    await linked.getByRole("button", { name: "Confirm unlink", exact: true }).click();
    await unlinked;
    await page.reload();
    await expect(linked.getByText("You haven't linked a document from your library to this application.")).toBeVisible({ timeout: 15_000 });
    await page.goto("/documents");
    await expect(page.getByText(fileName, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(docRow().getByText(/^Used in /)).toHaveCount(0);

    // Delete the application.
    await removeSeededApplication(page);
    expect(await e2eApplicationCount(page)).toBe(0);
  } finally {
    if (!page.isClosed()) {
      // Application first: its links cascade, so the document can then be deleted.
      await removeSeededApplication(page).catch(() => {});
      try {
        await page.goto("/documents");
        await expect(page.getByRole("heading", { name: "Document Vault" })).toBeVisible({ timeout: 15_000 });
        await removeDocument(page, fileName);
      } catch {
        // Cleanup must not mask the assertion that failed above.
      }
    }
  }
  // Cleanup persisted: the document is gone after a reload.
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Document Vault" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(fileName, { exact: true })).toHaveCount(0);
});

test('library activities, awards and experience import once and tailor independently across two applications (PROD-153)', { tag: '@phone' }, async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(15_000);
  const api = assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL').origin;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = await request.post(`${api}/auth/v1/token?grant_type=password`, { headers: { apikey: key }, data: { email: STUDENT_EMAIL, password: process.env.E2E_TEST_PASSWORD } });
  expect(auth.ok()).toBe(true);
  const session = await auth.json() as { access_token: string; user: { id: string } };
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}`, Prefer: 'return=representation' };
  const own = `user_id=eq.${session.user.id}`;
  const read = async (table: string, query: string) => { const r = await request.get(`${api}/rest/v1/${table}?${query}`, { headers }); expect(r.ok()).toBe(true); return r.json(); };
  const create = async (table: string, data: unknown) => { const r = await request.post(`${api}/rest/v1/${table}`, { headers, data }); expect(r.ok()).toBe(true); return (await r.json())[0]; };
  const profile = (await read('profiles', `id=eq.${session.user.id}&select=activities,default_resume_id`))[0];
  const activity = marker('E2E library activity'), experience = marker('E2E library experience'), award = marker('E2E library award');
  const items: string[] = [], createdApps: string[] = [], apps: string[] = [];
  let resumeId: string | null = null;
  const library = page.getByRole('region', { name: 'Activities, awards and experience library', exact: true });
  const hub = page.getByRole('region', { name: 'Application activities, awards and experience', exact: true });
  const itemWrite = () => page.waitForResponse(r => new URL(r.url()).pathname.endsWith('/rest/v1/evidence_items') && r.request().method() === 'POST' && r.ok());
  // PROD-167: exercise pointer opening (including Safari's non-focusing clicks),
  // both close paths, and the next keyboard step returning to the same control.
  const pointerReturn = async (opener: Locator, dialog: Locator) => {
    for (const close of ['button', 'escape']) {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await opener.click();
      await expect(dialog).toBeVisible();
      if (close === 'button') await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
      else await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    }
  };
  try {
    expect((await request.patch(`${api}/rest/v1/profiles?id=eq.${session.user.id}`, { headers, data: { activities: [...(profile.activities ?? []), activity] } })).ok()).toBe(true);
    resumeId = (await create('resumes', { user_id: session.user.id, title: marker('Library import resume') })).id;
    expect((await request.patch(`${api}/rest/v1/profiles?id=eq.${session.user.id}`, { headers, data: { default_resume_id: resumeId } })).ok()).toBe(true);
    const resumeData = { entries: [{ id: 'library-experience', title: experience, company: 'Local club', startDate: 'Summer 2024', endDate: '', current: true, description: '<p>Helped <strong>new members</strong>.</p>' }] };
    const section = await create('resume_sections', { resume_id: resumeId, section_key: 'experience', label: 'Experience', mode: 'guided', sort_order: 0, content_html: '', structured_data: resumeData });
    for (const schoolId of [900001, 900153]) {
      const existing = await read('user_school_applications', `${own}&school_id=eq.${schoolId}&select=id`);
      const app = existing[0] ?? await create('user_school_applications', { user_id: session.user.id, school_id: schoolId, status: 'researching' });
      apps.push(app.id); if (!existing.length) createdApps.push(app.id);
    }
    await signInToIsolatedStudent(page);
    await page.goto('/profile#evidence-library');
    await expect(library.getByRole('button', {name:'Import existing work',exact:true})).toBeEnabled();
    await expect(page.getByRole('link', {name:`Edit "${marker('Library import resume')}"`,exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    await pointerReturn(library.getByRole('button', { name: 'Import existing work', exact: true }), page.getByRole('dialog', { name: 'Import existing work', exact: true }));
    await pointerReturn(library.getByRole('button', { name: 'Add library item', exact: true }), page.getByRole('dialog', { name: 'Add library item', exact: true }));
    await library.getByRole('button', { name: 'Import existing work', exact: true }).focus();
    await library.getByRole('button', { name: 'Import existing work', exact: true }).press('Enter');
    const importing = page.getByRole('dialog', { name: 'Import existing work', exact: true });
    for (const name of [activity, experience]) {
      const writing = itemWrite();
      await importing.getByRole('button', { name: `Import ${name}`, exact: true }).click();
      items.push((await (await writing).json())[0].id);
      await expect(importing.getByRole('button', { name: `Import ${name}`, exact: true })).toBeDisabled();
    }
    await page.keyboard.press('Escape');
    await expect(importing).toHaveCount(0);
    await expect(library.getByRole('button', { name: 'Import existing work', exact: true })).toBeFocused();
    await expect(library.locator('[data-library-item]').filter({ has: page.getByRole('heading', { name: experience, exact: true }) }).getByText('Summer 2024 – Present', { exact: false })).toBeVisible();
    expect((await read('resume_sections', `id=eq.${section.id}&select=structured_data`))[0].structured_data).toEqual(resumeData);
    await library.getByRole('button', { name: 'Add library item', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Add library item', exact: true });
    await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('award');
    await editor.getByLabel('Title', { exact: true }).fill(award);
    await editor.getByLabel('Description', { exact: true }).fill('Original achievement');
    const writing = itemWrite(); await editor.getByRole('button', { name: 'Save item', exact: true }).click();
    items.push((await (await writing).json())[0].id);
    await expect(editor).toHaveCount(0);
    await expect(library.getByRole('button', { name: 'Add library item', exact: true })).toBeFocused();
    await page.reload();
    await expect(library.getByRole('heading', { name: award, exact: true })).toBeVisible();
    await library.screenshot({ path: `/tmp/caat-library-${testInfo.project.name}.png` });
    for (const appId of apps) {
      await page.goto(`/applications/${appId}`);
      await pointerReturn(hub.getByRole('button', { name: 'Add from your library', exact: true }), page.getByRole('dialog', { name: 'Add from your library', exact: true }));
      await hub.getByRole('button', { name: 'Add from your library', exact: true }).click();
      const picker = page.getByRole('dialog', { name: 'Add from your library', exact: true });
      await picker.getByRole('button', { name: `Link ${award}`, exact: true }).click();
      await expect(picker).toHaveCount(0);
      await expect(hub.getByRole('button', { name: 'Add from your library', exact: true })).toBeFocused();
      await expect(hub.getByText('Original achievement', { exact: true })).toBeVisible();
    }
    await page.goto(`/applications/${apps[0]}`);
    await pointerReturn(hub.getByRole('button', { name: `Tailor ${award}`, exact: true }), page.getByRole('dialog', { name: /^Tailor for / }));
    await hub.getByRole('button', { name: `Tailor ${award}`, exact: true }).click();
    const tailor = page.getByRole('dialog', { name: /^Tailor for / });
    await tailor.getByLabel('Application title', { exact: true }).fill('My tailored achievement');
    await tailor.getByRole('textbox', { name: 'Application description', exact: true }).fill('Independent application wording');
    await tailor.getByRole('button', { name: 'Save application version', exact: true }).click();
    await expect(tailor).toHaveCount(0);
    await expect(hub.getByRole('button', { name: 'Tailor My tailored achievement', exact: true })).toBeFocused();
    await page.goto('/profile#evidence-library');
    const awardRow = library.locator('[data-library-item]').filter({ has: page.getByRole('heading', { name: award, exact: true }) });
    await expect(awardRow.getByText('Used in 2 applications', { exact: true })).toBeVisible();
    await expect(awardRow.getByRole('button', { name: `Delete ${award}`, exact: true })).toBeDisabled();
    await pointerReturn(awardRow.getByRole('button', { name: `Edit ${award}`, exact: true }), page.getByRole('dialog', { name: 'Edit library item', exact: true }));
    await awardRow.getByRole('button', { name: `Edit ${award}`, exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit library item', exact: true });
    await edit.getByRole('textbox', { name: 'Description', exact: true }).fill('Updated achievement');
    await edit.getByRole('button', { name: 'Save item', exact: true }).click();
    await expect(edit).toHaveCount(0);
    await expect(awardRow.getByRole('button', { name: `Edit ${award}`, exact: true })).toBeFocused();
    await page.goto(`/applications/${apps[0]}`);
    await expect(hub.getByText('Independent application wording', { exact: true })).toBeVisible();
    const changed = hub.getByText('Library version updated since you tailored this. Your text has been kept.', { exact: true });
    await expect(changed).toBeVisible();
    await hub.screenshot({ path: `/tmp/caat-library-hub-${testInfo.project.name}.png` });
    await hub.getByRole('button', { name: 'Keep mine', exact: true }).click();
    await expect(changed).toHaveCount(0);
    await page.reload();
    await expect(hub.getByText('Independent application wording', { exact: true })).toBeVisible();
    await expect(changed).toHaveCount(0);
    await page.goto(`/applications/${apps[1]}`);
    await expect(hub.getByText('Updated achievement', { exact: true })).toBeVisible();
    await expect(hub.getByText('Independent application wording', { exact: true })).toHaveCount(0);
    await page.goto(`/applications/${apps[0]}`);
    await hub.getByRole('button', { name: 'Use library version', exact: true }).click();
    await hub.getByRole('button', { name: 'Confirm use library item', exact: true }).click();
    await expect(hub.getByText('Updated achievement', { exact: true })).toBeVisible();
    for (const appId of apps) {
      await page.goto(`/applications/${appId}`);
      await hub.getByRole('button', { name: `Unlink ${award}`, exact: true }).click();
      await hub.getByRole('button', { name: 'Confirm unlink item', exact: true }).click();
      await expect(hub.getByRole('heading', { name: award, exact: true })).toHaveCount(0);
    }
    await page.goto('/profile#evidence-library');
    await expect(awardRow.getByRole('heading', { name: award, exact: true })).toBeVisible();
    await awardRow.getByRole('button', { name: `Delete ${award}`, exact: true }).click();
    await awardRow.getByRole('button', { name: 'Confirm delete item', exact: true }).click();
    await expect(awardRow).toHaveCount(0);
  } finally {
    if (items.length) {
      await request.delete(`${api}/rest/v1/application_evidence_links?${own}&evidence_item_id=in.(${items.join(',')})`, { headers });
      await request.delete(`${api}/rest/v1/evidence_items?${own}&id=in.(${items.join(',')})`, { headers });
    }
    for (const id of createdApps) await request.delete(`${api}/rest/v1/user_school_applications?${own}&id=eq.${id}`, { headers });
    if (resumeId) await request.delete(`${api}/rest/v1/resumes?${own}&id=eq.${resumeId}`, { headers });
    await request.patch(`${api}/rest/v1/profiles?id=eq.${session.user.id}`, { headers, data: { activities: profile.activities, default_resume_id: profile.default_resume_id } });
  }
});

// PROD-161: saved supporting work connects to a requirement, never to completion.
test('requirement supporting work persists with tailored previews, manual ticks and safe unlink (PROD-161)', {tag:'@phone'}, async ({page,request},testInfo)=>{
 test.setTimeout(120_000);
 page.setDefaultTimeout(15_000);
 const supportScholarship={id:'e2000000-0000-4000-8000-000000000163',title:'E2E Supporting Work Scholarship'};
 const companionId='e2000000-0000-4000-8000-000000000164';
 const createdBookmarks:string[]=[];
 const api=assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,'NEXT_PUBLIC_SUPABASE_URL').origin;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const auth=await request.post(`${api}/auth/v1/token?grant_type=password`,{headers:{apikey:key},data:{email:STUDENT_EMAIL,password:process.env.E2E_TEST_PASSWORD}});
 expect(auth.ok()).toBe(true);
 const session=await auth.json() as {access_token:string;user:{id:string}};
 const headers={apikey:key,Authorization:`Bearer ${session.access_token}`,Prefer:'return=representation'};
 const own=`user_id=eq.${session.user.id}`;
 const read=async(table:string,query:string)=>{const r=await request.get(`${api}/rest/v1/${table}?${query}`,{headers});expect(r.ok()).toBe(true);return r.json();};
 const create=async(table:string,data:unknown)=>{const r=await request.post(`${api}/rest/v1/${table}`,{headers,data});expect(r.ok(),await r.text()).toBe(true);return (await r.json())[0];};
 const del=async(table:string,query:string)=>{const r=await request.delete(`${api}/rest/v1/${table}?${query}`,{headers});expect(r.ok()).toBe(true);};
 // Refuse stale fixture bookmarks before writing: never cascade someone else's
 // existing requirement links while setting up or cleaning this journey.
 for(const id of [supportScholarship.id,companionId])
  expect(await read('user_bookmarked_scholarships',`${own}&scholarship_id=eq.${id}`),'Reserved supporting-work fixture is already in use').toEqual([]);
 const existing=(await read('user_school_applications',`${own}&school_id=eq.900001`))[0];
 let appId=existing?.id as string|undefined,itemId:string|undefined,documentId:string|undefined,draftId:string|undefined;
 const evidenceIds:string[]=[];
 const title=marker('Requirement award'),file=marker('Requirement document'),draft=marker('Requirement draft');
 try {
  if(!appId) appId=(await create('user_school_applications',{user_id:session.user.id,school_id:900001,status:'researching'})).id;
  for(const id of [supportScholarship.id,companionId]){
   await create('user_bookmarked_scholarships',{user_id:session.user.id,scholarship_id:id,school_id:900001,status:'interested'});
   createdBookmarks.push(id);
  }
  itemId=(await create('evidence_items',{user_id:session.user.id,kind:'award',title:'Library version',description:'Original source'})).id;
  const evidence=await create('application_evidence_links',{user_id:session.user.id,application_id:appId,kind:'item',evidence_item_id:itemId});evidenceIds.push(evidence.id);
  expect((await request.patch(`${api}/rest/v1/application_evidence_links?id=eq.${evidence.id}`,{headers,data:{tailored_title:title,tailored_body:'Application-specific award statement'}})).ok()).toBe(true);
  documentId=(await create('documents',{user_id:session.user.id,category:'other',file_name:file,storage_path:`${session.user.id}/synthetic-requirement.txt`,status:'pending'})).id;
  evidenceIds.push((await create('application_evidence_links',{user_id:session.user.id,application_id:appId,kind:'document',document_id:documentId})).id);
  draftId=(await create('essay_drafts',{user_id:session.user.id,prompt_id:crypto.randomUUID(),prompt_slug:'synthetic-requirement',label:draft,content:'Saved essay statement'})).id;
  await signInToIsolatedStudent(page);await page.goto(`/applications/${appId}`);
  const card=page.locator(`[data-attached-scholarship="${supportScholarship.id}"]`);
  const essay=card.locator('[data-checklist-item="essay"]');
  const opener=essay.getByRole('button',{name:/Link supporting work:/});
  await expect(opener).toBeEnabled();await opener.focus();await opener.press('Enter');
  const dialog=page.getByRole('dialog',{name:'Link supporting work',exact:true});
  await expect(dialog.getByRole('radio',{name:new RegExp(title)})).toBeEnabled();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
  for(const name of [title,file,draft]){
   await opener.click();await dialog.getByRole('radio',{name:new RegExp(name)}).check();
   if(name===title) await expect(dialog.getByText('Application-specific award statement',{exact:true})).toBeVisible();
   let writes=0,failRefresh=false;
   const associationRoute='**/rest/v1/requirement_evidence_links*';
   if(name===title)await page.route(associationRoute,async route=>{
    if(route.request().method()==='POST'){
     writes++;const response=await route.fetch();expect(response.ok()).toBe(true);failRefresh=true;await route.fulfill({response});
    }else if(route.request().method()==='GET'&&failRefresh){
     await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic post-save refresh outage'})});
    }else await route.continue();
   });
   await dialog.getByRole('button',{name:'Link selected work',exact:true}).click();await expect(dialog).toHaveCount(0);
   if(name===title){
    const group=page.getByRole('group',{name:'Supporting work',exact:true});
    await expect(group.getByRole('status').filter({hasText:'Supporting link saved.'})).toBeVisible();
    await expect(group.getByRole('alert')).toContainText('Could not load supporting work');
    await expect(group).toBeFocused();await expect(opener).toBeDisabled();
    expect(await read('requirement_evidence_links',`${own}&scholarship_id=eq.${supportScholarship.id}`)).toHaveLength(1);
    await testInfo.attach('supporting-work-saved-refresh-failed',{body:await group.screenshot(),contentType:'image/png'});
    await page.unroute(associationRoute);await group.getByRole('button',{name:'Refresh supporting work',exact:true}).click();
    await expect(group.getByRole('alert')).toHaveCount(0);expect(writes).toBe(1);
   }else await expect(opener).toBeFocused();
   await expect(essay.getByText(name,{exact:true})).toBeVisible();
  }
  await page.reload();await expect(essay.locator('[data-requirement-link]')).toHaveCount(3);
  await expect(essay.getByRole('checkbox')).not.toBeChecked();
  const tickSaved=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/rest/v1/user_scholarship_prep_checks')&&r.request().method()==='POST'&&r.ok());
  await essay.getByRole('checkbox').check();await tickSaved;await page.reload();await expect(essay.getByRole('checkbox')).toBeChecked();
  const row=essay.locator('[data-requirement-link]').filter({hasText:title});await row.locator('summary').click();
  await expect(row.getByText('Application-specific award statement',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
  const itemHub=page.getByRole('region',{name:'Application activities, awards and experience',exact:true});
  await itemHub.getByRole('button',{name:`Tailor ${title}`,exact:true}).click();
  const tailoring=page.getByRole('dialog',{name:/Tailor for/});
  await tailoring.getByRole('textbox',{name:'Application description',exact:true}).fill('Updated application statement');
  await tailoring.getByRole('button',{name:'Save application version',exact:true}).click();await expect(tailoring).toHaveCount(0);
  await expect(row.getByText('Updated application statement',{exact:true})).toBeVisible();
  await expect(row.getByText('Application-specific award statement',{exact:true})).toHaveCount(0);
  await testInfo.attach('requirement-supporting-work',{body:await card.screenshot(),contentType:'image/png'});
  await row.getByRole('button',{name:`Remove supporting link: ${title}`,exact:true}).click();
  await expect(essay.locator('[data-requirement-link]')).toHaveCount(2);await expect(essay.getByRole('checkbox')).toBeChecked();
  expect((await read('evidence_items',`${own}&id=eq.${itemId}`))[0].description).toBe('Original source');
  const documentHub=page.getByRole('region',{name:'Linked from your documents',exact:true});
  await documentHub.getByRole('button',{name:`Unlink ${file}`,exact:true}).click();
  await documentHub.getByRole('button',{name:'Confirm unlink',exact:true}).click();
  await expect(essay.locator('[data-requirement-link]')).toHaveCount(1);
  await card.getByRole('button',{name:`Detach ${supportScholarship.title}`,exact:true}).click();await expect(card).toHaveCount(0);
  expect(await read('requirement_evidence_links',`${own}&application_id=eq.${appId}&scholarship_id=eq.${supportScholarship.id}`)).toEqual([]);
  // The second attached scholarship keeps the provider mounted. Reattaching
  // must not resurrect the old cached draft association.
  await page.getByRole('button',{name:'Attach a saved scholarship',exact:true}).click();
  const attaching=page.getByRole('dialog',{name:'Attach a saved scholarship',exact:true});
  await attaching.getByRole('button',{name:`Attach ${supportScholarship.title}`,exact:true}).click();await expect(attaching).toHaveCount(0);
  await expect(opener).toBeEnabled();await expect(essay.locator('[data-requirement-link]')).toHaveCount(0);
  expect((await read('essay_drafts',`${own}&id=eq.${draftId}`))).toHaveLength(1);
  expect((await read('user_scholarship_prep_checks',`${own}&scholarship_id=eq.${supportScholarship.id}`))).toHaveLength(1);
 } finally {
  for(const id of evidenceIds) await del('application_evidence_links',`${own}&id=eq.${id}`);
  if(itemId)await del('evidence_items',`${own}&id=eq.${itemId}`);
  if(documentId)await del('documents',`${own}&id=eq.${documentId}`);
  if(draftId)await del('essay_drafts',`${own}&id=eq.${draftId}`);
  for(const id of createdBookmarks)await del('user_bookmarked_scholarships',`${own}&scholarship_id=eq.${id}`);
  if(!existing&&appId)await del('user_school_applications',`${own}&id=eq.${appId}`);
 }
});

// PROD-162: download through the actual UI and server, beyond one database page.
test("account download includes all pages, saved courses and only own community actions (PROD-162)", { tag: "@phone" }, async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const api = assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").origin;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  async function session(email: string) {
    const response = await request.post(`${api}/auth/v1/token?grant_type=password`, {
      headers: { apikey: key }, data: { email, password: process.env.E2E_TEST_PASSWORD },
    });
    expect(response.ok()).toBe(true);
    const value = await response.json() as { access_token: string; user: { id: string } };
    return { id: value.user.id, headers: { apikey: key, Authorization: `Bearer ${value.access_token}` } };
  }
  const student = await session(STUDENT_EMAIL);
  const peer = await session("e2e.peer@caat.local.test");
  const title = marker(`Export-${testInfo.project.name}`);
  const ids = Array.from({ length: 201 }, () => crypto.randomUUID());
  const peerTodo = crypto.randomUUID();
  const courseQuery = `user_id=eq.${student.id}&course_id=eq.${E2E_COURSE.id}`;
  const courseBefore = await request.get(`${api}/rest/v1/user_course_bookmarks?${courseQuery}`, { headers: student.headers });
  expect(courseBefore.ok()).toBe(true);
  const hasCourse = (await courseBefore.json()).length > 0;
  const addedFollows: Array<{ headers: Record<string,string>; query: string }> = [];
  try {
    const todos = await request.post(`${api}/rest/v1/user_todos`, { headers: student.headers,
      data: ids.map((id, i) => ({ id, user_id: student.id, text: `${title}-${i}` })) });
    expect(todos.ok()).toBe(true);
    expect((await request.post(`${api}/rest/v1/user_todos`, { headers: peer.headers,
      data: { id: peerTodo, user_id: peer.id, text: `${title}-peer-private` } })).ok()).toBe(true);
    if (!hasCourse) {
      expect((await request.post(`${api}/rest/v1/user_course_bookmarks`, { headers: student.headers,
        data: { user_id: student.id, course_id: E2E_COURSE.id } })).ok()).toBe(true);
    }
    // Both directions are publicly readable; the export must include only the caller's action.
    for (const [from, to] of [[student, peer], [peer, student]]) {
      const query = `follower_id=eq.${from.id}&followee_id=eq.${to.id}`;
      const existing = await request.get(`${api}/rest/v1/community_follows?${query}`, { headers: from.headers });
      expect(existing.ok()).toBe(true);
      if (!(await existing.json()).length) {
        expect((await request.post(`${api}/rest/v1/community_follows`, { headers: from.headers,
          data: { follower_id: from.id, followee_id: to.id } })).ok()).toBe(true);
        addedFollows.push({ headers: from.headers, query });
      }
    }
    await signInToIsolatedStudent(page);
    await page.goto("/settings");
    await expect(page.getByText(/Includes document details, but not/)).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    const responsePromise = page.waitForResponse(r => new URL(r.url()).pathname === "/settings/export");
    await page.getByRole("button", { name: "Export my data", exact: true }).click();
    const download = await downloadPromise;
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(download.suggestedFilename()).toMatch(/^caat-data-export-.*\.json$/);
    const { readFile } = await import("node:fs/promises");
    const payload = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(payload.account.id).toBe(student.id);
    const exported = payload.data.user_todos as Array<{ id: string; user_id: string }>;
    expect(exported.filter(row => ids.includes(row.id))).toHaveLength(201);
    expect(exported.every(row => row.user_id === student.id)).toBe(true);
    expect(exported.some(row => row.id === peerTodo)).toBe(false);
    expect(payload.data.user_course_bookmarks).toContainEqual(expect.objectContaining({ user_id: student.id, course_id: E2E_COURSE.id }));
    expect(payload.data.community_follows).toContainEqual(expect.objectContaining({ follower_id: student.id, followee_id: peer.id }));
    expect(payload.data.community_follows.every((row: { follower_id: string }) => row.follower_id === student.id)).toBe(true);
    expect(payload.scope.excludes).toContain("uploaded_file_contents");
    await expect(page.getByRole("button", { name: "Export my data", exact: true })).toBeEnabled();
    await testInfo.attach("account-download-settings", { body: await page.screenshot(), contentType: "image/png" });
  } finally {
    // Delete only IDs created by this run; never remove existing account data.
    for (let start = 0; start < ids.length; start += 100) {
      expect((await request.delete(`${api}/rest/v1/user_todos?user_id=eq.${student.id}&id=in.(${ids.slice(start,start+100).join(",")})`, { headers: student.headers })).ok()).toBe(true);
    }
    expect((await request.delete(`${api}/rest/v1/user_todos?user_id=eq.${peer.id}&id=eq.${peerTodo}`, { headers: peer.headers })).ok()).toBe(true);
    if (!hasCourse) expect((await request.delete(`${api}/rest/v1/user_course_bookmarks?${courseQuery}`, { headers: student.headers })).ok()).toBe(true);
    for (const follow of addedFollows) expect((await request.delete(`${api}/rest/v1/community_follows?${follow.query}`, { headers: follow.headers })).ok()).toBe(true);
  }
});

// PROD-164: document library → named application usage with recovery and refresh.
test("document usage opens named applications, preserves tailoring and refreshes unlink (PROD-164)", { tag: "@phone" }, async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const api = assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").origin;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = await request.post(`${api}/auth/v1/token?grant_type=password`, { headers: { apikey: key }, data: { email: STUDENT_EMAIL, password: process.env.E2E_TEST_PASSWORD } });
  expect(auth.ok()).toBe(true);
  const session = await auth.json() as { access_token: string; user: { id: string } };
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}`, Prefer: "return=representation" };
  const read = async (table: string, query: string) => {
    const response = await request.get(`${api}/rest/v1/${table}?${query}`, { headers });
    expect(response.ok()).toBe(true); return response.json();
  };
  const create = async (table: string, data: unknown) => {
    const response = await request.post(`${api}/rest/v1/${table}`, { headers, data });
    expect(response.ok()).toBe(true); return (await response.json())[0];
  };
  const own = `user_id=eq.${session.user.id}`;
  const createdApps: string[] = [], links: string[] = [], apps: string[] = [];
  const fileName = marker(`Usage-${testInfo.project.name}.pdf`);
  let documentId: string | undefined;
  const usageRoute = /\/rest\/v1\/application_evidence_links\?.*select=document_id/;
  try {
    for (const school of [900001, 900153]) {
      const existing = (await read("user_school_applications", `${own}&school_id=eq.${school}`))[0];
      if (existing) apps.push(existing.id);
      else { const app = await create("user_school_applications", { user_id: session.user.id, school_id: school, status: "researching" }); apps.push(app.id); createdApps.push(app.id); }
    }
    documentId = (await create("documents", { user_id: session.user.id, category: "other", file_name: fileName, storage_path: `${session.user.id}/${crypto.randomUUID()}.pdf`, status: "pending" })).id;
    for (const [index, applicationId] of apps.entries()) {
      const link = await create("application_evidence_links", { user_id: session.user.id, application_id: applicationId, kind: "document", document_id: documentId });
      links.push(link.id);
      if (index) {
        // Tailoring is update-only by design; match the application's real write path.
        expect((await request.patch(`${api}/rest/v1/application_evidence_links?${own}&id=eq.${link.id}`, { headers,
          data: { tailored_title: "Specific application portfolio", tailored_at: new Date().toISOString() } })).ok()).toBe(true);
      }
    }
    await signInToIsolatedStudent(page); await page.goto("/documents");
    const opener = page.getByRole("button", { name: `View application links for ${fileName}`, exact: true });
    await expect(opener).toHaveText("Used in 2 applications");
    await expect(opener).toHaveAccessibleDescription("Used in 2 applications");
    await opener.focus(); await opener.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Applications using this document", exact: true });
    await expect(dialog.getByRole("link", { name: "E2E Test University", exact: true })).toHaveAttribute("href", `/applications/${apps[0]}`);
    await expect(dialog.getByRole("link", { name: "E2E Library University", exact: true })).toHaveAttribute("href", `/applications/${apps[1]}`);
    await expect(dialog.getByText("Uses library details", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Tailored for this application", { exact: true })).toBeVisible();
    const box = await dialog.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await testInfo.attach("document-application-usage", { body: await page.screenshot(), contentType: "image/png" });
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
    await opener.click(); await dialog.getByRole("link", { name: "E2E Library University", exact: true }).click();
    await page.waitForURL(`**/applications/${apps[1]}`);
    await expect(page.getByText("Specific application portfolio", { exact: true })).toBeVisible();
    await page.goto("/documents"); await expect(opener).toHaveText("Used in 2 applications"); await opener.click();
    expect((await request.delete(`${api}/rest/v1/application_evidence_links?${own}&id=eq.${links[1]}`, { headers })).ok()).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(dialog.getByRole("link")).toHaveCount(1);
    await page.route(usageRoute, route => route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"simulated usage outage"}' }));
    const refreshAction = dialog.getByRole("button", { name: "Refresh application links", exact: true });
    await refreshAction.focus(); await refreshAction.press("Enter");
    await expect(dialog.getByRole("alert")).toContainText("Showing the last loaded links");
    await expect(dialog.getByRole("button", { name: "Retry application links", exact: true })).toBeFocused();
    await expect(dialog.getByRole("link")).toHaveCount(1);
    await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
    await expect(opener).toHaveText("Used in 1 application (last loaded; refresh failed)");
    await expect(opener).toHaveAccessibleDescription("Used in 1 application (last loaded; refresh failed)");
    await opener.press("Enter");
    await dialog.getByRole("button", { name: "Retry application links", exact: true }).focus();
    await page.unroute(usageRoute);
    await dialog.getByRole("button", { name: "Retry application links", exact: true }).press("Enter");
    await expect(dialog.getByRole("alert")).toHaveCount(0); await expect(dialog.getByRole("link")).toHaveCount(1);
    await expect(refreshAction).toBeFocused();
    await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
    await expect(opener).toHaveText("Used in 1 application");
    await expect(opener).toHaveAccessibleDescription("Used in 1 application");
    expect((await read("documents", `${own}&id=eq.${documentId}`))).toHaveLength(1);
  } finally {
    await page.unroute(usageRoute);
    for (const id of links) expect.soft((await request.delete(`${api}/rest/v1/application_evidence_links?${own}&id=eq.${id}`, { headers })).ok()).toBe(true);
    if (documentId) expect.soft((await request.delete(`${api}/rest/v1/documents?${own}&id=eq.${documentId}`, { headers })).ok()).toBe(true);
    for (const id of createdApps) expect.soft((await request.delete(`${api}/rest/v1/user_school_applications?${own}&id=eq.${id}`, { headers })).ok()).toBe(true);
  }
});

// PROD-169: personal course follow-up from the hub to Today; no provider/status writes.
test("course follow-up survives a failed save and appears on Today without changing application progress (PROD-169)", { tag: "@phone" }, async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const api = assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL").origin;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = await request.post(`${api}/auth/v1/token?grant_type=password`, { headers: { apikey: key }, data: { email: STUDENT_EMAIL, password: process.env.E2E_TEST_PASSWORD } });
  expect(auth.ok()).toBe(true);
  const session = await auth.json() as { access_token: string; user: { id: string } };
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}`, Prefer: "return=representation" };
  const own = `user_id=eq.${session.user.id}`;
  const read = async (table: string, query: string) => {
    const response = await request.get(`${api}/rest/v1/${table}?${query}`, { headers });
    expect(response.ok()).toBe(true); return response.json();
  };
  const insert = async (table: string, data: unknown) => {
    const response = await request.post(`${api}/rest/v1/${table}`, { headers, data });
    expect(response.ok()).toBe(true); return (await response.json())[0];
  };
  let app = (await read('user_school_applications', `${own}&school_id=eq.${SCHOOL_ID}`))[0];
  const createdApp = !app;
  const createdBookmark = !(await read('user_course_bookmarks', `${own}&course_id=eq.${E2E_COURSE.id}`)).length;
  const taskText = marker(`Check maths pathway ${testInfo.project.name}`);
  const taskFilter = `${own}&text=eq.${encodeURIComponent(taskText)}`;
  const todoRoute = '**/rest/v1/user_todos*';
  try {
    if (!app) app = await insert('user_school_applications', {user_id:session.user.id,school_id:SCHOOL_ID,status:'researching'});
    if (createdBookmark) await insert('user_course_bookmarks', {user_id:session.user.id,course_id:E2E_COURSE.id});
    await signInToIsolatedStudent(page);
    await page.goto(`/applications/${app.id}`);
    const card = page.getByRole('region',{name:'Courses you saved at E2E Test University',exact:true});
    await expect(card.getByText('Recorded prerequisites',{exact:true})).toBeVisible();
    await expect(card.getByText('Assumed knowledge',{exact:true})).toBeVisible();
    await expect(card.getByText('Preparation guidance, not automatically an entry requirement.',{exact:true})).toBeVisible();
    const prepBefore = await page.locator('[data-prep-checklist]').innerText();
    const opener = card.getByRole('button',{name:`Plan a follow-up for ${E2E_COURSE.name}`,exact:true});
    await opener.focus(); await opener.press('Enter');
    const dialog = page.getByRole('dialog',{name:'Plan a course follow-up'});
    await expect(dialog.getByLabel('Your next step')).toHaveValue(`Confirm entry requirements for ${E2E_COURSE.name} at E2E Test University`);
    await dialog.getByLabel('Your next step').fill(taskText);
    await dialog.getByLabel('Due date (optional)').fill('2026-11-15');
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await testInfo.attach('course-follow-up', {body:await page.screenshot(),contentType:'image/png'});
    await page.route(todoRoute, route => route.request().method() === 'POST' ? route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'temporary test outage'})}) : route.continue());
    await dialog.getByRole('button',{name:'Save to Today',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('Could not confirm');
    await expect(dialog.getByLabel('Your next step')).toHaveValue(taskText);
    await expect(dialog.getByLabel('Due date (optional)')).toHaveValue('2026-11-15');
    expect(await read('user_todos',taskFilter)).toHaveLength(0);
    await page.unroute(todoRoute);
    await dialog.getByRole('button',{name:'Save to Today',exact:true}).click();
    await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
    const todos = await read('user_todos',taskFilter);
    expect(todos).toHaveLength(1);expect(todos[0]).toMatchObject({user_id:session.user.id,done:false,due_date:'2026-11-15',priority:2});
    expect(await page.locator('[data-prep-checklist]').innerText()).toBe(prepBefore);
    expect((await read('user_school_applications',`${own}&id=eq.${app.id}`))[0].status).toBe(app.status);
    await card.getByRole('link',{name:'View on Today',exact:true}).click();
    await expect(page).toHaveURL(/\/today\?view=todos/);
    const savedTask = page.getByRole('region',{name:'Your to-dos',exact:true}).getByText(taskText,{exact:true});
    await expect(savedTask).toBeVisible();
    await page.reload();await expect(savedTask).toBeVisible();
  } finally {
    await page.unroute(todoRoute);
    expect((await request.delete(`${api}/rest/v1/user_todos?${taskFilter}`,{headers})).ok()).toBe(true);
    if (createdBookmark) expect((await request.delete(`${api}/rest/v1/user_course_bookmarks?${own}&course_id=eq.${E2E_COURSE.id}`,{headers})).ok()).toBe(true);
    if (createdApp && app) expect((await request.delete(`${api}/rest/v1/user_school_applications?${own}&id=eq.${app.id}`,{headers})).ok()).toBe(true);
  }
});

// PROD-170: compare-and-update, recovery and owner isolation for task edits.
test("Today task editing preserves other fields and recovers from conflicts and outages (PROD-170)", {tag:'@phone'}, async({page,request,browserName},testInfo)=>{
 test.setTimeout(120_000);
 const api=assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,'NEXT_PUBLIC_SUPABASE_URL').origin;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const login=async(email:string)=>{
  const res=await request.post(`${api}/auth/v1/token?grant_type=password`,{headers:{apikey:key},data:{email,password:process.env.E2E_TEST_PASSWORD}});
  expect(res.ok()).toBe(true);return res.json();
 };
 const session=await login(STUDENT_EMAIL);
 const headers={apikey:key,Authorization:`Bearer ${session.access_token}`,Prefer:'return=representation'};
 const initial='学'.repeat(995)+'\n",()';
 const taskMarker=marker(`Edited task ${testInfo.project.name}`);
 const changed=`${taskMarker} other tab`, finalText=`${taskMarker} corrected`;
 const created=await request.post(`${api}/rest/v1/user_todos`,{headers,data:{user_id:session.user.id,text:initial,due_date:'2026-11-01',priority:1,done:false}});
 expect(created.ok()).toBe(true);const task=(await created.json())[0];
 const url=`${api}/rest/v1/user_todos?user_id=eq.${session.user.id}&id=eq.${task.id}`;
 const todoRoute='**/rest/v1/rpc/edit_personal_task';
 try{
  await signInToIsolatedStudent(page);await page.goto('/today?view=todos');
  const opener=page.getByRole('button',{name:`Edit task: ${initial}`,exact:true});
  await expect(opener).toBeVisible();await opener.click();
  const dialog=page.getByRole('dialog',{name:'Edit personal task'});
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveValue(initial);
  await dialog.getByLabel('Task',{exact:true}).fill('   ');
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveAttribute('aria-invalid','true');
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveAccessibleDescription(/1,000/);
  await expect(dialog.getByLabel('Task',{exact:true})).toBeFocused();
  await dialog.getByLabel('Task',{exact:true}).fill(initial);
  await expect(dialog.getByLabel('Task',{exact:true})).not.toHaveAttribute('aria-invalid','true');
  // Exercise a successful 1000-character multilingual compare in the POST body.
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect((await(await request.get(url,{headers})).json())[0].text).toBe(initial);
  await opener.click();
  // Desktop segmented inputs permit partial typing; phone date pickers do not.
  if(browserName==='chromium' && !testInfo.project.use.isMobile){
   const dateInput=dialog.getByLabel('Due date (optional)');
   await dateInput.focus();await dateInput.press('ArrowLeft');await dateInput.press('ArrowLeft');await dateInput.press('Backspace');
   expect(await dateInput.evaluate((node:HTMLInputElement)=>node.validity.badInput)).toBe(true);
   await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
   await expect(dialog.getByRole('alert')).toContainText('Complete the due date');
   expect((await(await request.get(url,{headers})).json())[0].due_date).toBe('2026-11-01');
   await dateInput.fill('2026-11-01');
  }
  await dialog.getByLabel('Task',{exact:true}).fill(finalText);
  expect((await request.patch(url,{headers,data:{text:changed}})).ok()).toBe(true);
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('changed or was removed');
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveValue(finalText);
  expect((await(await request.get(url,{headers})).json())[0].text).toBe(changed);
  await dialog.getByRole('button',{name:'Reload saved task',exact:true}).click();
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveValue(changed);
  await dialog.getByLabel('Task',{exact:true}).fill(finalText);
  await dialog.getByLabel('Due date (optional)').fill('2026-11-05');
  const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await testInfo.attach('today-task-editor',{body:await page.screenshot(),contentType:'image/png'});
  await page.route(todoRoute,route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'test outage'})}):route.continue());
  const save=dialog.getByRole('button',{name:'Save changes',exact:true});
  await save.click();await expect(dialog.getByRole('alert')).toContainText('Could not confirm');await expect(save).toBeFocused();
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveValue(finalText);
  await page.unroute(todoRoute);await save.click();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:`Edit task: ${finalText}`,exact:true})).toBeFocused();
  const stored=(await(await request.get(url,{headers})).json())[0];
  expect(stored).toMatchObject({text:finalText,due_date:'2026-11-05',done:false,priority:1});
  await page.reload();await expect(page.getByText(finalText,{exact:true})).toBeVisible();
  const peer=await login('e2e.peer@caat.local.test');
  const peerHeaders={apikey:key,Authorization:`Bearer ${peer.access_token}`,Prefer:'return=representation'};
  const peerRead=await request.get(`${api}/rest/v1/user_todos?id=eq.${task.id}`,{headers:peerHeaders});
  expect(peerRead.ok()).toBe(true);expect(await peerRead.json()).toEqual([]);
  const peerWrite=await request.patch(`${api}/rest/v1/user_todos?id=eq.${task.id}`,{headers:peerHeaders,data:{text:'Should not write'}});
  expect(peerWrite.ok()).toBe(true);expect(await peerWrite.json()).toEqual([]);
  const peerRpc=await request.post(`${api}/rest/v1/rpc/edit_personal_task`,{headers:peerHeaders,data:{p_id:task.id,p_original_text:finalText,p_original_due_date:'2026-11-05',p_text:'Should not write',p_due_date:null}});
  expect(peerRpc.ok()).toBe(true);expect(await peerRpc.json()).toEqual([]);
  expect((await(await request.get(url,{headers})).json())[0].text).toBe(finalText);
  await page.getByRole('button',{name:`Edit task: ${finalText}`,exact:true}).click();
  await dialog.getByLabel('Task',{exact:true}).fill('Copy this missing-task draft');
  expect((await request.delete(url,{headers})).ok()).toBe(true);
  await dialog.getByRole('button',{name:'Reload saved task',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('no longer available');
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveValue('Copy this missing-task draft');
  await expect(dialog.getByLabel('Task',{exact:true})).toBeEnabled();
  await expect(dialog.getByLabel('Task',{exact:true})).toHaveAttribute('readonly','');
  await expect(dialog.getByRole('button',{name:'Save changes',exact:true})).toHaveAttribute('aria-disabled','true');
  await testInfo.attach('today-missing-task-recovery',{body:await page.screenshot(),contentType:'image/png'});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:`Edit task: ${finalText}`,exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Your to-dos',exact:true})).toBeFocused();
  await expect(page.getByRole('status').filter({hasText:'Removed the unavailable task'})).toHaveCount(1);
 }finally{
  await page.unroute(todoRoute);
  expect((await request.delete(url,{headers})).ok()).toBe(true);
 }
});

// PROD-175: real persisted preparation and owned work, including unsave and export.
test('course preparation persists, links work without ticking and survives unsaving (PROD-175)', {tag:'@phone'}, async({page,request},testInfo)=>{
 test.setTimeout(120_000);page.setDefaultTimeout(15_000);
 const prepSchool=900175,prepCourse={id:"e2e-preparation-course",name:"E2E Preparation Course"};
 const api=assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,'NEXT_PUBLIC_SUPABASE_URL').origin,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const auth=await request.post(`${api}/auth/v1/token?grant_type=password`,{headers:{apikey:key},data:{email:STUDENT_EMAIL,password:process.env.E2E_TEST_PASSWORD}});expect(auth.ok()).toBe(true);
 const session=await auth.json(),own=`user_id=eq.${session.user.id}`,headers={apikey:key,Authorization:`Bearer ${session.access_token}`,Prefer:'return=representation'};
 const read=async(table:string,query:string)=>{const r=await request.get(`${api}/rest/v1/${table}?${query}`,{headers});expect(r.ok()).toBe(true);return r.json();};
 const add=async(table:string,data:unknown)=>{const r=await request.post(`${api}/rest/v1/${table}`,{headers,data});expect(r.ok()).toBe(true);return(await r.json())[0];};
 let app=(await read('user_school_applications',`${own}&school_id=eq.${prepSchool}`))[0];const created=!app;
 const hadBookmark=(await read('user_course_bookmarks',`${own}&course_id=eq.${prepCourse.id}`)).length>0;
 const title=marker(`Course preparation draft ${testInfo.project.name}`);let draft: {id:string}|undefined;
 try{
  if(!app)app=await add('user_school_applications',{user_id:session.user.id,school_id:prepSchool,status:'researching'});
  if(!hadBookmark)await add('user_course_bookmarks',{user_id:session.user.id,course_id:prepCourse.id});
  draft=await add('essay_drafts',{user_id:session.user.id,prompt_id:crypto.randomUUID(),prompt_slug:'course-preparation',label:title,content:'My maths preparation example'});
  await signInToIsolatedStudent(page);await page.goto(`/applications/${app.id}`);
  const card=page.getByRole('region',{name:'Course preparation',exact:true});
  const row=card.getByRole('group',{name:`${prepCourse.name} · E2E175: Review prerequisites`,exact:true});
  await row.getByRole('button',{name:'Start check',exact:true}).click();
  await expect(row.getByText('In progress',{exact:true})).toBeVisible();
  await expect(row.getByRole('button',{name:'Mark reviewed',exact:true})).toBeFocused();
  await expect(card.locator('[aria-live="polite"]')).toContainText('In progress');
  const opener=row.getByRole('button',{name:'Supporting work',exact:true});await opener.focus();await opener.press('Enter');
  const dialog=page.getByRole('dialog',{name:'Course supporting work',exact:true});
  await dialog.getByLabel('Find supporting work').fill(title);
  await dialog.getByRole('radio',{name:new RegExp(title)}).check();await dialog.getByRole('button',{name:'Link selected work',exact:true}).click();
  await expect(dialog.getByText('My maths preparation example',{exact:true})).toBeVisible();
  const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await dialog.getByRole('button',{name:'Close dialog'}).click();await expect(opener).toBeFocused();
  await expect(row.getByText('In progress',{exact:true})).toBeVisible();
  await row.getByRole('button',{name:'Mark reviewed',exact:true}).focus();await row.getByRole('button',{name:'Mark reviewed',exact:true}).press('Enter');await expect(row.getByText('Reviewed',{exact:true})).toBeVisible();
  await expect(row.getByRole('button',{name:'Reopen check',exact:true})).toBeFocused();await expect(card.locator('[aria-live="polite"]')).toContainText('Reviewed');
  await page.reload();await expect(row.getByText('Reviewed',{exact:true})).toBeVisible();
  await row.getByRole('button',{name:'Reopen check',exact:true}).click();await expect(row.getByText('In progress',{exact:true})).toBeVisible();
  await expect(row.getByRole('button',{name:'Mark reviewed',exact:true})).toBeFocused();
  // PROD-184: rejected writes retain row focus and never announce success.
  const saveRoute='**/rest/v1/rpc/save_course_preparation';
  await page.route(saveRoute,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic failure'})}),{times:1});
  await row.getByRole('button',{name:'Mark reviewed',exact:true}).click();await expect(card.getByRole('alert')).toContainText('Could not save');await expect(row).toBeFocused();await expect(card.locator('[aria-live="polite"]')).toBeEmpty();
  await card.getByRole('button',{name:'Refresh preparation',exact:true}).click();await expect(card.getByRole('alert')).toHaveCount(0);
  // Stage a stale read to exercise acknowledgement focus; the write remains a
  // real RPC. Source/revision conflict enforcement is covered by real DB tests.
  await page.route('**/rest/v1/course_preparation_checks?**',async route=>{const response=await route.fetch();const checks=await response.json();await route.fulfill({response,json:checks.map((c:{course_id:string;item_key:string;snapshot:Record<string,unknown>})=>c.course_id===prepCourse.id&&c.item_key==='prerequisites'?{...c,snapshot:{...c.snapshot,text:'Earlier recorded prerequisite'}}:c)});},{times:1});
  await card.getByRole('button',{name:'Refresh preparation',exact:true}).click();await expect(row.getByText('Needs review',{exact:true})).toBeVisible();
  await row.getByRole('button',{name:'Use current information',exact:true}).focus();await row.getByRole('button',{name:'Use current information',exact:true}).press('Enter');
  await expect(row.getByRole('button',{name:'Mark reviewed',exact:true})).toBeFocused();await expect(card.locator('[aria-live="polite"]')).toContainText('In progress');

  expect((await request.delete(`${api}/rest/v1/user_course_bookmarks?${own}&course_id=eq.${prepCourse.id}`,{headers})).ok()).toBe(true);
  await page.reload();await expect(card.getByText('No longer saved',{exact:true})).toBeVisible();await expect(row.getByText('In progress',{exact:true})).toBeVisible();
  await row.getByRole('button',{name:'Supporting work',exact:true}).click();await expect(dialog.getByText(title,{exact:true})).toBeVisible();await dialog.getByRole('button',{name:'Close dialog'}).click();
  const exportResponse=await page.request.get('/settings/export');expect(exportResponse.ok()).toBe(true);const exported=await exportResponse.json();
  expect(exported.data.course_preparation_checks.some((c:{course_id:string})=>c.course_id===prepCourse.id)).toBe(true);
  expect(exported.data.course_preparation_work.some((w:{essay_draft_id:string})=>w.essay_draft_id===draft!.id)).toBe(true);
  await testInfo.attach('course-preparation',{body:await page.screenshot(),contentType:'image/png'});
 }finally{
  if(draft)expect.soft((await request.delete(`${api}/rest/v1/essay_drafts?${own}&id=eq.${draft.id}`,{headers})).ok()).toBe(true);
  if(created&&app)expect.soft((await request.delete(`${api}/rest/v1/user_school_applications?${own}&id=eq.${app.id}`,{headers})).ok()).toBe(true);
  if(hadBookmark&&!(await read('user_course_bookmarks',`${own}&course_id=eq.${prepCourse.id}`)).length)await add('user_course_bookmarks',{user_id:session.user.id,course_id:prepCourse.id});
  if(!hadBookmark)await request.delete(`${api}/rest/v1/user_course_bookmarks?${own}&course_id=eq.${prepCourse.id}`,{headers});
 }
});

// PROD-80: selected-only snapshots, anonymous capabilities, replacement and revocation.
test('shortlist sharing previews selected items and revokes anonymous access (PROD-80)', {tag:'@phone'}, async({page,request,browser},testInfo)=>{
 test.setTimeout(120_000);page.setDefaultTimeout(15_000);
 const api=assertLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL,'NEXT_PUBLIC_SUPABASE_URL').origin,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const auth=await request.post(`${api}/auth/v1/token?grant_type=password`,{headers:{apikey:key},data:{email:STUDENT_EMAIL,password:process.env.E2E_TEST_PASSWORD}});expect(auth.ok()).toBe(true);
 const session=await auth.json(),headers={apikey:key,Authorization:`Bearer ${session.access_token}`,Prefer:'return=representation'},own=`user_id=eq.${session.user.id}`;
 const bookmarkUrl=`${api}/rest/v1/user_bookmarked_schools?${own}&school_id=eq.${SCHOOL_ID}`;
 const existing=await(await request.get(bookmarkUrl,{headers})).json();
 const before=await(await request.get(`${api}/rest/v1/shortlist_shares?${own}&select=id`,{headers})).json();
 const existingIds=new Set(before.map((row:{id:string})=>row.id));
 const guest=await browser.newContext({viewport:page.viewportSize(),isMobile:!!testInfo.project.use.isMobile,hasTouch:!!testInfo.project.use.hasTouch});
 try{
  if(!existing.length)expect((await request.post(`${api}/rest/v1/user_bookmarked_schools`,{headers,data:{user_id:session.user.id,school_id:SCHOOL_ID}})).ok()).toBe(true);
  await signInToIsolatedStudent(page);await page.goto('/shortlist');await page.getByRole('link',{name:'Share selected items',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Share a little perspective'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Preview selected items'})).toBeDisabled();
  const school=await(await request.get(`${api}/rest/v1/schools?id=eq.${SCHOOL_ID}&select=name`,{headers})).json();const title=school[0].name;
  await page.getByRole('checkbox',{name:new RegExp('^'+title+' University')}).check();await page.getByRole('button',{name:'Preview selected items',exact:true}).click();
  const preview=page.locator('[data-share-preview]');await expect(preview.getByRole('heading',{name:title,exact:true})).toBeVisible();expect(await preview.locator('li').count()).toBe(1);
  const previewText=await preview.innerText();await page.getByRole('button',{name:'Create shared link',exact:true}).click();
  const link=page.getByLabel('Shared link',{exact:true});await expect(link).toHaveValue(/\/share\/shortlist#[a-f0-9]{64}$/);const first=await link.inputValue();const token=new URL(first).hash.slice(1);
  const publicPage=await guest.newPage();const reply=await publicPage.goto(first);expect(reply?.status()).toBe(200);expect(reply?.headers()['referrer-policy']).toBe('no-referrer');expect(reply?.headers()['x-robots-tag']).toContain('noindex');
  await expect(publicPage.getByRole('heading',{name:title,exact:true})).toBeVisible();expect((await publicPage.locator('[data-share-preview]').innerText()).trim()).toBe(previewText.trim());
  expect(await publicPage.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('auth-token')))).toEqual([]);
  const exportResponse=await page.request.get('/settings/export');expect(exportResponse.ok()).toBe(true);const exported=await exportResponse.json();expect(exported.data.shortlist_shares.length).toBeGreaterThan(0);expect(JSON.stringify(exported)).not.toContain(token);
  await testInfo.attach('shortlist-sharing-owner',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
  await testInfo.attach('shortlist-sharing-recipient',{body:await publicPage.screenshot({fullPage:true}),contentType:'image/png'});
  const row=page.getByRole('listitem').filter({has:page.getByRole('button',{name:'Revoke link',exact:true})}).filter({hasText:title}).first();
  await row.getByRole('button',{name:'Replace link',exact:true}).click();await row.getByRole('button',{name:'Confirm replacement',exact:true}).click();await expect(link).not.toHaveValue(first);const second=await link.inputValue();
  await publicPage.getByRole('button',{name:'Refresh link'}).click();await expect(publicPage.getByRole('heading',{name:'Link unavailable'})).toBeVisible();await expect(publicPage.locator('[data-share-preview]')).toHaveCount(0);
  await publicPage.goto(second);await expect(publicPage.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await row.getByRole('button',{name:'Revoke link',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Link revoked.'})).toBeVisible();
  await publicPage.getByRole('button',{name:'Refresh link'}).click();await expect(publicPage.getByRole('heading',{name:'Link unavailable'})).toBeVisible();await expect(publicPage.locator('[data-share-preview]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{
  await guest.close();const rows=await(await request.get(`${api}/rest/v1/shortlist_shares?${own}&select=id`,{headers})).json();for(const row of rows)if(!existingIds.has(row.id))expect.soft((await request.delete(`${api}/rest/v1/shortlist_shares?${own}&id=eq.${row.id}`,{headers})).ok()).toBe(true);
  if(!existing.length)expect.soft((await request.delete(bookmarkUrl,{headers})).ok()).toBe(true);
 }
});

test('@phone shared community resume requires consent, preserves its copy and revokes for peers', async ({page,browser,request},testInfo)=>{
 test.setTimeout(120000);
 const api=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 const auth=await request.post(`${api}/auth/v1/token?grant_type=password`,{headers:{apikey:key},data:{email:STUDENT_EMAIL,password:process.env.E2E_TEST_PASSWORD}});expect(auth.ok()).toBe(true);
 const session=await auth.json(),headers={apikey:key,Authorization:`Bearer ${session.access_token}`,Prefer:'return=representation'};
 const resumeId=crypto.randomUUID(),content=marker(`ResumeShare-${testInfo.project.name}`),title=`Resume ${resumeId.slice(0,8)}`;
 const peerContext=await browser.newContext({viewport:page.viewportSize(),isMobile:!!testInfo.project.use.isMobile,hasTouch:!!testInfo.project.use.hasTouch});
 let postId:string|undefined;
 try{
  expect((await request.post(`${api}/rest/v1/resumes`,{headers,data:{id:resumeId,user_id:session.user.id,title}})).ok()).toBe(true);
  const sections=[{resume_id:resumeId,section_key:'personal',label:'Personal details',mode:'free',sort_order:0,content_html:'<p>Synthetic Student</p>'},
   {resume_id:resumeId,section_key:'education',label:'Education',mode:'guided',sort_order:1,content_html:'<p>PRIVATE INACTIVE DRAFT</p>',structured_data:{entries:[{institution:'Synthetic University',degree:'BSc',startDate:'2024',current:true,description:'<p>Published study</p><img src=x onerror="document.documentElement.dataset.resumeXss=1">'}]}},
   {resume_id:resumeId,section_key:'custom',label:'Projects',mode:'free',sort_order:2,content_html:Array.from({length:24},(_,i)=>`<p>Project example ${i+1}: a completed synthetic learning project.</p>`).join('')+'<p>FINAL RESUME SECTION</p>'}];
  const seeded=await request.post(`${api}/rest/v1/resume_sections`,{headers,data:sections.map(s=>({structured_data:null,...s}))});expect(seeded.ok(),await seeded.text()).toBe(true);
  await signInToIsolatedStudent(page);await expect(page.getByText('Your next step',{exact:true})).toBeVisible();await page.goto('/communities');
  await page.locator('div.cursor-text:visible').filter({hasText:'Share your experience, results, or advice'}).first().click();
  await page.locator('.ProseMirror').first().fill(content);await page.getByText('Select a topic').click();await page.getByRole('option',{name:'Advice',exact:true}).click();
  await page.getByRole('button',{name:'Resume',exact:true}).click();await page.getByText('Select a resume',{exact:true}).click();await page.getByRole('option',{name:title,exact:true}).click();
  await expect(page.getByRole('button',{name:'Post',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Preview shared copy'}).click();
  const preview=page.getByRole('article',{name:'Shared resume content'});await expect(preview).toContainText('Synthetic University');await expect(preview).not.toContainText('PRIVATE INACTIVE DRAFT');
  await expect(preview.locator('img,script,[onerror]')).toHaveCount(0);await expect(preview).toContainText('FINAL RESUME SECTION');
  await page.getByRole('checkbox',{name:/I reviewed this copy/}).check();await page.getByRole('button',{name:'Post',exact:true}).click();
  const card=page.locator('[data-slot="card"]').filter({hasText:content}).first();await expect(card.getByRole('button',{name:'Read shared resume'})).toBeVisible({timeout:15000});
  const posts=await(await request.get(`${api}/rest/v1/community_posts?resume_link=eq.${resumeId}&user_id=eq.${session.user.id}&select=id`,{headers})).json();expect(posts.length).toBe(1);postId=posts[0].id;
  expect((await request.patch(`${api}/rest/v1/resume_sections?resume_id=eq.${resumeId}&section_key=eq.education`,{headers,data:{structured_data:{entries:[{institution:'PRIVATE LATER EDIT',degree:'BSc'}]}}})).ok()).toBe(true);
  const peer=await peerContext.newPage();await peer.goto(`${process.env.PLAYWRIGHT_BASE_URL}/login`);await peer.getByLabel('Email',{exact:true}).fill('e2e.peer@caat.local.test');await peer.getByLabel('Password',{exact:true}).fill(process.env.E2E_TEST_PASSWORD!);await peer.getByRole('button',{name:/sign in/i}).click();await peer.waitForURL(/\/today(?:$|\?)/,{timeout:20000});await expect(peer.getByText('Your next step',{exact:true})).toBeVisible();
  await peer.goto(`${process.env.PLAYWRIGHT_BASE_URL}/communities/${postId}`);await peer.getByRole('button',{name:'Read shared resume'}).click();
  const read=peer.getByRole('article',{name:'Shared resume content'});await expect(read).toContainText('Synthetic University');await expect(read).not.toContainText('PRIVATE LATER EDIT');await expect(read).not.toContainText('PRIVATE INACTIVE DRAFT');await read.getByText('FINAL RESUME SECTION',{exact:true}).scrollIntoViewIfNeeded();await expect(read.getByText('FINAL RESUME SECTION',{exact:true})).toBeVisible();
  expect(await peer.evaluate(()=>document.documentElement.dataset.resumeXss)).toBeUndefined();
  await testInfo.attach('shared-resume-reader',{body:await peer.screenshot({fullPage:true}),contentType:'image/png'});
  await peer.getByRole('button',{name:'Close',exact:true}).click();
  await page.goto('/communities/shared-resumes');await expect(page.getByRole('heading',{name:'Your shared resumes',exact:true})).toBeVisible();const managed=page.getByRole('listitem').filter({hasText:title});await managed.getByRole('button',{name:'Remove shared copy'}).click();await managed.getByRole('button',{name:'Confirm removal'}).click();await expect(page.getByText('Shared copy removed.',{exact:true})).toBeVisible();
  await peer.reload();await expect(peer.getByText(/This shared resume is unavailable/)).toBeVisible();await expect(peer.getByRole('button',{name:'Read shared resume'})).toHaveCount(0);
  const drafts=await(await request.get(`${api}/rest/v1/resumes?id=eq.${resumeId}&select=id`,{headers})).json();expect(drafts.length).toBe(1);
 }finally{
  await peerContext.close();await request.delete(`${api}/rest/v1/community_posts?resume_link=eq.${resumeId}&user_id=eq.${session.user.id}`,{headers});await request.delete(`${api}/rest/v1/resumes?id=eq.${resumeId}&user_id=eq.${session.user.id}`,{headers});
 }
});

test('@phone former group member removes own content without seeing peer content',async({page,request},testInfo)=>{
 test.setTimeout(120000);
 const api=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
 async function auth(email:string){const result=await request.post(`${api}/auth/v1/token?grant_type=password`,{headers:{apikey:key},data:{email,password:process.env.E2E_TEST_PASSWORD}});expect(result.ok()).toBe(true);const data=await result.json();return {id:data.user.id,headers:{apikey:key,Authorization:`Bearer ${data.access_token}`,Prefer:'return=representation'}};}
 const student=await auth(STUDENT_EMAIL),peer=await auth('e2e.peer@caat.local.test');
 const group=crypto.randomUUID(),post=crypto.randomUUID(),comment=crypto.randomUUID(),reply=crypto.randomUUID(),text=marker(`OwnRemoval-${testInfo.project.name}`);
 async function write(path:string,data:unknown,headers:typeof student.headers){const result=await request.post(`${api}/rest/v1/${path}`,{headers,data});expect(result.ok(),await result.text()).toBe(true);}
 try{
  await write('community_groups',{id:group,creator_id:peer.id,is_private:true,name:'Synthetic private group',slug:`remove-${group.slice(0,12)}`},peer.headers);
  await write('community_group_requests',{group_id:group,user_id:student.id,status:'pending'},student.headers);
  await write('rpc/approve_group_join_request',{p_group_id:group,p_requester_user_id:student.id},peer.headers);
  await write('community_posts',{id:post,user_id:student.id,group_id:group,topic_tag:'ADVICE',content:text},student.headers);
  await write('community_comments',{id:comment,user_id:student.id,post_id:post,content:`${text} comment`},student.headers);
  await write('community_comments',{id:reply,user_id:peer.id,post_id:post,parent_comment_id:comment,content:'PEER ONLY PRIVATE REPLY'},peer.headers);
  expect((await request.delete(`${api}/rest/v1/community_group_members?group_id=eq.${group}&user_id=eq.${student.id}`,{headers:student.headers})).ok()).toBe(true);
  await signInToIsolatedStudent(page);await expect(page.getByText('Your next step',{exact:true})).toBeVisible();await page.goto('/communities/your-content');
  await expect(page.getByRole('heading',{name:'Your community content',exact:true})).toBeVisible();await expect(page.getByText('PEER ONLY PRIVATE REPLY',{exact:true})).toHaveCount(0);
  const postRow=page.getByRole('listitem').filter({has:page.getByText(text,{exact:true})});
  await postRow.getByRole('button',{name:'Remove post',exact:true}).click();await expect(postRow.getByText(text,{exact:true})).toBeVisible();await postRow.getByRole('button',{name:'Confirm removal'}).click();await expect(page.getByText(text,{exact:true})).toHaveCount(0);
  const commentRow=page.getByRole('listitem').filter({has:page.getByText(`${text} comment`,{exact:true})});await commentRow.getByRole('button',{name:'Remove comment'}).click();await commentRow.getByRole('button',{name:'Confirm removal'}).click();await expect(page.getByText(`${text} comment`,{exact:true})).toHaveCount(0);
  const memberPost=await(await request.get(`${api}/rest/v1/community_posts?id=eq.${post}&select=content,is_removed`,{headers:peer.headers})).json();expect(memberPost).toEqual([{content:'[Removed by author]',is_removed:true}]);
  const replies=await(await request.get(`${api}/rest/v1/community_comments?id=eq.${reply}&select=content`,{headers:peer.headers})).json();expect(replies).toEqual([{content:'PEER ONLY PRIVATE REPLY'}]);
  expect(await(await request.get(`${api}/rest/v1/community_posts?id=eq.${post}&select=id`,{headers:student.headers})).json()).toEqual([]);
  await testInfo.attach('own-content-removed',{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 }finally{
  // Current group owner can delete the disposable group and its content cascade.
  await request.delete(`${api}/rest/v1/community_groups?id=eq.${group}`,{headers:peer.headers});
 }
});
