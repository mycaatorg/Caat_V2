const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function parseLocalDatabaseUrl(raw) {
  if (!raw) throw new Error('Set SUPABASE_DB_URL to the local Supabase Postgres URL.');
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !LOOPBACK_HOSTS.has(url.hostname) || !['54322', '55432'].includes(url.port)) {
    throw new Error('Refusing to run: SUPABASE_DB_URL must target loopback port 54322 or 55432 (local Supabase only).');
  }
  return url;
}

export function assertLocalApiUrl(raw) {
  if (!raw) throw new Error('Set local SUPABASE_URL.');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || !LOOPBACK_HOSTS.has(url.hostname) || !['54321', '55431'].includes(url.port)) {
    throw new Error('Refusing to use credentials: SUPABASE_URL must target loopback port 54321 or 55431 (local Supabase only).');
  }
  return url;
}

export function assertEmptyPublicSchema(result) {
  if (result !== 'empty') throw new Error('Refusing to overwrite a database with existing public app tables. Reset the local-only Supabase instance first.');
}
