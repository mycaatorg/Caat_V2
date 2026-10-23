import { describe, expect, it } from 'vitest';
import { loadShortlist, removeFromShortlist } from '@/lib/shortlist';
import { createMockSupabase } from './mock-supabase';

describe('course shortlist continuity', () => {
  it('keeps specific inactive courses alongside existing major and university saves', async () => {
    const rows: Record<string, unknown[]> = {
      user_course_bookmarks: [{ course_id: 'course-1', course_offerings: { id: 'course-1', name: 'Computing', institution_name: 'Example University', campus: 'Main', active: false } }],
      user_bookmarked_majors: [{ major_id: 'major-1', majors: { id: 'major-1', name: 'Computing', category: 'STEM' } }],
      user_bookmarked_schools: [{ school_id: 7, schools: { id: 7, name: 'Example University', country: 'Australia' } }],
    };
    const client = createMockSupabase({ resolver: ctx => ({ data: rows[ctx.table] ?? [], error: null }) });
    const list = await loadShortlist(client as never, 'owner');
    expect(list.courses).toEqual([{ id: 'course-1', name: 'Computing', institutionName: 'Example University', campus: 'Main', active: false }]);
    expect(list.majors).toHaveLength(1); expect(list.schools).toHaveLength(1);
    expect(client.queries.find(q => q.table === 'user_course_bookmarks')?.calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
  });
  it('does not silently omit courses when their save query fails', async () => {
    const client = createMockSupabase({ resolver: ctx => ctx.table === 'user_course_bookmarks' ? { data: null, error: { message: 'offline' } } : { data: [], error: null } });
    await expect(loadShortlist(client as never, 'owner')).rejects.toThrow('Could not load your shortlist');
  });
  it('removes only the specific course, never university or major bookmarks', async () => {
    const client = createMockSupabase({ resolver: () => ({ data: [], error: null }) });
    await removeFromShortlist(client as never, 'owner', 'course', 'course-1');
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0].table).toBe('user_course_bookmarks');
    expect(client.queries[0].calls).toContainEqual({ method: 'eq', args: ['course_id', 'course-1'] });
  });
});
