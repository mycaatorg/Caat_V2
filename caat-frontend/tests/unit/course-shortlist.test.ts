import { describe, expect, it } from 'vitest';
import { loadShortlist, removeFromShortlist } from '@/lib/shortlist';
import { createMockSupabase } from './mock-supabase';

describe('course shortlist continuity', () => {
  it('keeps specific inactive courses alongside existing major and university saves', async () => {
    const rows: Record<string, unknown[]> = {
      user_course_bookmarks: [{ course_id: 'course-1', course_offerings: { id: 'course-1', name: 'Computing', institution_name: 'Example University', campus: 'Main', active: false, source_url: 'https://example.edu.au/computing' } }],
      user_bookmarked_majors: [{ major_id: 'major-1', majors: { id: 'major-1', name: 'Computing', category: 'STEM' } }],
      user_bookmarked_schools: [{ school_id: 7, schools: { id: 7, name: 'Example University', country: 'Australia' } }],
    };
    const client = createMockSupabase({ resolver: ctx => ({ data: rows[ctx.table] ?? [], error: null }) });
    const list = await loadShortlist(client as never, 'owner');
    expect(list.courses).toEqual([{ id: 'course-1', name: 'Computing', institutionName: 'Example University', campus: 'Main', active: false, sourceUrl: 'https://example.edu.au/computing', schoolId: null, application: null }]);
    expect(client.queries.find(q => q.table === 'user_course_bookmarks')?.calls[0].args[0]).toContain('source_url');
    expect(client.queries.find(q => q.table === 'user_course_bookmarks')?.calls[0].args[0]).toContain('school_id');
    expect(list.majors).toHaveLength(1); expect(list.schools).toHaveLength(1);
    expect(client.queries.find(q => q.table === 'user_course_bookmarks')?.calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
  });
  it('attaches the owner application at the course university, and none when the course has no school', async () => {
    const rows: Record<string, unknown[]> = {
      user_course_bookmarks: [
        { course_id: 'c-linked', course_offerings: { id: 'c-linked', name: 'Computing', institution_name: 'UNSW Sydney', campus: null, active: true, source_url: 'https://example.edu.au/a', school_id: 7 } },
        { course_id: 'c-other', course_offerings: { id: 'c-other', name: 'Commerce', institution_name: 'Other', campus: null, active: true, source_url: 'https://example.edu.au/b', school_id: 9 } },
        { course_id: 'c-unlinked', course_offerings: { id: 'c-unlinked', name: 'Law', institution_name: 'Nowhere', campus: null, active: true, source_url: 'https://example.edu.au/c', school_id: null } },
      ],
      user_school_applications: [{ id: 'app-7', school_id: 7, status: 'applying' }],
    };
    const client = createMockSupabase({ resolver: ctx => ({ data: rows[ctx.table] ?? [], error: null }) });
    const list = await loadShortlist(client as never, 'owner');
    expect(list.courses.map(c => [c.id, c.schoolId, c.application])).toEqual([
      ['c-linked', 7, { id: 'app-7', status: 'applying' }],
      ['c-other', 9, null],
      ['c-unlinked', null, null],
    ]);
    expect(client.queries.find(q => q.table === 'user_school_applications')?.calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
  });
  it('does not silently omit courses when their save query fails', async () => {
    const client = createMockSupabase({ resolver: ctx => ctx.table === 'user_course_bookmarks' ? { data: null, error: { message: 'offline' } } : { data: [], error: null } });
    await expect(loadShortlist(client as never, 'owner')).rejects.toThrow('Could not load your shortlist');
  });
  it('removes only the specific course, never university or major bookmarks', async () => {
    const client = createMockSupabase({ user: { id: 'owner' }, resolver: () => ({ data: [], error: null }) });
    await removeFromShortlist(client as never, 'owner', 'course', 'course-1');
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0].table).toBe('user_course_bookmarks');
    expect(client.queries[0].calls).toContainEqual({ method: 'eq', args: ['course_id', 'course-1'] });
  });
  it('rejects a course removal when the session user does not own the save', async () => {
    const client = createMockSupabase({ user: { id: 'owner' }, sessionUser: { id: 'peer' }, resolver: () => ({ data: [], error: null }) });
    await expect(removeFromShortlist(client as never, 'owner', 'course', 'course-1')).rejects.toThrow();
    expect(client.queries).toHaveLength(0);
  });
  it('keeps a course removal idempotent when the verified owner deletes zero rows', async () => {
    const client = createMockSupabase({ user: { id: 'owner' }, resolver: () => ({ data: null, error: null, count: 0 }) });
    await expect(removeFromShortlist(client as never, 'owner', 'course', 'course-1')).resolves.toBeUndefined();
  });
  it('keeps legacy removals idempotent without a session lookup', async () => {
    const client = createMockSupabase({ resolver: () => ({ data: null, error: null, count: 0 }) });
    await expect(removeFromShortlist(client as never, 'owner', 'major', 'major-1')).resolves.toBeUndefined();
    expect(client.auth.getSession).not.toHaveBeenCalled();
  });
});
