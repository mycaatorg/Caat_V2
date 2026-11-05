import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSchoolNoteAction, saveSchoolNoteAction } from '@/app/(main)/schools/[id]/notes-actions';

const io = vi.hoisted(() => ({ userId: 'owner-a' as string | null, from: vi.fn(), upsert: vi.fn(), remove: vi.fn(), getUser: vi.fn(), read: vi.fn() }));
vi.mock('@/lib/supabase-server', () => ({ createSupabaseServer: async () => ({
  auth: { getUser: io.getUser },
  from: io.from,
}) }));
beforeEach(() => {
  io.userId = 'owner-a'; io.getUser.mockReset().mockImplementation(async () => ({ data: { user: io.userId ? { id: io.userId } : null }, error: null })); io.read.mockReset().mockResolvedValue({ data: { notes: 'Saved', updated_at: null }, error: null }); io.from.mockReset(); io.upsert.mockReset(); io.remove.mockReset();
  io.upsert.mockReturnValue({ select: () => ({ single: async () => ({ data: { updated_at: '2026-11-06T00:00:00Z' }, error: null }) }) });
  io.remove.mockReturnValue({ eq: () => ({ eq: async () => ({ error: null }) }) });
  io.from.mockReturnValue({
    upsert: io.upsert,
    delete: io.remove,
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: io.read }) }) }),
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


describe('school-note load failures', () => {
  it.each(['auth', 'read'])('sanitizes thrown %s failures without yielding an editable owner snapshot', async (stage) => {
    (stage === 'auth' ? io.getUser : io.read).mockRejectedValueOnce(new Error('private provider details'));
    const result = await fetchSchoolNoteAction(1);
    expect(result).toEqual({ note: { notes: '', updated_at: null }, error: 'Could not load note.', ownerId: null });
    if (stage === 'auth') expect(io.from).not.toHaveBeenCalled();
  });
  it('does not trust a user returned alongside an authentication error', async () => {
    io.getUser.mockResolvedValueOnce({ data: { user: { id: 'owner-a' } }, error: new Error('private auth failure') });
    const result = await fetchSchoolNoteAction(1);
    expect(result.error).toBe('Could not load note.'); expect(result.ownerId).toBeNull();
    expect(io.from).not.toHaveBeenCalled();
  });
  it('reports a returned read error rather than successful empty data', async () => {
    io.read.mockResolvedValueOnce({ data: null, error: { message: 'private read details' } });
    expect((await fetchSchoolNoteAction(1)).error).toBe('Could not load note.');
  });
  it('allows a confirmed missing row to create a new note', async () => {
    io.read.mockResolvedValueOnce({ data: null, error: null });
    expect(await fetchSchoolNoteAction(1)).toEqual({ note: { notes: '', updated_at: null }, error: null, ownerId: 'owner-a' });
  });
});
