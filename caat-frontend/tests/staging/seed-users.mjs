import { assertLocalApiUrl } from './safety.mjs';

const urlText = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_TEST_PASSWORD;
if (!urlText || !key || !password) throw new Error('Set local SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and E2E_TEST_PASSWORD.');
const base = assertLocalApiUrl(urlText);
if (password.length < 12) throw new Error('E2E_TEST_PASSWORD must be at least 12 characters. Use a disposable local-only value.');

const accounts = [
  { email: 'e2e.student@caat.local.test', first_name: 'E2E', last_name: 'Student' },
  { email: 'e2e.peer@caat.local.test', first_name: 'E2E', last_name: 'Peer' },
];
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const api = async (path, options = {}) => {
  const response = await fetch(new URL(path, base), { ...options, headers: { ...headers, ...options.headers } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Local Supabase ${path} failed (${response.status}): ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
};

const response = await api('/auth/v1/admin/users?page=1&per_page=1000');
for (const account of accounts) {
  let user = response.users.find((candidate) => candidate.email?.toLowerCase() === account.email);
  const body = { email: account.email, password, email_confirm: true, user_metadata: { first_name: account.first_name, last_name: account.last_name } };
  if (user) user = await api(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'PUT', body: JSON.stringify(body) });
  else user = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify(body) });
  const profile = { id: user.id, email: account.email, first_name: account.first_name, last_name: account.last_name, is_verified: false };
  await api('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(profile),
  });
}
console.log(`Created or refreshed ${accounts.length} synthetic E2E users and profile rows on local Supabase.`);
