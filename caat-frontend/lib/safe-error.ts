// H1 — Translate raw Supabase / PostgREST errors into generic, user-safe
// messages. Never returns DB-internal detail (constraint names, column
// names, schema info, etc.) to the client.
//
// In development, the original message is logged to the server console for
// debugging. In production, callers should additionally pipe the original
// error to an error-reporting service (Sentry / Logsnag / etc.) — that
// integration is left to the host application.

type AnyError = unknown;

export function sanitizeError(
  err: AnyError,
  fallback = "Something went wrong. Please try again."
): string {
  if (process.env.NODE_ENV !== "production") {
    console.error("[sanitizeError]", err);
  }
  // Known Supabase auth errors are safe to bubble up — they're already
  // intended to be user-readable ("Invalid login credentials" etc.).
  if (typeof err === "object" && err !== null && "name" in err) {
    const e = err as { name?: string; message?: string; status?: number };
    if (e.name === "AuthApiError" && typeof e.message === "string") {
      return e.message;
    }
    // Most other errors include a numeric status code from PostgREST/PostgREST
    // 4xx are usually user-fixable (validation), 5xx are infra issues.
    if (typeof e.status === "number" && e.status >= 400 && e.status < 500) {
      // Strip schema info; keep a generic 4xx message.
      return "Request was rejected. Please check your input and try again.";
    }
  }
  return fallback;
}
