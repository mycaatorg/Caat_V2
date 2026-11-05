'use client';
import { useState } from 'react';
import type { ScholarshipRow } from '@/types/scholarships';

export const MAX_SCHOLARSHIP_COMPARISON = 3;
export function useScholarshipComparison(rows: ScholarshipRow[], owner: string | null) {
  const [state, setState] = useState<{ owner: string | null; page: ScholarshipRow[]; rows: ScholarshipRow[] }>({ owner, page: rows, rows: [] });
  // Adjust the selection before rendering children when account/page props
  // change. No previous-owner selection is rendered, even for a single frame.
  if (state.owner !== owner) setState({ owner, page: rows, rows: [] });
  else if (state.page !== rows) {
    const latest = new Map(rows.map(row => [row.id, row]));
    setState({ owner, page: rows, rows: state.rows.map(row => latest.get(row.id) ?? row) });
  }
  const selected = state.owner === owner && owner !== null ? state.rows : [];
  function toggle(row: ScholarshipRow) {
    if (!owner) return;
    setState(previous => {
      const chosen = previous.owner === owner ? previous.rows : [];
      return { owner, page: rows, rows: chosen.some(item => item.id === row.id)
        ? chosen.filter(item => item.id !== row.id)
        : chosen.length < MAX_SCHOLARSHIP_COMPARISON ? [...chosen, row] : chosen };
    });
  }
  function remove(id: string) { setState(previous => ({ owner, page: rows, rows: previous.owner === owner ? previous.rows.filter(row => row.id !== id) : [] })); }
  function clear() { setState({ owner, page: rows, rows: [] }); }
  return { selected, toggle, remove, clear };
}
