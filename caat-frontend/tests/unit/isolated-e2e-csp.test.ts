import { describe, expect, it } from "vitest";
import {
  assertIsolatedE2EEnvironment,
  contentSecurityConnectSources,
} from "../../lib/isolated-e2e-csp";

const isolatedEnv = {
  CAAT_ISOLATED_E2E: "1",
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55431",
  E2E_TEST_EMAIL: "e2e.student@caat.local.test",
  E2E_TEST_PASSWORD: "local-test-password-only",
};

const productionSources = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://*.supabase.in",
  "wss://*.supabase.in",
  "https://challenges.cloudflare.com",
];

describe("isolated E2E CSP boundary", () => {
  it("keeps the production connect sources unchanged by default", () => {
    expect(contentSecurityConnectSources({})).toEqual(productionSources);
  });

  it("allows only the validated isolated Supabase loopback origin", () => {
    expect(contentSecurityConnectSources(isolatedEnv)).toEqual([
      ...productionSources,
      "http://127.0.0.1:55431",
    ]);
    expect(assertIsolatedE2EEnvironment(isolatedEnv)).toEqual({ apiOrigin: "http://127.0.0.1:55431" });
  });

  it.each([
    ["production Supabase API", { NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co" }],
    ["non-loopback app", { PLAYWRIGHT_BASE_URL: "http://192.168.1.3:3100" }],
    ["unapproved API port", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54322" }],
    ["malformed API URL", { NEXT_PUBLIC_SUPABASE_URL: "not a URL" }],
    ["wrong account", { E2E_TEST_EMAIL: "someone@example.com" }],
  ])("rejects %s", (_label, override) => {
    expect(() => contentSecurityConnectSources({ ...isolatedEnv, ...override })).toThrow();
  });
});
