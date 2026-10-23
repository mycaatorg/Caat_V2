import { describe, expect, it } from 'vitest';
import { schoolBookmarkLookup } from '@/lib/school-bookmarks';

describe('schools list bookmark lookup', () => {
  it('gives each card its saved state when the read succeeded', () => {
    const lookup = schoolBookmarkLookup({ data: [{ school_id: 1 }], error: null });
    expect(lookup(1)).toBe(true);
    expect(lookup(2)).toBe(false);
  });

  it('leaves the state unknown on a failed read so each card reads and offers a retry itself', () => {
    const lookup = schoolBookmarkLookup({ data: null, error: { message: 'offline' } });
    expect(lookup(1)).toBeUndefined();
    expect(lookup(2)).toBeUndefined();
  });

  it('treats a signed-out visitor as having no saved schools', () => {
    expect(schoolBookmarkLookup({ data: null })(1)).toBe(false);
  });
});
