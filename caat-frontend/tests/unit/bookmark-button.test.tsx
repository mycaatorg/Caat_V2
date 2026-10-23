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
    expect(retry.getAttribute('title')).toBe('Could not load major bookmark. Retry');
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
    await click(button('Bookmark major'));
    expect(io.upsert).toHaveBeenCalledTimes(1);
    // The busy button stays clickable for focus reasons (aria-disabled, not
    // disabled), so these clicks reach the handler and only the guard stops them.
    const busy = button('Remove bookmark');
    expect(busy.disabled).toBe(false);
    expect(busy.getAttribute('aria-disabled')).toBe('true');
    expect(busy.getAttribute('aria-busy')).toBe('true');
    await click(busy);
    await click(busy);
    expect(io.upsert).toHaveBeenCalledTimes(1);
    expect(io.remove).not.toHaveBeenCalled();

    await act(async () => write.resolve(ok(null)));
    const done = button('Remove bookmark');
    expect(done.hasAttribute('aria-disabled')).toBe(false);
    expect(done.hasAttribute('aria-busy')).toBe(false);
    expect(done.getAttribute('aria-pressed')).toBe('true');
    expect(io.upsert).toHaveBeenCalledTimes(1);
  });

  it('keeps keyboard focus on the button through a toggle', async () => {
    const write = deferred<Result>();
    io.upsert.mockReturnValueOnce(write.promise);
    await mountMajor();
    const node = button('Bookmark major');
    node.focus();
    await click(node);
    expect(button('Remove bookmark')).toBe(node);
    expect(node.disabled).toBe(false);
    expect(document.activeElement).toBe(node);
    await act(async () => write.resolve(ok(null)));
    expect(document.activeElement).toBe(node);
    expect(node.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps keyboard focus on the button through a retry', async () => {
    const reread = deferred<Result>();
    io.read
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
      .mockReturnValueOnce(reread.promise);
    await mountMajor();
    const node = button('Could not load major bookmark. Retry');
    node.focus();
    await click(node);
    const loading = button('Loading major bookmark');
    expect(loading).toBe(node);
    expect(loading.disabled).toBe(false);
    expect(loading.getAttribute('aria-disabled')).toBe('true');
    expect(loading.getAttribute('aria-busy')).toBe('true');
    await click(loading);
    expect(io.read).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(node);
    await act(async () => reread.resolve(ok(null)));
    expect(button('Bookmark major')).toBe(node);
    expect(document.activeElement).toBe(node);
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

  it('follows a refreshed server-resolved state', async () => {
    let setInitial!: (value: boolean) => void;
    function Harness() {
      const [initial, set] = React.useState(false);
      setInitial = set;
      return <BookmarkButton table="user_bookmarked_majors" column="major_id" id="major-1" label="major" initialBookmarked={initial} />;
    }
    await mountComponent(<Harness />);
    expect(button('Bookmark major')).toBeTruthy();
    await act(async () => setInitial(true));
    expect(button('Remove bookmark').getAttribute('aria-pressed')).toBe('true');
    expect(io.read).not.toHaveBeenCalled();
  });

  it('compact server-resolved card reports deltas and rolls back a failed remove', async () => {
    const onToggle = vi.fn();
    io.remove.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });
    await mountComponent(
      <BookmarkButton table="user_bookmarked_schools" column="school_id" id={7} label="school" compact initialBookmarked onToggle={onToggle} />
    );
    expect(io.read).not.toHaveBeenCalled();
    await click(button('Remove bookmark'));
    expect(button('Remove bookmark').getAttribute('aria-pressed')).toBe('true');
    expect(onToggle).not.toHaveBeenCalled();
    expect(io.toast.error).toHaveBeenCalledWith('Failed to update bookmark. Please try again.');
    await click(button('Remove bookmark'));
    expect(onToggle).toHaveBeenLastCalledWith(-1);
    expect(button('Bookmark school').getAttribute('aria-pressed')).toBe('false');
    await click(button('Bookmark school'));
    expect(onToggle).toHaveBeenLastCalledWith(1);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('compact error button relies on its tooltip, not a second title tooltip', async () => {
    io.read.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await mountComponent(<BookmarkButton table="user_bookmarked_schools" column="school_id" id={7} label="school" compact />);
    expect(button('Could not load school bookmark. Retry').hasAttribute('title')).toBe(false);
  });

  it('lets a signed-out visitor reach the sign-in prompt instead of a pending button', async () => {
    io.auth = { user: null, loading: false };
    await mountMajor();
    await click(button('Bookmark major'));
    expect(io.toast.error).toHaveBeenCalledWith('Sign in to bookmark majors.');
    expect(io.read).not.toHaveBeenCalled();
  });
});
