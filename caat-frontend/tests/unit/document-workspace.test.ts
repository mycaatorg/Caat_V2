import { expect, it } from 'vitest';
import type { DocumentRow } from '@/app/(main)/documents/api';
import { selectDocuments } from '@/lib/document-workspace';
const row = (id: string, file_name: string, uploaded_at: string, category = 'transcripts', status = 'pending_review') => ({
  id, file_name, uploaded_at, category, status, user_id: 'owner', storage_path: `${id}.pdf`, mime_type: 'application/pdf', file_size: 10,
  review_notes: null, created_at: uploaded_at, updated_at: uploaded_at,
} satisfies DocumentRow);
it('combines filename, category and status filters without editing data', () => {
  const rows = [row('a','School Transcript.pdf','2026-01-01'),row('b','School Passport.pdf','2026-01-02','identity','verified')];
  expect(selectDocuments(rows,' SCHOOL ','identity','verified','newest').map(row => row.id)).toEqual(['b']);
  expect(selectDocuments(rows,'school','identity','resubmit','newest')).toEqual([]);
  expect(rows).toHaveLength(2);
});
it('orders newest, oldest and name with stable id ties and no mutation', () => {
  const rows = [row('b','Beta.pdf','2026-01-02'),row('a','Alpha.pdf','2026-01-02'),row('c','Zeta.pdf','2026-01-01')];
  expect(selectDocuments(rows,'','all','all','newest').map(row => row.id)).toEqual(['a','b','c']);
  expect(selectDocuments(rows,'','all','all','oldest').map(row => row.id)).toEqual(['c','a','b']);
  expect(selectDocuments(rows,'','all','all','name').map(row => row.id)).toEqual(['a','b','c']);
  expect(rows.map(row => row.id)).toEqual(['b','a','c']);
});
