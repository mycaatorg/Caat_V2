import type { DocumentRow } from '@/app/(main)/documents/api';
export type DocumentSort = 'newest' | 'oldest' | 'name';
export type DocumentStatusFilter = 'all' | 'pending_review' | 'verified' | 'resubmit';

export function selectDocuments(rows: DocumentRow[], query: string, category: string, status: DocumentStatusFilter, sort: DocumentSort): DocumentRow[] {
  const search = query.trim().toLowerCase();
  return rows.filter(row => row.file_name.toLowerCase().includes(search)
    && (category === 'all' || row.category === category)
    && (status === 'all' || row.status === status))
    .sort((a, b) => {
      const order = sort === 'name' ? a.file_name.localeCompare(b.file_name)
        : sort === 'oldest' ? a.uploaded_at.localeCompare(b.uploaded_at) : b.uploaded_at.localeCompare(a.uploaded_at);
      return order || a.id.localeCompare(b.id);
    });
}
