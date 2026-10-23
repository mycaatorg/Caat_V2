// Only fixed low-cardinality codes may leave provider errors. Never serialize
// Error.message, hostnames, request keys, stack traces or arbitrary class names.
const safeCodes = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
]);

export function providerFailureCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 6 && error && typeof error === "object"; depth++) {
    if (seen.has(error)) break;
    seen.add(error);
    const value = error as { code?: unknown; name?: unknown; cause?: unknown };
    try {
      const code = value.code;
      const name = value.name;
      if (typeof code === "string" && safeCodes.has(code)) return code;
      if (name === "TimeoutError" || name === "AbortError") return "TIMEOUT";
      error = value.cause;
    } catch {
      break;
    }
  }
  return undefined;
}
