import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GET } from "@/app/api/health/auth/route";

const probeSecret = "probe-only-secret-with-at-least-32-characters";
const providerToken = "private-provider-token";
const request = (authorization = `Bearer ${probeSecret}`) => new Request("https://www.mycaat.com/api/health/auth", { headers: { authorization } });
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock.mockReset());
  vi.stubEnv("AUTH_HEALTH_CHECK_TOKEN", probeSecret);
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://private-host.upstash.io");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", providerToken);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("protected deployed auth-provider readiness", () => {
  it.each(["", "Bearer wrong-token", `Basic ${probeSecret}`])("rejects unauthorized probes without contacting Redis", async auth => {
    const response = await GET(request(auth));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed without a probe secret", async () => {
    vi.stubEnv("AUTH_HEALTH_CHECK_TOKEN", "");
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(providerToken);
  });

  it.each(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"])("reports unavailable for missing %s instead of silently passing", async name => {
    vi.stubEnv(name, "");
    expect((await GET(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["http://private-host.upstash.io", "https://untrusted.example", "https://user:password@private-host.upstash.io"])("never sends provider credentials to an invalid URL", async url => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", url);
    expect((await GET(request())).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the current provider without caching or following redirects", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ result: "PONG" }), { status: 200 }));
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://private-host.upstash.io/ping");
    expect(options).toMatchObject({ headers: { Authorization: `Bearer ${providerToken}` }, cache: "no-store", redirect: "error" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("detects DNS failure safely and clears the failure when the provider recovers", async () => {
    const cause = Object.assign(new Error(`ENOTFOUND private-host ${providerToken}`), { code: "ENOTFOUND" });
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed", { cause }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: "PONG" })));
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ status: "unavailable" });
    expect(console.error).toHaveBeenCalledWith("[auth-health] Provider unavailable", { reason: "request_failed", code: "ENOTFOUND" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private-host|private-provider-token/);
    expect((await GET(request())).status).toBe(200);
  });

  it.each([
    new Response(JSON.stringify({ result: "PONG" }), { status: 401 }),
    new Response(JSON.stringify({ result: "NOT-PONG", error: "private-host private-provider-token" })),
    new Response("not-json private-provider-token"),
  ])("rejects HTTP failures and malformed replies without echoing provider data", async reply => {
    fetchMock.mockResolvedValue(reply);
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private-host|private-provider-token/);
  });

  it("aborts a provider that never replies within the probe budget", async () => {
    // Use a real abort event so a probe that drops the signal cannot pass.
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), 5);
      return controller.signal;
    });
    fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })));
    expect((await GET(request())).status).toBe(503);
    expect(AbortSignal.timeout).toHaveBeenCalledWith(2500);
  });
});
