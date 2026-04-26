import "server-only";

// D3 — Cloudflare Turnstile verification.
// Called from the auth pre-flight server action. When TURNSTILE_SECRET_KEY is
// not configured (e.g. local dev, CI), verification is skipped so behaviour is
// unchanged. Production must set this env var and the matching site key.

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Bypass in dev / preview where secret is not configured.
  if (!secret) return { ok: true };

  if (!token) return { ok: false, error: "CAPTCHA verification required." };

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      // Edge/Node both fine; Turnstile responds quickly so no explicit timeout.
    });
    if (!res.ok) return { ok: false, error: "CAPTCHA verification failed." };
    const data = (await res.json()) as { success: boolean };
    if (!data.success) return { ok: false, error: "CAPTCHA verification failed." };
    return { ok: true };
  } catch {
    return { ok: false, error: "CAPTCHA verification could not be reached." };
  }
}

export function turnstileSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;
}
