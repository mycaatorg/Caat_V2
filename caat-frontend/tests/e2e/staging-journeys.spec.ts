/**
 * Full-stack journeys for a disposable local Supabase instance only.
 * This spec is intentionally excluded from the default Playwright project.
 */
import { expect, test, type Page } from "@playwright/test";
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

test("seeded major detail bookmark persists after reload and appears in the bookmarked list", async ({ page }) => {
  await signInToIsolatedStudent(page);
  const detailPath = `/majors/${MAJOR_ID}`;
  try {
    await assertIsolatedDetailRoute(page, "/majors/[id]", detailPath);
    const bookmark = page.getByRole("button", { name: "Bookmark major" });
    await expect(bookmark).toBeVisible();
    await bookmark.click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
    await page.goto("/majors?category=Bookmarked");
    await expect(page.getByRole("link", { name: /E2E Test Engineering/ }).first()).toBeVisible({ timeout: 15_000 });
  } finally {
    await page.goto(detailPath).catch(() => {});
    await page.getByRole("button", { name: "Remove bookmark" }).click().catch(() => {});
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

    const applicationHref = await reloadedCard.getByRole("link", { name: /open/i }).getAttribute("href");
    expect(applicationHref).toMatch(/^\/applications\/[0-9a-f-]+$/i);
    await assertIsolatedDetailRoute(page, "/applications/[id]", applicationHref!);
    await expect(page.getByRole("heading", { name: "E2E Test University", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Status", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Applying/ })).toBeVisible();
    await expect(page.getByText("Readiness", { exact: true })).toBeVisible();
    await expect(page.getByText("Deadline is set", { exact: true })).toBeVisible();
    await expect(page.getByText("At least one essay drafted", { exact: true })).toBeVisible();
    await expect(page.getByText("Key documents uploaded", { exact: true })).toBeVisible();
    await expect(page.getByText("Status reached Submitted", { exact: false })).toBeVisible();
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
    await expect(checklist("Deadline is set")).toHaveAttribute("data-state", "todo");
    await expect(checklist("Status reached Submitted")).toHaveAttribute("data-state", "todo");

    // The checklist follows a saved deadline without a reload.
    const deadlineSaved = page.waitForResponse((r) => r.url().includes("/rest/v1/user_school_applications") && r.request().method() === "PATCH" && r.ok());
    await page.locator("#hub-deadline").fill("2027-03-15");
    await deadlineSaved;
    await expect(checklist("Deadline is set")).toHaveAttribute("data-state", "done");

    // A failed status write reverts the status and checklist, then a retry saves.
    let failure = await failNextApplicationWrite(page, '"status":"submitted"');
    await statusButton.click();
    await page.getByRole("menuitem", { name: "Submitted", exact: true }).click();
    await expect.poll(() => failure.failed).toBe(1);
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /went wrong|try again/i }).first()).toBeVisible();
    await expect(statusButton).toHaveText("Researching");
    await expect(statusButton).toBeEnabled();
    await expect(checklist("Status reached Submitted")).toHaveAttribute("data-state", "todo");

    const statusSaved = page.waitForResponse((r) => r.url().includes("/rest/v1/user_school_applications") && r.request().method() === "PATCH" && r.ok());
    await statusButton.click();
    await page.getByRole("menuitem", { name: "Submitted", exact: true }).click();
    await statusSaved;
    await expect(checklist("Status reached Submitted")).toHaveAttribute("data-state", "done");
    await page.unroute(APPLICATION_WRITES);

    await page.reload();
    await expect(statusButton).toHaveText("Submitted", { timeout: 15_000 });
    await expect(page.locator("#hub-deadline")).toHaveValue("2027-03-15");
    await expect(checklist("Deadline is set")).toHaveAttribute("data-state", "done");
    await expect(checklist("Status reached Submitted")).toHaveAttribute("data-state", "done");

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
    const saved = page.waitForResponse((r) => r.url().includes("/rest/v1/user_school_applications") && r.request().method() === "PATCH" && r.ok());
    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await page.locator("#hub-deadline").fill(soon);
    await saved;

    await page.goto("/today");
    await expect(page.getByRole("region", { name: "Coming up" }).getByRole("link", { name: /E2E Test University/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("region", { name: "Needs attention" }).getByText(/Add the deadline for E2E Test University/)).toHaveCount(0);
  } finally {
    if (!page.isClosed()) await removeSeededApplication(page).catch(() => {});
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
type SeededCourse = (typeof COURSES)[keyof typeof COURSES];
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
