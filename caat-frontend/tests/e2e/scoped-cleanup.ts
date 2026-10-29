/** Attempt every explicitly scoped fixture cleanup, then report all failures. */
export async function runScopedCleanup(actions: Array<() => Promise<unknown>>) {
  const failures: unknown[] = [];
  for (const action of actions) {
    try { await action(); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Scoped fixture cleanup failed");
}
