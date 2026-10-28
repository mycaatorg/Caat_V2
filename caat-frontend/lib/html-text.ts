// Client-safe HTML helpers for community post bodies.
//
// These deliberately do NOT import sanitize-html: that library (htmlparser2 +
// its tables) is heavy and was being pulled into the /communities feed bundle
// just for a length check and a render call (C4). Rich post HTML is sanitized
// by server actions and by enrichPosts on read, including legacy/direct REST
// rows. This helper renders only that trusted output; it is not a sanitizer.

/** Strip tags to plain text for length / non-empty validation. Uses the
 *  browser DOMParser; falls back to a regex strip when there is no DOM. */
export function htmlToText(html: string): string {
  if (!html) return "";
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent ?? "").trim();
  }
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i;

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Render-ready HTML for a post body. Rich HTML is already server-sanitized
 * (by enrichPosts on read and updatePostAction on write) so it is passed
 * through as-is; legacy plain-text bodies are escaped + line-broken. Mirrors
 * lib/sanitize-html.ts::postBodyHtml for the non-HTML branch, minus the
 * server-only re-sanitize.
 */
export function postBodyHtml(content: string): string {
  if (!content) return "";
  if (HTML_TAG_RE.test(content)) return content;
  return escapeHtml(content).replace(/\n/g, "<br>");
}
