import { test, expect } from "@playwright/test";
import { activeCommunityPosts, removeOwnedSyntheticPosts, signInToCommunityTestAccount } from "./community-locators";
const ownedTitles: string[] = [];
test.beforeEach(async ({ page }) => { await signInToCommunityTestAccount(page); });
test.afterEach(async ({ request }) => { await removeOwnedSyntheticPosts(request, ownedTitles.splice(0)); });

test("community: create rich post, like, comment, edit/delete controls", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/communities");
  await expect(page.getByRole("main").getByText(/Share your experience/)).toBeVisible({ timeout: 15_000 });

  const content = `SmokePost ${Date.now()}`;
  ownedTitles.push(content);

  // Expand composer + type into the rich editor, then bold the text.
  await page.getByRole("main").getByText(/Share your experience/).click();
  const editor = page.getByRole("main").locator(".ProseMirror:visible");
  await editor.click();
  await page.keyboard.type(content);
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("main").getByRole("button", { name: "Bold", exact: true }).click();

  await page.getByRole("main").getByText("Select a topic").click();
  await page.getByRole("option", { name: "Advice", exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: "Post", exact: true }).click();

  const card = activeCommunityPosts(page, content);
  await expect(card).toHaveCount(1);
  // Renders as sanitized rich HTML — bold, not raw tags or markdown.
  await expect(
    card.locator(".community-prose strong").filter({ hasText: content })
  ).toBeVisible({ timeout: 15_000 });
  // No raw tags leaked into the visible text.
  await expect(page.getByText("<strong>", { exact: false })).toHaveCount(0);

  // Like (toggleLike + block gate).
  await card.getByRole("button", { name: /^Like post/ }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText(/isn.t available|Too many/i)).toHaveCount(0);

  // Comment.
  await card.getByRole("button", { name: /Show comments/ }).click();
  const commentBox = card.getByPlaceholder(/Write a comment/).first();
  await expect(commentBox).toBeVisible({ timeout: 10_000 });
  const commentText = `SmokeComment ${Date.now()}`;
  await commentBox.fill(commentText);
  await commentBox.press("ControlOrMeta+Enter");
  await expect(card.getByText(commentText).first()).toBeVisible({ timeout: 10_000 });

  // Own comment edit/delete controls present.
  await expect(card.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();
  await expect(card.getByRole("button", { name: "Delete", exact: true }).first()).toBeVisible();
});
