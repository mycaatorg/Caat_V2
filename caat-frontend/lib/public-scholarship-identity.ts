/** A readable alias can identify several catalogue records. Carry the ID when
 * linking to a particular listing; old unique bare links remain canonical. */
export function publicScholarshipPath(slug: string, awardId?: string): string {
  const path = `/scholarship/${encodeURIComponent(slug)}`;
  return awardId === undefined ? path : `${path}?${new URLSearchParams({ award: awardId })}`;
}

export function selectPublicScholarship<T extends { id: string }>(
  rows: readonly T[],
  award: string | string[] | undefined,
): T | null {
  if (award === undefined) return rows.length === 1 ? rows[0] : null;
  if (typeof award !== 'string' || !award) return null;
  return rows.find((row) => row.id === award) ?? null;
}
