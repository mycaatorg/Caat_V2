/**
 * End-to-end Auth lifecycle against disposable local Supabase only.
 * Never bypasses the UI preflight, Turnstile, or Supabase password grant.
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import routeCoverage from "./route-coverage.json";

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const EMAIL = `e2e.signup.${RUN_ID}@caat.local.test`;
const FULL_NAME = `E2E Signup ${RUN_ID}`;

test.setTimeout(90_000);
// The recovery URL contains a one-time token; keep it out of Playwright traces.
test.use({ trace: "off" });

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

async function signOutFromSidebar(page: Page, email: string) {
  const accountMenu = page.getByRole("button").filter({ hasText: email }).last();
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

function safeLocalRecoveryLink(href: string): string {
  const appOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL!).origin;
  const authOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new Error("Recovery email did not contain a valid local link.");
  }

  // The email's verification link is the only URL explicitly visited. Check
  // its exact local Auth origin and route, plus the exact app redirect that
  // Supabase will navigate to after consuming the recovery token.
  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.origin !== authOrigin ||
    url.pathname !== "/auth/v1/verify" ||
    url.username ||
    url.password ||
    url.searchParams.get("type") !== "recovery"
  ) {
    throw new Error("Recovery email link is outside the expected local Auth verification route.");
  }

  const redirect = url.searchParams.get("redirect_to");
  if (!redirect) throw new Error("Recovery email link is missing its local reset-page redirect.");
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(redirect);
  } catch {
    throw new Error("Recovery email link has an invalid reset-page redirect.");
  }
  if (
    redirectUrl.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(redirectUrl.hostname) ||
    redirectUrl.origin !== appOrigin ||
    redirectUrl.pathname !== "/reset-password" ||
    redirectUrl.search ||
    redirectUrl.hash ||
    redirectUrl.username ||
    redirectUrl.password
  ) {
    throw new Error("Recovery email link does not redirect to the expected local reset page.");
  }

  return url.href;
}

async function waitForRecoveryEmail(request: APIRequestContext, email: string): Promise<string> {
  // Supabase CLI 2.90.0 exposes its configured [inbucket] service as Mailpit.
  // Its local API is documented at /api/v1/swagger.json.
  const mailApi = "http://127.0.0.1:55434/api/v1";
  let messageId: string | undefined;
  await expect.poll(async () => {
    const response = await request.get(`${mailApi}/messages?limit=100`);
    if (!response.ok()) return false;
    const payload = await response.json() as {
      messages?: Array<{ ID?: string; To?: Array<{ Address?: string }> }>;
    };
    messageId = payload.messages?.find((message) =>
      message.To?.some((recipient) => recipient.Address?.toLowerCase() === email.toLowerCase())
    )?.ID;
    return Boolean(messageId);
  }, { timeout: 30_000, intervals: [250, 500, 1_000] }).toBeTruthy();

  const response = await request.get(`${mailApi}/message/${encodeURIComponent(messageId!)}`);
  if (!response.ok()) throw new Error("Could not read the local recovery email.");
  const message = await response.json() as { HTML?: string; Text?: string };
  const content = `${message.HTML ?? ""}\n${message.Text ?? ""}`;
  const candidates = [...content.matchAll(/https?:\/\/[^\s"'<>]+/g)]
    .map(([value]) => value.replaceAll("&amp;", "&").replaceAll("&#38;", "&"));
  for (const candidate of candidates) {
    try {
      return safeLocalRecoveryLink(candidate);
    } catch {
      // Emails can contain unrelated links; reject them without logging their
      // contents, then continue until the local recovery link is found.
    }
  }
  throw new Error("Local recovery email did not contain the expected Auth verification link.");
}

async function createAccount(page: Page, email: string, fullName: string, password: string) {
  await page.goto("/signup");
  await page.getByLabel("Full Name", { exact: true }).fill(fullName);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function deleteAccountThroughSettings(page: Page) {
  await page.goto("/settings");
  const accountSection = page.getByRole("region", { name: "Data and account" });
  await accountSection.getByRole("button", { name: "Delete my account", exact: true }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Delete your account?" });
  await confirmDialog.getByPlaceholder("DELETE").fill("DELETE");
  await confirmDialog.getByRole("button", { name: "Delete my account", exact: true }).click();
  await expect(page.getByText("Your account has been deleted.", { exact: true })).toBeVisible({ timeout: 10_000 });
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

  await signOutFromSidebar(page, EMAIL);
  await page.goto("/dashboard");
  await page.waitForURL(/\/login(?:$|\?)/, { timeout: 15_000 });

  await signInWithNewAccount(page);
  await expectSignedInDashboard(page, dashboardRoute.expected!);
  await expect(page.getByText(EMAIL, { exact: true })).toBeVisible();

  // Upload a synthetic document and keep its signed link, so deletion can be
  // proven to remove the stored file and not only the account rows (PROD-96).
  const fileName = `deleted-account-${RUN_ID}.pdf`;
  const pdfBody = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n";
  await page.goto("/documents");
  await page.getByRole("button", { name: "Upload New" }).click();
  await page.locator('input[type="file"]').last().setInputFiles({ name: fileName, mimeType: "application/pdf", buffer: Buffer.from(pdfBody) });
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByText("Document uploaded successfully", { exact: true })).toBeVisible({ timeout: 20_000 });
  const docRow = page.getByText(fileName, { exact: true }).locator("xpath=../../..");
  const signing = page.waitForResponse((r) => r.url().includes("/storage/v1/object/sign/user-documents/") && r.request().method() === "POST");
  const popup = page.waitForEvent("popup");
  await docRow.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "View", exact: true }).click();
  const signed = await signing;
  const { signedURL } = (await signed.json()) as { signedURL: string };
  const signedUrl = `${signed.url().split("/object/sign/")[0]}${signedURL}`;
  await (await popup).close();
  expect((await page.request.get(signedUrl)).status()).toBe(200);

  // Delete only this newly-created synthetic account through the real settings UI.
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: settingsRoute.expected!, exact: true })).toBeVisible({ timeout: 15_000 });
  const accountSection = page.getByRole("region", { name: "Data and account" });
  await accountSection.getByRole("button", { name: "Delete my account", exact: true }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Delete your account?" });
  await confirmDialog.getByPlaceholder("DELETE").fill("DELETE");
  await confirmDialog.getByRole("button", { name: "Delete my account", exact: true }).click();
  await expect(page.getByText("Your account has been deleted.", { exact: true })).toBeVisible({ timeout: 10_000 });
  // The uploaded file went with the account.
  await expect.poll(async () => (await page.request.get(signedUrl)).status()).not.toBe(200);

  await page.goto("/dashboard");
  await page.waitForURL(/\/login(?:$|\?)/, { timeout: 15_000 });
});

test.describe("password recovery", () => {
  test("new account recovers its password from the local email and removes the account", async ({ page, request }) => {
    const email = `e2e.recovery.${RUN_ID}@caat.local.test`;
    const fullName = `E2E Recovery ${RUN_ID}`;
    const oldPassword = process.env.E2E_TEST_PASSWORD!;
    const newPassword = `Caat-Recovered-${RUN_ID}!9`;
    let accountCreated = false;

    try {
      accountCreated = true;
      await createAccount(page, email, fullName, oldPassword);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(fullName);
      await signOutFromSidebar(page, email);

      await page.goto("/forgot-password");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.getByRole("heading", { name: "Check your email", exact: true })).toBeVisible();

      const recoveryLink = await waitForRecoveryEmail(request, email);
      try {
        await page.goto(recoveryLink, { waitUntil: "domcontentloaded" });
      } catch {
        throw new Error("Could not follow the validated local recovery link.");
      }
      await expect.poll(() => new URL(page.url()).pathname === "/reset-password", { timeout: 20_000 }).toBe(true);
      await expect(page.getByRole("heading", { name: "Set new password", exact: true })).toBeVisible({ timeout: 20_000 });
      await page.getByLabel("New Password", { exact: true }).fill(newPassword);
      await page.getByLabel("Confirm Password", { exact: true }).fill(newPassword);
      await page.getByRole("button", { name: "Update password", exact: true }).click();
      await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { level: 1 })).toContainText(fullName);

      await signOutFromSidebar(page, email);
      await signInWithPassword(page, email, oldPassword);
      await expect(page.getByText(/Invalid login credentials/i)).toBeVisible({ timeout: 10_000 });
      await expect(page).toHaveURL(/\/login(?:$|\?)/);

      await signInWithPassword(page, email, newPassword);
      await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 20_000 });
      await expect(page.getByRole("heading", { level: 1 })).toContainText(fullName);
      await deleteAccountThroughSettings(page);
      accountCreated = false;
      await page.goto("/dashboard");
      await page.waitForURL(/\/login(?:$|\?)/, { timeout: 15_000 });
    } finally {
      if (accountCreated) {
        // Recover access with either known password so a failed assertion still
        // gets a best-effort deletion through the user's own settings UI.
        try {
          if (!/\/dashboard(?:$|\?)/.test(page.url())) {
            await signInWithPassword(page, email, newPassword);
            try {
              await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 8_000 });
            } catch {
              await signInWithPassword(page, email, oldPassword);
              await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 8_000 });
            }
          }
          await deleteAccountThroughSettings(page);
        } catch {
          // Preserve the journey's original failure; cleanup uses the real UI
          // and never falls back to privileged database or Auth mutations.
        }
      }
    }
  });
});
