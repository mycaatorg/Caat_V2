/**
 * Returns a safe http/https URL or null if the value is missing or uses a
 * dangerous protocol such as javascript: (A3).
 *
 * URLs stored without a scheme (e.g. "university.edu") are assumed to be HTTPS
 * and returned with the prefix added.
 */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already has http / https scheme
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return trimmed;
      }
    } catch {
      return null;
    }
  }

  // Has a different explicit scheme — reject (blocks javascript:, data:, etc.)
  if (/^[a-z][a-z0-9+\-.]*:/i.test(trimmed)) {
    return null;
  }

  // No scheme — assume https
  try {
    const withProtocol = `https://${trimmed}`;
    new URL(withProtocol); // validate
    return withProtocol;
  } catch {
    return null;
  }
}
