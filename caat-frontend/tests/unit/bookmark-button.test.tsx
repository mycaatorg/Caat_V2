// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { button, click, deferred, mountComponent, queryButton, unmountAll } from './dom-helpers';

type Result = { data: unknown; error: { message: string } | null };
const io = vi.hoisted(() => ({
  auth: { user: { id: 'owner' } as { id: string } | null, loading: false },
  read: vi.fn<() => Promise<Result>>(),
  upsert: vi.fn<(row: unknown) => Promise<Result>>(),
  remove: vi.fn<() => Promise<Result>>(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/supabase/client', () => {
  const filters = (done: () => Promise<Result>) => {
    const chain: Record<string, unknown> = {};
    chain.eq = () => chain;
    chain.maybeSingle = done;
    chain.then = (yes: (r: Result) => unknown, no: (e: unknown) => unknown) => done().then(yes, no);
    return chain;
  };
  return {
    supabase: {
      from: () => ({
        select: () => filters(() => io.read()),
        delete: () => filters(() => io.remove()),
        upsert: (row: unknown) => io.upsert(row),
      }),
    },
  };
});
vi.mock('@/components/providers/AuthContext', () => ({ useAuth: () => io.auth }));
vi.mock('sonner', () => ({ toast: io.toast }));
import BookmarkButton from '@/components/BookmarkButton';

const mountMajor = (extra: Partial<React.ComponentProps<typeof BookmarkButton>> = {}) =>
  mountComponent(<BookmarkButton table="user_bookmarked_majors" column="major_id" id="major-1" label="major" {...extra} />);
const ok = (data: unknown): Result => ({ data, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  io.auth = { user: { id: 'owner' }, loading: false };
  io.read.mockResolvedValue(ok(null));
  io.upsert.mockResolvedValue(ok(null));
  io.remove.mockResolvedValue(ok(null));
});
afterEach(() => unmountAll());

describe('shared bookmark button', () => {
  it('shows a disabled pending state, not an unsaved claim, until the saved state is read', async () => {
    const read = deferred<Result>();
    io.read.mockReturnValueOnce(read.promise);
    await mountMajor();
    const pending = button('Loading major bookmark');
    expect(pending.disabled).toBe(true);
    expect(pending.getAttribute('aria-busy')).toBe('true');
    expect(pending.hasAttribute('aria-pressed')).toBe(false);
    expect(queryButton('Bookmark major')).toBeNull();
    await click(pending);
    expect(io.upsert).not.toHaveBeenCalled();
    expect(io.remove).not.toHaveBeenCalled();

    await act(async () => read.resolve(ok({ major_id: 'major-1' })));
    const saved = button('Remove bookmark');
    expect(saved.disabled).toBe(false);
    expect(saved.getAttribute('aria-pressed')).toBe('true');
  });

  it('stays pending while the signed-in user is still resolving', async () => {
    io.auth = { user: null, loading: true };
    await mountMajor();
    expect(button('Loading major bookmark').disabled).toBe(true);
    expect(io.read).not.toHaveBeenCalled();
    expect(io.toast.error).not.toHaveBeenCalled();
  });

  it('shows a retryable error instead of an unsaved state when the read fails', async () => {
    io.read
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
      .mockResolvedValueOnce(ok({ major_id: 'major-1' }));
    await mountMajor();
    expect(queryButton('Bookmark major')).toBeNull();
    const retry = button('Could not load major bookmark. Retry');
    expect(retry.disabled).toBe(false);
    expect(retry.hasAttribute('aria-pressed')).toBe(false);
    await click(retry);
    expect(io.upsert).not.toHaveBeenCalled();
    expect(io.read).toHaveBeenCalledTimes(2);
    expect(button('Remove bookmark').getAttribute('aria-pressed')).toBe('true');
  });

  it('treats a rejected read as a failed read', async () => {
    io.read.mockRejectedValueOnce(new Error('network'));
    await mountMajor();
    expect(button('Could not load major bookmark. Retry')).toBeTruthy();
    expect(queryButton('Bookmark major')).toBeNull();
  });

  it('ignores duplicate clicks while a toggle is in flight', async () => {
    const write = deferred<Result>();
    io.upsert.mockReturnValueOnce(write.promise);
    await mountMajor();
    const idle = button('Bookmark major');
    await act(async () => {
      idle.click();
      idle.click();
    });
    expect(io.upsert).toHaveBeenCalledTimes(1);
    const busy = button('Remove bookmark');
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    await click(busy);
    expect(io.remove).not.toHaveBeenCalled();

    await act(async () => write.resolve(ok(null)));
    const done = button('Remove bookmark');
    expect(done.disabled).toBe(false);
    expect(done.getAttribute('aria-pressed')).toBe('true');
    expect(io.upsert).toHaveBeenCalledTimes(1);
  });

  it('rolls back a failed toggle and allows another try', async () => {
    io.upsert.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    await mountMajor();
    await click(button('Bookmark major'));
    expect(button('Bookmark major').disabled).toBe(false);
    expect(io.toast.error).toHaveBeenCalled();
    await click(button('Bookmark major'));
    expect(button('Remove bookmark')).toBeTruthy();
  });

  it('uses a server-resolved state without a client read', async () => {
    await mountMajor({ initialBookmarked: true });
    expect(io.read).not.toHaveBeenCalled();
    expect(button('Remove bookmark').disabled).toBe(false);
  });

  it('lets a signed-out visitor reach the sign-in prompt instead of a pending button', async () => {
    io.auth = { user: null, loading: false };
    await mountMajor();
    await click(button('Bookmark major'));
    expect(io.toast.error).toHaveBeenCalledWith('Sign in to bookmark majors.');
    expect(io.read).not.toHaveBeenCalled();
  });
});
