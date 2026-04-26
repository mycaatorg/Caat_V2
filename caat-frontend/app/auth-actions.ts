"use server";

import { headers } from "next/headers";
import { gate, ratelimits } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Pre-flight check for auth-related forms (login, signup, password reset).
 * Combines rate limiting (G1) and CAPTCHA verification (D3).
 *
 * Called from client-side forms before invoking the actual Supabase auth call.
 * The Supabase call still happens client-side (so the session is established in
 * the browser); this action just decides whether to allow the attempt.
 */
export async function preflightAuthAction(input: {
  turnstileToken?: string;
  intent: "login" | "signup" | "forgot-password";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // Resolve the IP for rate limiting (auth flows aren't tied to a user yet).
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown";

  const rl = await gate(ratelimits.authAttempt, `auth:${ip}:${input.intent}`);
  if (!rl.ok) return { ok: false, error: rl.error };

  const captcha = await verifyTurnstile(input.turnstileToken);
  if (!captcha.ok) return { ok: false, error: captcha.error };

  return { ok: true };
}
