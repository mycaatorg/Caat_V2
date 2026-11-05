// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import { SchoolNotesPanel } from '@/app/(main)/schools/[id]/SchoolNotesPanel';

const save = vi.hoisted(() => vi.fn());
vi.mock('@/app/(main)/schools/[id]/notes-actions', () => ({ saveSchoolNoteAction: save }));
type Result = { updated_at: string | null; error: string | null };
const ok: Result = { updated_at: '2026-11-06T00:00:00Z', error: null };
function deferred() {
  let resolve!: (value: Result) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Result>((r, fail) => { resolve = r; reject = fail; });
  return { promise, resolve, reject };
}
function editor(schoolId = 1, initialNotes = '') {
  return <SchoolNotesPanel ownerId="owner-a" schoolId={schoolId} initialNotes={initialNotes} initialUpdatedAt={null} />;
}
function change(value: string) { fireEvent.change(screen.getByRole('textbox'), { target: { value } }); }
async function debounce() { await act(async () => { await vi.advanceTimersByTimeAsync(1500); }); }
async function settle(request: ReturnType<typeof deferred>, value = ok) {
  await act(async () => { request.resolve(value); await request.promise; });
}
beforeEach(() => { vi.useFakeTimers(); save.mockReset(); save.mockResolvedValue(ok); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('school note saving', () => {
  it.each(['throw', 'returned error'])('restores a queued revert after the earlier write commits but reports %s', async (failure) => {
    const first = deferred(); let persisted = 'Original';
    save.mockImplementationOnce((_id: number, text: string) => { persisted = text; return first.promise; });
    save.mockImplementation(async (_id: number, text: string) => { persisted = text; return ok; });
    render(editor(1, 'Original'));
    change('Temporary'); await debounce();
    change('Original'); await debounce();
    await act(async () => {
      if (failure === 'throw') first.reject(new Error('response lost after commit'));
      else first.resolve({ updated_at: null, error: 'Could not save note.' });
      await first.promise.catch(() => {});
    });
    expect(save.mock.calls).toEqual([[1, 'Temporary', 'owner-a'], [1, 'Original', 'owner-a']]);
    expect(persisted).toBe('Original');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('allows manual recovery to the original text when a write outcome is uncertain', async () => {
    const first = deferred(); let persisted = 'Original';
    save.mockImplementationOnce((_id: number, text: string) => { persisted = text; return first.promise; });
    save.mockImplementation(async (_id: number, text: string) => { persisted = text; return ok; });
    render(editor(1, 'Original'));
    change('Temporary'); await debounce(); change('Original');
    await act(async () => { first.reject(new Error('response lost after commit')); await first.promise.catch(() => {}); });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    expect(persisted).toBe('Original');
    expect(save.mock.calls).toEqual([[1, 'Temporary', 'owner-a'], [1, 'Original', 'owner-a']]);
  });

  it('coalesces edits behind one unresolved write and persists the latest text', async () => {
    const first = deferred();
    let persisted = '';
    save.mockImplementationOnce(async (_id: number, text: string) => { const result = await first.promise; persisted = text; return result; });
    save.mockImplementation(async (_id: number, text: string) => { persisted = text; return ok; });
    render(editor());
    change('First'); await debounce();
    change('Intermediate'); await debounce();
    change('Latest'); await debounce();
    expect(save.mock.calls).toEqual([[1, 'First', 'owner-a']]);
    await settle(first);
    expect(save.mock.calls).toEqual([[1, 'First', 'owner-a'], [1, 'Latest', 'owner-a']]);
    expect(persisted).toBe('Latest');
    expect(screen.getByRole('textbox')).toHaveValue('Latest');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('queues an unmount flush behind the current write without losing the last keystrokes', async () => {
    const first = deferred(); save.mockImplementationOnce(() => first.promise);
    const view = render(editor());
    change('First'); await debounce();
    change('Final before leaving'); view.unmount();
    expect(save.mock.calls).toEqual([[1, 'First', 'owner-a']]);
    await settle(first);
    expect(save.mock.calls).toEqual([[1, 'First', 'owner-a'], [1, 'Final before leaving', 'owner-a']]);
  });

  it('deduplicates beforeunload and unmount for the same in-flight text', async () => {
    const first = deferred(); save.mockImplementationOnce(() => first.promise);
    const view = render(editor());
    change('Only version'); await debounce();
    fireEvent(window, new Event('beforeunload')); view.unmount();
    await settle(first);
    expect(save.mock.calls).toEqual([[1, 'Only version', 'owner-a']]);
  });

  it('writes a revert after an older pending write even when it matches the original persisted text', async () => {
    const first = deferred(); save.mockImplementationOnce(() => first.promise);
    render(editor(1, 'Original'));
    change('Temporary'); await debounce();
    change('Original'); await debounce();
    await settle(first);
    expect(save.mock.calls).toEqual([[1, 'Temporary', 'owner-a'], [1, 'Original', 'owner-a']]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps a failed note dirty and lets manual Save retry', async () => {
    save.mockResolvedValueOnce({ updated_at: null, error: 'Could not save note.' });
    render(editor()); change('Keep me'); await debounce();
    expect(screen.getByText('Could not save note.')).toBeVisible();
    expect(screen.getByRole('textbox')).toHaveValue('Keep me');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    expect(save.mock.calls).toEqual([[1, 'Keep me', 'owner-a'], [1, 'Keep me', 'owner-a']]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('recovers from a thrown transport error without exposing its details', async () => {
    save.mockRejectedValueOnce(new Error('internal transport details'));
    render(editor()); change('Keep after failure'); await debounce();
    expect(screen.getByRole('textbox')).toHaveValue('Keep after failure');
    expect(screen.getByText('Could not save note. Please try again.')).toBeVisible();
    expect(screen.queryByText('internal transport details')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
    expect(save.mock.calls).toEqual([[1, 'Keep after failure', 'owner-a'], [1, 'Keep after failure', 'owner-a']]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('does not repeat a failed identical request just because unload requested it again', async () => {
    const first = deferred(); save.mockImplementationOnce(() => first.promise);
    render(editor()); change('Failed version'); await debounce();
    fireEvent(window, new Event('beforeunload'));
    await settle(first, { updated_at: null, error: 'Could not save note.' });
    expect(save.mock.calls).toEqual([[1, 'Failed version', 'owner-a']]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('continues to a distinct queued edit after an earlier save fails', async () => {
    const first = deferred(); save.mockImplementationOnce(() => first.promise);
    render(editor()); change('Earlier'); await debounce();
    change('Newest'); await debounce();
    await settle(first, { updated_at: null, error: 'Could not save note.' });
    expect(save.mock.calls).toEqual([[1, 'Earlier', 'owner-a'], [1, 'Newest', 'owner-a']]);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('keeps the new school state separate when an old school write settles', async () => {
    const first = deferred(); save.mockImplementationOnce(() => first.promise);
    const view = render(editor(1, 'One'));
    change('Edited one'); await debounce();
    change('Final one');
    await act(async () => { view.rerender(editor(2, 'Two')); });
    await settle(first);
    expect(save.mock.calls).toEqual([[1, 'Edited one', 'owner-a'], [1, 'Final one', 'owner-a']]);
    expect(screen.getByRole('textbox')).toHaveValue('Two');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('resets the editor on school change while flushing to the original school', async () => {
    const view = render(editor(1, 'School one'));
    change('Edited one');
    await act(async () => { view.rerender(editor(2, 'School two')); });
    expect(screen.getByRole('textbox')).toHaveValue('School two');
    expect(save.mock.calls).toEqual([[1, 'Edited one', 'owner-a']]);
    change('Edited two'); await debounce();
    expect(save.mock.calls).toEqual([[1, 'Edited one', 'owner-a'], [2, 'Edited two', 'owner-a']]);
  });

  it('does not save clean notes during StrictMode replay or unmount', () => {
    const view = render(<StrictMode>{editor(1, 'Saved note')}</StrictMode>);
    view.unmount(); expect(save).not.toHaveBeenCalled();
  });

  it('rejects edits above the limit without losing the current note', async () => {
    render(editor(1, 'Keep this'));
    change('x'.repeat(5001)); await debounce();
    expect(screen.getByRole('textbox')).toHaveValue('Keep this');
    expect(save).not.toHaveBeenCalled();
  });
});
