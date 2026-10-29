import { describe, expect, it } from "vitest";
import { evidencePages } from "@/lib/evidence-pagination";

describe("bounded cancellable evidence pagination", () => {
  it("rejects an endless full-page backend rather than returning partial results", async () => {
    let reads = 0;
    const read = async () => ({ data: ++reads <= 3 ? Array(200).fill("row") : [], error: null });
    await expect(evidencePages(read, "Unavailable", { maxPages: 3 })).rejects.toThrow("Unavailable");
    expect(reads).toBe(3);
  });

  it("accepts a complete result whose empty terminal read reaches the bound", async () => {
    const rows = [...Array(200).fill("first"), "last"];
    expect(await evidencePages(async from => ({ data: rows.slice(from, from + 200), error: null }), "Unavailable", { maxPages: 3 })).toEqual(rows);
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

it.each([1, 50, 199, 200])("reads every row with an effective server page cap of %i", async cap => {
  const rows = Array.from({ length: 125 }, (_, id) => ({ id }));
  const result = await evidencePages(async from => ({ data: rows.slice(from, from + cap), error: null }), "Unavailable");
  expect(result).toEqual(rows);
});

it.each(["error", "null"])("rejects a %s after a short page rather than publishing partial rows", async mode => {
  await expect(evidencePages(async from => from === 0
    ? { data: ["first"], error: null }
    : { data: null, error: mode === "error" ? new Error("private details") : null }, "Unavailable")).rejects.toThrow("Unavailable");
});

it("rejects repeated short pages when the request bound is reached", async () => {
  await expect(evidencePages(async () => ({ data: ["row"], error: null }), "Unavailable", { maxPages: 3 })).rejects.toThrow("Unavailable");
});


it("bounds an endless backend even when the caller omits a limit", async () => {
  let requests = 0;
  await expect(evidencePages(async () => ({ data: [++requests], error: null }), "Unavailable")).rejects.toThrow("Unavailable");
  expect(requests).toBe(1000);
});

it.each([0, -1, 1.5, Infinity, NaN])("rejects an invalid page limit %s without making a request", async maxPages => {
  let requests = 0;
  await expect(evidencePages(async () => { requests++; return { data: [], error: null }; }, "Unavailable", { maxPages })).rejects.toThrow("Unavailable");
  expect(requests).toBe(0);
});

});
