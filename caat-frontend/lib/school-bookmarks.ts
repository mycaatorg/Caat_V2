/**
 * Turns the schools list's one bookmarked-schools read into each card's
 * `initialBookmarked`. A failed read gives `undefined`, so the card does its
 * own read and can offer a retry, rather than showing every school as unsaved
 * (and then over-counting when one is "bookmarked" again). PROD-149.
 */
export function schoolBookmarkLookup(res: {
  data: { school_id: number }[] | null;
  error?: unknown;
}): (schoolId: number) => boolean | undefined {
  if (res.error) return () => undefined;
  const ids = new Set((res.data ?? []).map((row) => row.school_id));
  return (schoolId) => ids.has(schoolId);
}
