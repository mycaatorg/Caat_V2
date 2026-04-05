import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("merges multiple class strings correctly", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes — falsy values ignored", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
    expect(cn("foo", null, undefined, "baz")).toBe("foo baz");
  });

  it("resolves Tailwind conflicts — last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("returns empty string when no inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined, null, false, '' inputs without crashing", () => {
    expect(() => cn(undefined, null, false, "")).not.toThrow();
    expect(cn(undefined, null, false, "")).toBe("");
  });
});
