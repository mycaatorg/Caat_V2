import { describe, it, expect } from "vitest";
import { getInitials } from "@/lib/user-utils";

describe("getInitials()", () => {
  it("two-word name returns first letter of each", () => {
    expect(getInitials("Kevin Hu")).toBe("KH");
  });

  it("single-word name returns first letter", () => {
    expect(getInitials("Kevin")).toBe("K");
  });

  it("three+ word name returns first and last initials", () => {
    expect(getInitials("John Michael Smith")).toBe("JS");
  });

  it("empty string returns empty string", () => {
    expect(getInitials("")).toBe("");
  });

  it("whitespace-only string returns empty string", () => {
    expect(getInitials("   ")).toBe("");
  });

  it("name with extra spaces between words handled correctly", () => {
    expect(getInitials("John  Smith")).toBe("JS");
  });
});
