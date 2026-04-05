import { describe, it, expect } from "vitest";
import { safeText } from "@/lib/resume-utils";

describe("safeText()", () => {
  it("string input returned as-is", () => {
    expect(safeText("hello")).toBe("hello");
  });

  it("null returns empty string", () => {
    expect(safeText(null)).toBe("");
  });

  it("undefined returns empty string", () => {
    expect(safeText(undefined)).toBe("");
  });

  it("number returns empty string", () => {
    expect(safeText(42)).toBe("");
  });

  it("object returns empty string", () => {
    expect(safeText({ foo: "bar" })).toBe("");
  });

  it("empty string returned as-is", () => {
    expect(safeText("")).toBe("");
  });
});
