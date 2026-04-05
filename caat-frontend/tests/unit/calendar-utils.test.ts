import { describe, it, expect } from "vitest";
import { toDateKey, formatTime } from "@/lib/calendar-utils";

// ── toDateKey ──────────────────────────────────────────────────────────────────

describe("toDateKey()", () => {
  it("converts a Date to YYYY-MM-DD using local date parts", () => {
    const d = new Date(2024, 5, 15); // June 15 — local time, no UTC shift
    expect(toDateKey(d)).toBe("2024-06-15");
  });

  it("zero-pads single-digit months and days", () => {
    expect(toDateKey(new Date(2024, 2, 5))).toBe("2024-03-05"); // March 5
  });

  it("first day of year", () => {
    expect(toDateKey(new Date(2024, 0, 1))).toBe("2024-01-01");
  });

  it("last day of year", () => {
    expect(toDateKey(new Date(2024, 11, 31))).toBe("2024-12-31");
  });

  it("leap year Feb 29", () => {
    expect(toDateKey(new Date(2024, 1, 29))).toBe("2024-02-29");
  });
});

// ── formatTime ─────────────────────────────────────────────────────────────────

describe("formatTime()", () => {
  it("'08:00' converts to '8:00 AM'", () => {
    expect(formatTime("08:00")).toBe("8:00 AM");
  });

  it("'13:30' converts to '1:30 PM'", () => {
    expect(formatTime("13:30")).toBe("1:30 PM");
  });

  it("'00:00' converts to '12:00 AM' (midnight)", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
  });

  it("'12:00' converts to '12:00 PM' (noon)", () => {
    expect(formatTime("12:00")).toBe("12:00 PM");
  });

  it("'23:59' converts to '11:59 PM'", () => {
    expect(formatTime("23:59")).toBe("11:59 PM");
  });

  it("null input returns null", () => {
    expect(formatTime(null)).toBeNull();
  });
});
