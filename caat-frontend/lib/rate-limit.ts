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
 * Throws a user-facing error with a retry hint when the limit is exceeded.
 * No-ops when Redis is not configured.
 */
export async function gate(
  limiter: Ratelimit | null,
  key: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!limiter) return { ok: true };
  const { success, reset } = await limiter.limit(key);
  if (success) return { ok: true };
  const retryIn = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return {
    ok: false,
    error: `Too many requests. Try again in ${retryIn}s.`,
  };
}
