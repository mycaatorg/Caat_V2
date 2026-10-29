/** Read owner-filtered queries in bounded pages rather than silently stopping
 * at PostgREST's row cap. Callers supply a stable, unique ordering.
 * A short page may reflect a lower server cap; only an empty page proves EOF.
 * The request bound includes that terminal read and fails without partial data. */
export async function evidencePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  message: string,
  options: { signal?: AbortSignal; maxPages?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  const maxPages = options.maxPages ?? 1000;
  if (!Number.isSafeInteger(maxPages) || maxPages < 1) throw new Error(message);
  for (let pageIndex = 0; ; pageIndex++) {
    options.signal?.throwIfAborted();
    // Never publish partial counts when a backend keeps returning full pages.
    if (pageIndex >= maxPages) throw new Error(message);
    const from = rows.length;
    const page = await fetchPage(from, from + 199);
    options.signal?.throwIfAborted();
    if (page.error || !Array.isArray(page.data)) throw new Error(message);
    const batch = page.data;
    if (batch.length === 0) return rows;
    rows.push(...batch);
  }
}
