import { describe, expect, it } from "vitest";
import { evidencePages } from "@/lib/evidence-pagination";

describe("bounded cancellable evidence pagination", () => {
  it("rejects an endless full-page backend rather than returning partial results", async () => {
    let reads = 0;
    const read = async () => ({ data: ++reads <= 3 ? Array(200).fill("row") : [], error: null });
    await expect(evidencePages(read, "Unavailable", { maxPages: 3 })).rejects.toThrow("Unavailable");
    expect(reads).toBe(3);
  });

  it("accepts a final short page at the bound", async () => {
    expect(await evidencePages(async from => ({ data: from === 0 ? Array(200).fill("first") : ["last"], error: null }), "Unavailable", { maxPages: 2 }))
      .toEqual([...Array(200).fill("first"), "last"]);
  });

  it("rejects a late successful page after cancellation without reading another page", async () => {
    const controller = new AbortController();
    let reads = 0;
    const read = async () => {
      reads++; controller.abort();
      return { data: reads === 1 ? Array(200).fill("row") : [], error: null };
    };
    await expect(evidencePages(read, "Unavailable", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(reads).toBe(1);
  });

  it("does not start a page for an already aborted request", async () => {
    const controller = new AbortController(); controller.abort();
    let reads = 0;
    await expect(evidencePages(async () => { reads++; return { data: [], error: null }; }, "Unavailable", { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(reads).toBe(0);
  });
});
