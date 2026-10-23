import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// G1 — application-level rate limiting. Centralised so every server action
// reuses the same limiters and key conventions.
//
// When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not configured
// (e.g. local dev, CI), the limiter is replaced with a no-op so behaviour is
// unchanged. Production must set these env vars for limits to take effect.

const redisConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisConfigured ? Redis.fromEnv() : null;

function makeLimiter(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1]) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: "caat:rl",
  });
}

export const ratelimits = {
  /** Post creation — 5 per minute per user */
  postCreate: makeLimiter(5, "1 m"),
  /** Comment creation — 30 per minute per user */
  commentCreate: makeLimiter(30, "1 m"),
  /** Follow / unfollow — 60 per minute per user */
  followAction: makeLimiter(60, "1 m"),
  /** Like / unlike — 120 per minute per user */
  likeAction: makeLimiter(120, "1 m"),
  /** Save / unsave — 120 per minute per user */
  saveAction: makeLimiter(120, "1 m"),
  /** Report — 10 per hour per user */
  reportAction: makeLimiter(10, "1 h"),
  /** Group creation — 2 per hour per user */
  groupCreate: makeLimiter(2, "1 h"),
  /** Auth attempts — 5 per minute per IP */
  authAttempt: makeLimiter(5, "1 m"),
  /** Block — 30 per minute per user */
  blockAction: makeLimiter(30, "1 m"),
  /** Privacy / profile updates — 30 per minute per user */
  profileUpdate: makeLimiter(30, "1 m"),
};

/**
 * Returns a user-facing retry message when the limit is exceeded or unavailable.
 * Missing Redis configuration is allowed only outside production.
 */
export async function gate(
  limiter: Ratelimit | null,
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!limiter) {
    // A4: fail closed in real production only. Missing Upstash config in prod
    // must NOT silently disable rate limiting. Gate on VERCEL_ENV (set to
    // "production" only on the true prod deploy), not NODE_ENV, because NODE_ENV
    // is "production" for preview deploys and in CI too, which would otherwise
    // fail-close login there and break the e2e smoke.
    if (process.env.VERCEL_ENV === "production" && !redisConfigured) {
      return { ok: false, error: "Rate limiting is not configured" };
    }
    return { ok: true };
  }
  let result: Awaited<ReturnType<Ratelimit["limit"]>>;
  try {
    result = await limiter.limit(key);
  } catch {
    return providerUnavailable("request_failed");
  }
  // The SDK deliberately returns success=true on timeout. A missing decision
  // must not bypass the protection on auth or any other gated server action.
  if (result.reason === "timeout") return providerUnavailable("timeout");
  const { success, reset } = result;
  if (success) return { ok: true };
  const retryIn = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return {
    ok: false,
    error: `Too many requests. Try again in ${retryIn}s.`,
  };
}

function providerUnavailable(reason: "request_failed" | "timeout") {
  // Do not log the provider error or key: they can contain credentials or IPs.
  console.error("[rate-limit] Provider unavailable", { reason });
  return {
    ok: false as const,
    error: "We couldn't check the request right now. Please try again shortly.",
  };
}
