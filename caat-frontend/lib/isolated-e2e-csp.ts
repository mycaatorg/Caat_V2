const PRODUCTION_CONNECT_SOURCES = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://*.supabase.in",
  "wss://*.supabase.in",
  "https://challenges.cloudflare.com",
];

function loopbackUrl(value: string | undefined, label: string, ports: string[]): URL {
  if (!value) throw new Error(`${label} is required when CAAT_ISOLATED_E2E=1.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL when CAAT_ISOLATED_E2E=1.`);
  }

  if (
    url.protocol !== "http:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !ports.includes(url.port) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} must be an uncredentialed HTTP loopback URL on an approved isolated-test port.`);
  }
  return url;
}

export function assertIsolatedE2EEnvironment(
  env: Record<string, string | undefined>,
): { apiOrigin: string } {
  if (env.CAAT_ISOLATED_E2E !== "1") {
    throw new Error("Set CAAT_ISOLATED_E2E=1 before running authenticated or write-capable E2E.");
  }
  loopbackUrl(env.PLAYWRIGHT_BASE_URL, "PLAYWRIGHT_BASE_URL", ["3100"]);
  const api = loopbackUrl(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL", ["54321", "55431"]);
  if (env.E2E_TEST_EMAIL !== "e2e.student@caat.local.test") {
    throw new Error("E2E_TEST_EMAIL must be the seeded local test account.");
  }
  if (!env.E2E_TEST_PASSWORD || env.E2E_TEST_PASSWORD.length < 12) {
    throw new Error("E2E_TEST_PASSWORD must be set for the disposable local account.");
  }
  return { apiOrigin: api.origin };
}

/**
 * Production CSP remains unchanged unless the isolated E2E flag is explicitly
 * enabled and both app/API origins validate as loopback-only test endpoints.
 */
export function contentSecurityConnectSources(
  env: Record<string, string | undefined>,
): string[] {
  const sources = [...PRODUCTION_CONNECT_SOURCES];
  if (env.CAAT_ISOLATED_E2E !== "1") return sources;

  const { apiOrigin } = assertIsolatedE2EEnvironment(env);
  sources.push(apiOrigin);
  return sources;
}
