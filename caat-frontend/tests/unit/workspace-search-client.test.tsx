// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { button, change, click, deferred, flush, mountComponent, unmountAll } from './dom-helpers';
import type { WorkspaceItem } from '@/lib/workspace-search';

const io = vi.hoisted(() => ({ read: vi.fn(), auth: { user: { id: 'owner' } as { id: string } | null, loading: false } }));
vi.mock('@/lib/workspace-search', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/workspace-search')>(), readWorkspaceIndex: io.read }));
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/providers/AuthContext', () => ({ useAuth: () => io.auth }));
import WorkspaceSearchClient from '@/app/(main)/workspace/search/client';

const item = (i: number, kind: WorkspaceItem['kind'] = 'document'): WorkspaceItem => ({ id: String(i), kind, title: `Sydney ${String(i).padStart(2, '0')}`, detail: 'Saved work', href: `/documents?document=${i}` });
const input = () => document.querySelector('input[aria-label="Search your work"]') as HTMLInputElement;
beforeEach(() => { vi.clearAllMocks(); io.auth = { user: { id: 'owner' }, loading: false }; io.read.mockResolvedValue(Array.from({ length: 25 }, (_, i) => item(i))); });
afterEach(unmountAll);

it('searches metadata with counts, kind filters and pagination that resets on query changes', async () => {
  io.read.mockResolvedValue([...Array.from({ length: 25 }, (_, i) => item(i)), item(30, 'essay')]);
  const container = await mountComponent(<WorkspaceSearchClient />); await flush();
  expect(io.read).toHaveBeenCalledWith({}, 'owner');
  expect(container.textContent).toContain('at least 2 characters');
  await change(input(), 'sydney');
  expect(container.querySelectorAll('[data-search-result]')).toHaveLength(20);
  expect(container.textContent).toContain('26 results');
  await click(button('Next results')); expect(container.querySelectorAll('[data-search-result]')).toHaveLength(6);
  await change(input(), 'Sydney 00'); expect(container.querySelectorAll('[data-search-result]')).toHaveLength(1);
  await change(input(), 'sydney'); await click(button('Essay drafts (1)'));
  expect(container.querySelectorAll('[data-search-result]')).toHaveLength(1);
  expect(container.querySelector('[data-search-result]')?.textContent).toContain('Sydney 30');
});

it('shows an honest read failure and retry without zero-result claims', async () => {
  io.read.mockRejectedValueOnce(new Error('private backend detail'));
  const container = await mountComponent(<WorkspaceSearchClient />); await flush();
  expect(container.textContent).toContain('Could not load your workspace');
  expect(container.textContent).not.toContain('0 results');
  expect(container.textContent).not.toContain('private backend detail');
  await click(button('Retry')); await flush(); await change(input(), 'Sydney');
  expect(container.textContent).toContain('25 results');
});

it('discards an old account response and clears its query and results on account change', async () => {
  const old = deferred<WorkspaceItem[]>(); io.read.mockReturnValueOnce(old.promise).mockResolvedValueOnce([item(90)]);
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<WorkspaceSearchClient />));
    io.auth = { user: { id: 'new-owner' }, loading: false };
    await act(async () => root.render(<WorkspaceSearchClient />)); await flush();
    await change(input(), 'Sydney');
    expect(container.textContent).toContain('Sydney 90');
    await act(async () => old.resolve([item(1)])); await flush();
    expect(container.textContent).not.toContain('Sydney 01');
    io.auth = { user: null, loading: false };
    await act(async () => root.render(<WorkspaceSearchClient />));
    expect(container.textContent).not.toContain('Sydney 90');
    expect(container.textContent).toContain('Sign in');
  } finally { act(() => root.unmount()); }
});
