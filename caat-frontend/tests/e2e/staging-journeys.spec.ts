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
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });
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

test("custom essay draft content autosaves and reloads from the real account", async ({ page }) => {
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
    await removeCustomEssay(page, title).catch(() => {});
  }
});

test("resume section content is saved and restored after reloading the builder", async ({ page }) => {
  await signInToIsolatedStudent(page);
  const content = marker("Persisted resume education");
  await page.goto("/resume-builder");
  const resumeBreadcrumb = page.getByRole("main").getByRole("navigation", { name: "breadcrumb" });
  await expect(resumeBreadcrumb.getByText("Resume Builder", { exact: true })).toBeVisible({ timeout: 15_000 });
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });

  await page.getByRole("button", { name: "Education", exact: true }).first().click();
  const editor = page.locator(".ProseMirror").first();
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
  await page.getByRole("button", { name: "Education", exact: true }).first().click();
  await expect(page.locator(".ProseMirror").first()).toContainText(content, { timeout: 15_000 });
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

test("school notes and application status/checklist persist across list and detail reloads", async ({ page }) => {
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

test("application checklist edits recover from failed writes and persist after reload", async ({ page }) => {
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
