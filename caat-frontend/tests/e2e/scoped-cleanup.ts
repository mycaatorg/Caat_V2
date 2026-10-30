/** Attempt every explicitly scoped fixture cleanup, then report all failures. */
export async function runScopedCleanup(actions: Array<() => Promise<unknown>>) {
  const failures: unknown[] = [];
  for (const action of actions) {
    try { await action(); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "Scoped fixture cleanup failed");
}

/** Keep the original regression visible even if its fixture cleanup also fails. */
export async function withScopedCleanup<T>(body: () => Promise<T>, cleanup: () => Promise<unknown>): Promise<T> {
  let value!: T;
  let failed = false;
  let original: unknown;
  try { value = await body(); } catch (error) { failed = true; original = error; }
  try { await cleanup(); } catch (error) {
    if (failed) throw new AggregateError([original, error], 'Journey failed and fixture cleanup also failed', { cause: original });
    throw error;
  }
  if (failed) throw original;
  return value;
}
