import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSchoolNoteAction, saveSchoolNoteAction } from '@/app/(main)/schools/[id]/notes-actions';

const io = vi.hoisted(() => ({ userId: 'owner-a' as string | null, from: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ createSupabaseServer: async () => ({
  auth: { getUser: async () => ({ data: { user: io.userId ? { id: io.userId } : null } }) },
  from: io.from,
}) }));
beforeEach(() => {
  io.userId = 'owner-a'; io.from.mockReset(); io.upsert.mockReset(); io.remove.mockReset();
  io.upsert.mockReturnValue({ select: () => ({ single: async () => ({ data: { updated_at: '2026-11-06T00:00:00Z' }, error: null }) }) });
  io.remove.mockReturnValue({ eq: () => ({ eq: async () => ({ error: null }) }) });
  io.from.mockReturnValue({
    upsert: io.upsert,
    delete: io.remove,
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { notes: 'Saved', updated_at: null }, error: null }) }) }) }),
  });
});
describe('school-note account binding', () => {
  it('returns the authenticated note owner with the initial snapshot', async () => {
    expect(await fetchSchoolNoteAction(1)).toEqual({ note: { notes: 'Saved', updated_at: null }, error: null, ownerId: 'owner-a' });
  });
  it.each(['Private text', ''])('rejects an old editor after the authenticated account changes (%s)', async (text) => {
    io.userId = 'owner-b';
    const result = await saveSchoolNoteAction(1, text, 'owner-a');
    expect(result.error).toBeTruthy();
    expect(io.from).not.toHaveBeenCalled();
  });
  it('does not write when the caller omits the expected owner', async () => {
    const result = await saveSchoolNoteAction(1, 'Private text', '');
    expect(result.error).toBeTruthy(); expect(io.from).not.toHaveBeenCalled();
  });
  it('writes only the authenticated matching owner', async () => {
    expect((await saveSchoolNoteAction(1, 'Private text', 'owner-a')).error).toBeNull();
    expect(io.upsert).toHaveBeenCalledWith({ user_id: 'owner-a', school_id: 1, notes: 'Private text' }, { onConflict: 'user_id,school_id' });
  });
  it('rejects signed-out saves without querying the notes table', async () => {
    io.userId = null;
    expect((await saveSchoolNoteAction(1, 'Private text', 'owner-a')).error).toBeTruthy();
    expect(io.from).not.toHaveBeenCalled();
  });
});
