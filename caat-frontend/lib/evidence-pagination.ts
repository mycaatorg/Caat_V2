/** Read owner-filtered queries in bounded pages rather than silently stopping
 * at PostgREST's row cap. Callers supply a stable, unique ordering. */
export async function evidencePages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, message: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 200) {
    const page = await fetchPage(from, from + 199);
    if (page.error) throw new Error(message);
    const batch = page.data ?? [];
    rows.push(...batch);
    if (batch.length < 200) return rows;
  }
}
