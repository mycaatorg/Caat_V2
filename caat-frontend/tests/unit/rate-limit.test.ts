import type { Ratelimit } from "@upstash/ratelimit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gate } from "@/lib/rate-limit";

const unavailable = {
  ok: false,
  error: "We couldn't check the request right now. Please try again shortly.",
};

function limiterWith(limit: ReturnType<typeof vi.fn>) {
  return { limit } as unknown as Ratelimit;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("rate-limit gate", () => {
  it("fails closed with a retry message when the provider rejects, without logging credentials or identifiers", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("fetch failed: secret-token private-host"));

    await expect(gate(limiterWith(limit), "auth:private-ip:signup")).resolves.toEqual(unavailable);
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[rate-limit] Provider unavailable", { reason: "request_failed" });
  });

  it("rejects the SDK's fail-open timeout result even when success is true", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true, reason: "timeout", reset: 0 });

    await expect(gate(limiterWith(limit), "auth:ip:login")).resolves.toEqual(unavailable);
    expect(console.error).toHaveBeenCalledExactlyOnceWith("[rate-limit] Provider unavailable", { reason: "timeout" });
  });

  it("allows the next attempt after the provider recovers", async () => {
    const limit = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ success: true, reset: 0 });
    const limiter = limiterWith(limit);

    await expect(gate(limiter, "auth:ip:signup")).resolves.toEqual(unavailable);
    await expect(gate(limiter, "auth:ip:signup")).resolves.toEqual({ ok: true });
    expect(limit).toHaveBeenCalledTimes(2);
  });

  it("preserves the retry countdown for an actual quota rejection", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const limit = vi.fn().mockResolvedValue({ success: false, reset: 3_100 });

    await expect(gate(limiterWith(limit), "user:123")).resolves.toEqual({
      ok: false,
      error: "Too many requests. Try again in 3s.",
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("allows a provider-confirmed request", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true, reset: 0 });

    await expect(gate(limiterWith(limit), "user:123")).resolves.toEqual({ ok: true });
    expect(limit).toHaveBeenCalledExactlyOnceWith("user:123");
    expect(console.error).not.toHaveBeenCalled();
  });
});
