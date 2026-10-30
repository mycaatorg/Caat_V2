import type { EvidenceItem, EvidenceKind, ItemUsage } from '@/lib/evidence-items';
export type LibraryFilters = { query?: string; kind?: 'all' | EvidenceKind; usage?: 'all' | 'linked' | 'unlinked'; sort?: 'recent' | 'oldest' | 'name' };
export function selectLibrary(items: EvidenceItem[], usage: Record<string, ItemUsage[]>, filters: LibraryFilters): EvidenceItem[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? '';
  return items.filter(item => {
    if (filters.kind && filters.kind !== 'all' && item.kind !== filters.kind) return false;
    const linked = (usage[item.id]?.length ?? 0) > 0;
    if (filters.usage === 'linked' && !linked || filters.usage === 'unlinked' && linked) return false;
    return !query || [item.title, item.organisation, item.role, item.description].some(value => value?.toLocaleLowerCase().includes(query));
  }).sort((a, b) => {
    if (filters.sort === 'name') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    const left = Date.parse(a.created_at), right = Date.parse(b.created_at);
    if (Number.isFinite(left) !== Number.isFinite(right)) return Number.isFinite(left) ? -1 : 1;
    const delta = Number.isFinite(left) ? left - right : 0;
    return (filters.sort === 'oldest' ? delta : -delta) || a.id.localeCompare(b.id);
  });
}
