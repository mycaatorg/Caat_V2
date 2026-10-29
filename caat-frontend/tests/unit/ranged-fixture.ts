/** A finite fixture table. Honor the requested inclusive range, including EOF. */
export function rangedFixture<T>(rows: T[], calls: Array<{ method: string; args: unknown[] }>): T[] {
  const range = calls.find(call => call.method === "range")?.args as number[] | undefined;
  return range ? rows.slice(range[0], range[1] + 1) : rows;
}
