import { describe, expect, it } from 'vitest';
import { loadCourseBookmarks, setCourseBookmark } from '@/lib/course-bookmarks';
import { createMockSupabase } from './mock-supabase';

describe('private course saves', () => {
  it('reads only the current owner’s saves', async () => {
    const client = createMockSupabase({ resolver: () => ({ data: [{ course_id: 'course-1' }], error: null }) });
    expect(await loadCourseBookmarks(client as never, 'owner')).toEqual(['course-1']);
    expect(client.queries[0].calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
  });
  it('fails closed on read errors', async () => {
    const client = createMockSupabase({ resolver: () => ({ data: null, error: { message: 'offline' } }) });
    await expect(loadCourseBookmarks(client as never, 'owner')).rejects.toThrow('Could not load saved courses');
  });
  it('checks a save actually exists if an idempotent insert returns no row', async () => {
    const client = createMockSupabase({ resolver: ctx => ({ data: ctx.op === 'upsert' ? [] : { course_id: 'course-1' }, error: null }) });
    await setCourseBookmark(client as never, 'owner', 'course-1', true);
    expect(client.queries).toHaveLength(2);
    expect(client.queries[1].calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
    expect(client.queries[1].calls).toContainEqual({ method: 'eq', args: ['course_id', 'course-1'] });
  });
  it('does not report a zero-row save as success when the record is absent', async () => {
    const client = createMockSupabase({ resolver: ctx => ({ data: ctx.op === 'upsert' ? [] : null, error: null }) });
    await expect(setCourseBookmark(client as never, 'owner', 'course-1', true)).rejects.toThrow('Could not save course');
  });
  it.each([true, false])('propagates write failure for saved=%s', async saved => {
    const client = createMockSupabase({ user: { id: 'owner' }, resolver: () => ({ data: null, error: { message: 'offline' } }) });
    await expect(setCourseBookmark(client as never, 'owner', 'course-1', saved)).rejects.toThrow();
  });
  it('scopes removal to exactly the owner and offering', async () => {
    const client = createMockSupabase({ user: { id: 'owner' }, resolver: () => ({ data: [], error: null }) });
    await setCourseBookmark(client as never, 'owner', 'course-1', false);
    expect(client.queries[0].op).toBe('delete');
    expect(client.queries[0].calls).toContainEqual({ method: 'eq', args: ['user_id', 'owner'] });
    expect(client.queries[0].calls).toContainEqual({ method: 'eq', args: ['course_id', 'course-1'] });
  });
  it('rejects a removal when the signed-in session belongs to someone else, without deleting', async () => {
    const client = createMockSupabase({ user: { id: 'owner' }, sessionUser: { id: 'peer' }, resolver: () => ({ data: [], error: null }) });
    await expect(setCourseBookmark(client as never, 'owner', 'course-1', false)).rejects.toThrow('signed-in account');
    expect(client.queries).toHaveLength(0);
  });
  it('rejects a removal with no session', async () => {
    const client = createMockSupabase({ user: null, resolver: () => ({ data: [], error: null }) });
    await expect(setCourseBookmark(client as never, 'owner', 'course-1', false)).rejects.toThrow('signed-in account');
  });
  it('treats a zero-row removal by the verified owner as already removed', async () => {
    const client = createMockSupabase({ user: { id: 'owner' }, resolver: () => ({ data: null, error: null, count: 0 }) });
    await expect(setCourseBookmark(client as never, 'owner', 'course-1', false)).resolves.toBeUndefined();
    expect(client.queries[0].op).toBe('delete');
  });
  it('accepts a removal that deleted exactly one row', async () => {
    const client = createMockSupabase({ user: { id: 'owner' }, resolver: () => ({ data: null, error: null, count: 1 }) });
    await expect(setCourseBookmark(client as never, 'owner', 'course-1', false)).resolves.toBeUndefined();
  });
});
