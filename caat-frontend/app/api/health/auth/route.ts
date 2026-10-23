import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { providerFailureCode } from "@/lib/rate-limit-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function reply(status: number) {
  return Response.json(
    { status: status === 200 ? "ok" : "unavailable" },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

/** Probe the deployed provider config, without exposing it or accepting user sessions. */
export async function GET(request: Request) {
  const secret = process.env.AUTH_HEALTH_CHECK_TOKEN;
  if (!secret || secret.length < 32) return reply(503);
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.length > 1024 || !timingSafeEqual(
    createHash("sha256").update(authorization).digest(),
    createHash("sha256").update(`Bearer ${secret}`).digest(),
  )) return reply(404);

  const endpoint = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!endpoint || !token) return reply(503);

  let url: URL;
  try {
    url = new URL(endpoint);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".upstash.io") || url.username || url.password) return reply(503);
  } catch {
    return reply(503);
  }

  try {
    const response = await fetch(new URL("/ping", url), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return reply(503);
    const data: unknown = await response.json();
    return reply(data && typeof data === "object" && "result" in data && data.result === "PONG" ? 200 : 503);
  } catch (error) {
    const code = providerFailureCode(error);
    console.error("[auth-health] Provider unavailable", { reason: "request_failed", ...(code ? { code } : {}) });
    return reply(503);
  }
}
