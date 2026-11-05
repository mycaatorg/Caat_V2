// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useScholarshipComparison } from '@/components/scholarships/use-scholarship-comparison';
import type { ScholarshipRow } from '@/types/scholarships';
const rows = ['one', 'two', 'three', 'four'].map(id => ({ id, title: id } as ScholarshipRow));
let root: Root;
let current: ReturnType<typeof useScholarshipComparison>;
function Harness({ page, owner }: { page: ScholarshipRow[]; owner: string | null }) { const value = useScholarshipComparison(page, owner); React.useEffect(() => { current = value; }); return null; }
async function render(page = rows, owner: string | null = 'student-a') {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  if (!root) { const container = document.createElement('div'); document.body.append(container); root = createRoot(container); }
  await act(async () => root.render(<Harness page={page} owner={owner} />));
}
afterEach(() => { if (root) act(() => root.unmount()); root = undefined as unknown as Root; document.body.innerHTML = ''; });
describe('temporary scholarship comparison selection', () => {
  it('enforces three exact records even when clicks share a render, and toggles without duplicates', async () => {
    await render(); await act(async () => { for (const row of rows) current.toggle(row); });
    expect(current.selected.map(row => row.id)).toEqual(['one', 'two', 'three']);
    await act(async () => current.toggle(rows[1]));
    expect(current.selected.map(row => row.id)).toEqual(['one', 'three']);
  });
  it('retains off-page records across filtering and permits a third from another page', async () => {
    await render(rows.slice(0, 2)); await act(async () => { current.toggle(rows[0]); current.toggle(rows[1]); });
    await render(rows.slice(2)); await act(async () => current.toggle(rows[2]));
    expect(current.selected.map(row => row.id)).toEqual(['one', 'two', 'three']);
  });
  it('refreshes selected public facts when a record reappears, without dropping off-page choices', async () => {
    await render(); await act(async () => { current.toggle(rows[0]); current.toggle(rows[1]); });
    await render([{ ...rows[0], title: 'Updated amount and title' }]);
    expect(current.selected.map(row => row.title)).toEqual(['Updated amount and title', 'two']);
  });
  it('clears on account changes and never resurrects an earlier account selection', async () => {
    await render(); await act(async () => current.toggle(rows[0])); expect(current.selected).toHaveLength(1);
    await render(rows, 'student-b'); expect(current.selected).toEqual([]);
    await render(rows, 'student-a'); expect(current.selected).toEqual([]);
  });
  it('clears on sign-out and ignores signed-out toggles', async () => {
    await render(); await act(async () => current.toggle(rows[0])); expect(current.selected).toHaveLength(1); await render(rows, null);
    await act(async () => current.toggle(rows[1])); expect(current.selected).toEqual([]);
  });
  it('removes one exact record and clears the remaining selection', async () => {
    await render(); await act(async () => { current.toggle(rows[0]); current.toggle(rows[1]); });
    await act(async () => current.remove(rows[0].id)); expect(current.selected.map(row => row.id)).toEqual(['two']);
    await act(async () => current.clear()); expect(current.selected).toEqual([]);
  });
});
