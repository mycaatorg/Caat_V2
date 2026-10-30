import { test, expect, type Locator } from "@playwright/test";
import { activeCommunityPosts, removeOwnedSyntheticPosts, signInToCommunityTestAccount } from "./community-locators";
const ownedTitles: string[] = [];
test.beforeEach(async ({ page }) => { await signInToCommunityTestAccount(page); });
test.afterEach(async ({ request }) => { await removeOwnedSyntheticPosts(request, ownedTitles.splice(0)); });

async function createPost(page: import("@playwright/test").Page, text: string, bold = false) {
  ownedTitles.push(text);
  await page.goto("/communities");
  await expect(page.getByRole("main").getByText(/Share your experience/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("main").getByText(/Share your experience/).click();
  const editor = page.getByRole("main").locator(".ProseMirror:visible");
  await editor.click();
  await page.keyboard.type(text);
  if (bold) {
    await page.keyboard.press("ControlOrMeta+a");
    await page.getByRole("main").getByRole("button", { name: "Bold", exact: true }).click();
  }
  await page.getByRole("main").getByText("Select a topic").click();
  await page.getByRole("option", { name: "Advice", exact: true }).click();
  await page.getByRole("main").getByRole("button", { name: "Post", exact: true }).click();
  const card = activeCommunityPosts(page, text);
  await expect(card).toHaveCount(1);
  await expect(card.getByText(text, { exact: true })).toBeVisible({ timeout: 15_000 });
  return card;
}

async function openComments(card: Locator) {
  await card.getByRole("button", { name: /Show comments/ }).click();
  await expect(card.getByPlaceholder(/Write a comment/)).toBeVisible({ timeout: 10_000 });
}
async function addComment(card: Locator, text: string) {
  const box = card.getByPlaceholder(/Write a comment/);
  await box.fill(text);
  await box.press("ControlOrMeta+Enter");
  await expect(card.getByText(text, { exact: true })).toBeVisible({ timeout: 10_000 });
}

test("rich post renders bold + comment edit + comment delete (leaf)", async ({ page }) => {
  test.setTimeout(90_000);
  const txt = `RichA ${Date.now()}`;
  const card = await createPost(page, txt, true);
  await expect(card.locator(".community-prose strong").filter({ hasText: txt })).toBeVisible();

  await openComments(card);
  await addComment(card, `cmtA ${Date.now()}`);

  // Edit the comment (now that edited_at exists).
  await card.getByRole("button", { name: "Edit", exact: true }).first().click();
  await page.keyboard.press("ControlOrMeta+a");
  const editedText = `editedA ${Date.now()}`;
  await page.keyboard.type(editedText);
  await card.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(card.getByText(editedText).first()).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText("edited").first()).toBeVisible();

  // Delete the (leaf) comment -> removed.
  await card.getByRole("button", { name: "Delete", exact: true }).first().click();
  await card.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(card.getByText(editedText)).toHaveCount(0, { timeout: 10_000 });
});

test("comment with a reply soft-deletes to [deleted] and keeps the reply", async ({ page }) => {
  test.setTimeout(90_000);
  const card = await createPost(page, `RichB ${Date.now()}`, false);
  await openComments(card);
  const parent = `parentB ${Date.now()}`;
  await addComment(card, parent);

  // Reply to the parent.
  await card.getByRole("button", { name: "Reply", exact: true }).first().click();
  const reply = `replyB ${Date.now()}`;
  const replyBox = card.getByPlaceholder("Write a reply…").first();
  await replyBox.fill(reply);
  await replyBox.press("ControlOrMeta+Enter");
  await expect(card.getByText(reply).first()).toBeVisible({ timeout: 10_000 });

  // Delete the parent -> soft-deleted, reply survives.
  await card.getByRole("button", { name: "Delete", exact: true }).first().click();
  await card.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(card.getByText("[deleted]").first()).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText(reply).first()).toBeVisible();
  await expect(card.getByText(parent)).toHaveCount(0);
});

test("post delete removes it from the feed (cascade)", async ({ page }) => {
  test.setTimeout(90_000);
  const txt = `DeleteMeP ${Date.now()}`;
  const card = await createPost(page, txt, false);
  // Scope to the exact card (not .first(), which can be a pinned/other post).
  await card.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: /Delete post/i }).click();
  await expect(activeCommunityPosts(page, txt)).toHaveCount(0, { timeout: 10_000 });
});

test("composer draft autosaves and restores after reload", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/communities");
  await page.getByRole("main").getByText(/Share your experience/).click();
  const editor = page.getByRole("main").locator(".ProseMirror:visible");
  await editor.click();
  const draft = `DraftZ ${Date.now()}`;
  await page.keyboard.type(draft);
  await page.waitForTimeout(800); // let the autosave effect write
  await page.reload();
  await expect(page.getByRole("main").getByText(draft, { exact: true })).toBeVisible({ timeout: 15_000 });
  // Clean up the draft so it doesn't linger.
  await page.getByRole("main").getByText(draft, { exact: true }).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Delete");
});
