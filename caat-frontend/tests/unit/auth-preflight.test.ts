import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  gate: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/rate-limit", () => ({
  gate: mocks.gate,
  ratelimits: { authAttempt: { name: "auth-attempt" } },
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.verifyTurnstile }));

import { preflightAuthAction } from "@/app/auth-actions";

beforeEach(() => {
  mocks.headers.mockReset().mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" }));
  mocks.gate.mockReset().mockResolvedValue({ ok: true });
  mocks.verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
});

describe("preflightAuthAction", () => {
  it("uses the client IP and intent for rate limiting before CAPTCHA verification", async () => {
    await expect(preflightAuthAction({ turnstileToken: "valid-token", intent: "forgot-password" })).resolves.toEqual({ ok: true });

    expect(mocks.gate).toHaveBeenCalledOnce();
    expect(mocks.gate.mock.calls[0][1]).toBe("auth:203.0.113.8:forgot-password");
    expect(mocks.verifyTurnstile).toHaveBeenCalledExactlyOnceWith("valid-token");
  });

  it("stops before CAPTCHA when the rate limit denies the attempt", async () => {
    mocks.gate.mockResolvedValue({ ok: false, error: "Too many attempts." });

    await expect(preflightAuthAction({ turnstileToken: "valid-token", intent: "forgot-password" })).resolves.toEqual({
      ok: false,
      error: "Too many attempts.",
    });
    expect(mocks.verifyTurnstile).not.toHaveBeenCalled();
  });

  it("returns CAPTCHA failures without allowing the protected auth action", async () => {
    mocks.verifyTurnstile.mockResolvedValue({ ok: false, error: "Challenge expired." });

    await expect(preflightAuthAction({ turnstileToken: "expired-token", intent: "forgot-password" })).resolves.toEqual({
      ok: false,
      error: "Challenge expired.",
    });
    expect(mocks.gate).toHaveBeenCalledOnce();
    expect(mocks.verifyTurnstile).toHaveBeenCalledExactlyOnceWith("expired-token");
  });
});
