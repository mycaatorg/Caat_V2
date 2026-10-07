/** Read-only phone checks for public pages; no forms are submitted. */
import { expect, test } from "@playwright/test";
import { sidewaysOverflow } from "./phone";
import routeCoverage from "./route-coverage.json";

const PUBLIC_PAGES = routeCoverage.routes.filter((entry) => entry.coverage === "public-content");

for (const { route } of PUBLIC_PAGES) {
  test(`public page ${route} fits a phone screen without sideways scrolling`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
    await page.waitForLoadState("load");
    expect(await sidewaysOverflow(page)).toEqual([]);
  });
}

test("a phone visitor can open the menu and reach log in and sign up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /get started for free/i }).first()).toBeVisible();

  const menu = page.getByRole("button", { name: "Open menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Log in" }).last()).toBeVisible();
  await page.getByRole("link", { name: "Sign Up" }).last().click();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});

test("the sign-in form can be reached from the keyboard alone", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("Email", { exact: true });
  await email.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();

  // Tab on through the form. Production keeps Sign in disabled until the
  // human check passes, so the button counts only once it is enabled.
  const submit = page.getByRole("button", { name: /sign in/i });
  const reached = new Set<string>();
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim() : "";
    });
    reached.add(name);
    if (await submit.evaluate((el) => el === document.activeElement)) break;
  }
  expect([...reached].some((name) => /forgot password/i.test(name))).toBe(true);
  if (await submit.isEnabled()) await expect(submit).toBeFocused();
});
