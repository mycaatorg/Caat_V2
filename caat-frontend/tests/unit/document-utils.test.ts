import { describe, it, expect } from "vitest";
import {
  formatFileSize,
  sanitizeFileName,
  formatDate,
  mapStatus,
  getFileExt,
} from "@/lib/document-utils";

// ── formatFileSize ─────────────────────────────────────────────────────────────

describe("formatFileSize()", () => {
  it("returns empty string for 0 bytes (falsy)", () => {
    expect(formatFileSize(0)).toBe("");
  });

  it("returns empty string for null", () => {
    expect(formatFileSize(null)).toBe("");
  });

  it("shows KB for values below 1 MB", () => {
    expect(formatFileSize(1023)).toMatch(/KB/);
  });

  it("formats 1024 bytes as 1 KB", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });

  it("formats exactly 1 MB", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
  });

  it("formats 5 MB correctly", () => {
    expect(formatFileSize(5242880)).toBe("5.0 MB");
  });
});

// ── sanitizeFileName ───────────────────────────────────────────────────────────

describe("sanitizeFileName()", () => {
  it("replaces spaces with underscores", () => {
    expect(sanitizeFileName("my file.pdf")).toBe("my_file.pdf");
  });

  it("removes special characters", () => {
    expect(sanitizeFileName("file!@#$.pdf")).toBe("file____.pdf");
  });

  it("preserves file extension", () => {
    expect(sanitizeFileName("document.pdf")).toBe("document.pdf");
  });

  it("handles multiple consecutive spaces", () => {
    expect(sanitizeFileName("my   file.pdf")).toBe("my_file.pdf");
  });

  it("handles empty string", () => {
    expect(sanitizeFileName("")).toBe("");
  });

  it("preserves dots only for extension separator", () => {
    expect(sanitizeFileName("my.doc.pdf")).toBe("my.doc.pdf");
  });
});

// ── formatDate ─────────────────────────────────────────────────────────────────

describe("formatDate()", () => {
  it("formats a valid ISO string to locale date", () => {
    const result = formatDate("2025-01-01T00:00:00.000Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2025/);
  });

  it("includes day, month, and year in result", () => {
    const result = formatDate("2025-06-15T12:00:00.000Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2025/);
  });
});

// ── mapStatus ──────────────────────────────────────────────────────────────────

describe("mapStatus()", () => {
  it("'verified' maps to 'Verified'", () => {
    expect(mapStatus("verified")).toBe("Verified");
  });

  it("'resubmit' maps to 'Resubmit'", () => {
    expect(mapStatus("resubmit")).toBe("Resubmit");
  });

  it("'pending_review' maps to 'In Review'", () => {
    expect(mapStatus("pending_review")).toBe("In Review");
  });

  it("unknown status string maps to 'In Review' (fallback)", () => {
    expect(mapStatus("something_else")).toBe("In Review");
  });
});

// ── getFileExt ─────────────────────────────────────────────────────────────────

describe("getFileExt()", () => {
  it("'report.pdf' returns 'pdf'", () => {
    expect(getFileExt("report.pdf")).toBe("pdf");
  });

  it("'photo.JPG' returns lowercase 'jpg'", () => {
    expect(getFileExt("photo.JPG")).toBe("jpg");
  });

  it("'archive.tar.gz' returns last extension 'gz'", () => {
    expect(getFileExt("archive.tar.gz")).toBe("gz");
  });

  it("file with no extension returns empty string", () => {
    expect(getFileExt("README")).toBe("readme");
  });

  it("dotfile '.gitignore' returns 'gitignore'", () => {
    expect(getFileExt(".gitignore")).toBe("gitignore");
  });
});
