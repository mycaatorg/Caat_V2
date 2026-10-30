import { expect, it } from "vitest";
import { runScopedCleanup } from "../e2e/scoped-cleanup";

it("attempts every scoped cleanup after early failures and reports all failures", async () => {
  const attempted: number[] = [];
  const first = new Error("first delete failed"), last = new Error("last delete failed");
  const outcome = runScopedCleanup([
    async () => { attempted.push(1); throw first; },
    async () => { attempted.push(2); },
    async () => { attempted.push(3); throw last; },
    async () => { attempted.push(4); },
  ]).catch(error => error);
  const error = await outcome;
  expect(attempted).toEqual([1, 2, 3, 4]);
  expect(error).toBeInstanceOf(AggregateError);
  expect(error.errors).toEqual([first, last]);
});

it("finishes successfully when all scoped cleanup actions succeed", async () => {
  const deleted: number[] = [];
  await expect(runScopedCleanup([async () => { deleted.push(1); }, async () => { deleted.push(2); }])).resolves.toBeUndefined();
  expect(deleted).toEqual([1, 2]);
});

import { withScopedCleanup } from '../e2e/scoped-cleanup';

it('preserves the journey failure and cleanup failure together', async () => {
  const original = new Error('original persistence regression');
  const cleanup = new Error('cleanup gateway unavailable');
  const result = await withScopedCleanup(async () => { throw original; }, async () => { throw cleanup; }).catch(error => error);
  expect(result).toBeInstanceOf(AggregateError);
  expect(result.errors).toEqual([original, cleanup]);
  expect(result.cause).toBe(original);
});

it('still reports a journey failure after successful cleanup', async () => {
  const original = new Error('original regression');
  let cleaned = false;
  await expect(withScopedCleanup(async () => { throw original; }, async () => { cleaned = true; })).rejects.toBe(original);
  expect(cleaned).toBe(true);
});

it('fails an otherwise successful journey when cleanup fails', async () => {
  const cleanup = new Error('cleanup failed');
  await expect(withScopedCleanup(async () => 42, async () => { throw cleanup; })).rejects.toBe(cleanup);
  await expect(withScopedCleanup(async () => 42, async () => {})).resolves.toBe(42);
});
