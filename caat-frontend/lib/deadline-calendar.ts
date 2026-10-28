import type { UnifiedDeadline } from "@/lib/unified-deadlines";

export const CALENDAR_ERROR = "Could not prepare your calendar. Please try again.";

/** Continue past short server-capped pages; never silently publish a partial file. */
export async function calendarPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  { maxPages = 100 }: { maxPages?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(rows.length, rows.length + 199);
    if (result.error || result.data === null) throw new Error(CALENDAR_ERROR);
    if (!result.data.length) return rows;
    rows.push(...result.data);
    if (rows.length > 10_000) throw new Error(CALENDAR_ERROR);
  }
  throw new Error(CALENDAR_ERROR);
}

function text(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

/** RFC5545 folding counts UTF-8 octets, including continuation whitespace. */
function fold(line: string) {
  let result = "", width = 0;
  const encoder = new TextEncoder();
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (width + bytes > 75) { result += "\r\n "; width = 1; }
    result += character; width += bytes;
  }
  return result;
}

function dates(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(CALENDAR_ERROR);
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error(CALENDAR_ERROR);
  date.setUTCDate(date.getUTCDate() + 1);
  const end = date.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error(CALENDAR_ERROR);
  return [iso.replaceAll("-", ""), end.replaceAll("-", "")];
}

export function serializeDeadlineCalendar(rows: UnifiedDeadline[], userId: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CAAT//Deadline snapshot//EN", "CALSCALE:GREGORIAN"];
  for (const row of rows) {
    if (row.source === "event") throw new Error(CALENDAR_ERROR);
    const [start, end] = dates(row.dateISO);
    const url = new URL(row.href, "https://mycaat.com");
    if (!row.href.startsWith("/") || row.href.startsWith("//") || url.origin !== "https://mycaat.com") throw new Error(CALENDAR_ERROR);
    lines.push("BEGIN:VEVENT", `UID:${encodeURIComponent(userId)}-${encodeURIComponent(row.id)}@mycaat.com`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${text(row.title)}`,
      "DESCRIPTION:CAAT deadline snapshot. Check the official source for closing times and changes. This file does not sync with CAAT.",
      `URL:${url.href}`, "CLASS:PRIVATE", "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  return [...lines, "END:VCALENDAR"].map(fold).join("\r\n") + "\r\n";
}
