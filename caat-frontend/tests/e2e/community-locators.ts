import { expect, type Page } from '@playwright/test';
import { assertIsolatedE2EEnvironment } from '../../lib/isolated-e2e-csp';
/** All active post matches: hidden streamed roots/cards cannot satisfy checks,
 * and a second visible copy remains a strict-locator/uniqueness failure. */
export function activeCommunityPosts(page: Page, content: string) {
  return page.getByRole('main').locator('[data-slot="card"]:visible')
    .filter({ has: page.locator('.community-prose').filter({ hasText: content }) });
}

/** Legacy local journeys register their own random titles before writing.
 * API cleanup survives a failed/closed browser and is always owner-scoped. */
export async function removeOwnedSyntheticPosts(request: import('@playwright/test').APIRequestContext, contents: string[], email = process.env.E2E_TEST_EMAIL) {
  if (!contents.length) return;
  const { apiOrigin } = assertIsolatedE2EEnvironment(process.env);
  if (contents.some(content => !content || /[%_*]/.test(content))) throw new Error('Fixture titles must be literal and nonempty');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const response = await request.post(`${apiOrigin}/auth/v1/token?grant_type=password`, { headers: { apikey: key }, data: { email, password: process.env.E2E_TEST_PASSWORD } });
  if (!response.ok()) throw new Error('Could not authenticate fixture cleanup');
  const session = await response.json();
  if (!session.user?.id || !session.access_token) throw new Error('Missing cleanup owner');
  const headers = { apikey: key, Authorization: `Bearer ${session.access_token}` };
  const failures: Error[] = [];
  for (const content of contents) {
    try {
      const query = new URLSearchParams({ user_id: `eq.${session.user.id}`, content: `like.*${content}*` });
      const result = await request.delete(`${apiOrigin}/rest/v1/community_posts?${query}`, { headers });
      if (!result.ok()) throw new Error('Could not remove synthetic post');
      const remaining = await request.get(`${apiOrigin}/rest/v1/community_posts?${query}&select=id`, { headers });
      if (!remaining.ok() || (await remaining.json()).length !== 0) throw new Error('Synthetic post remains after cleanup');
    } catch { failures.push(new Error('Could not remove synthetic post')); }
  }
  if (failures.length) throw new AggregateError(failures, 'Community fixture cleanup failed');
}

export async function signInToCommunityTestAccount(page: Page) {
  assertIsolatedE2EEnvironment(process.env);
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/today(?:$|\?)/, { timeout: 20_000 });
  await expect(page.getByRole('main')).toBeVisible();
}
