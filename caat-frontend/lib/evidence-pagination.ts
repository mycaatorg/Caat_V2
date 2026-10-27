/** Read owner-filtered queries in bounded pages rather than silently stopping
 * at PostgREST's row cap. Callers supply a stable, unique ordering. */
export async function evidencePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  message: string,
  options: { signal?: AbortSignal; maxPages?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let pageIndex = 0; ; pageIndex++) {
    options.signal?.throwIfAborted();
    // Never publish partial counts when a backend keeps returning full pages.
    if (options.maxPages !== undefined && pageIndex >= options.maxPages) throw new Error(message);
    const from = pageIndex * 200;
    const page = await fetchPage(from, from + 199);
    options.signal?.throwIfAborted();
    if (page.error) throw new Error(message);
    const batch = page.data ?? [];
    rows.push(...batch);
    if (batch.length < 200) return rows;
  }
}
