import { supabase } from '@/lib/supabase/client';
import { evidenceUserId, type EvidenceItem } from '@/lib/evidence-items';
const TABLE = 'application_evidence_links';
const COLUMNS = 'id, application_id, evidence_item_id, revision, source_revision, tailored_at, tailored_title, tailored_body, evidence_items(*)';
export interface ItemLink {
  id: string; applicationId: string; itemId: string; revision: string; sourceRevision: string | null;
  tailoredAt: string | null; tailoredTitle: string | null; tailoredBody: string | null; item: EvidenceItem | null;
}
type LinkRow = { id: string; application_id: string; evidence_item_id: string; revision: string; source_revision: string | null; tailored_at: string | null; tailored_title: string | null; tailored_body: string | null; evidence_items: EvidenceItem | null };
const CHANGED = 'This link changed in another tab or was removed. Refresh the application before trying again.';
function map(row: LinkRow): ItemLink {
  return { id: row.id, applicationId: row.application_id, itemId: row.evidence_item_id, revision: row.revision, sourceRevision: row.source_revision, tailoredAt: row.tailored_at, tailoredTitle: row.tailored_title, tailoredBody: row.tailored_body, item: row.evidence_items };
}
function one(data: unknown, message = CHANGED): ItemLink {
  const rows = data as LinkRow[] | null;
  if (rows?.length !== 1) throw new Error(message);
  return map(rows[0]);
}
export async function fetchItemLinks(applicationId: string): Promise<ItemLink[]> {
  const id = await evidenceUserId();
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('user_id', id).eq('application_id', applicationId).eq('kind', 'item').order('created_at', { ascending: true });
  if (error) throw new Error('Could not load your linked activities, awards and experience.');
  return ((data ?? []) as unknown as LinkRow[]).map(map);
}
export async function linkItem(applicationId: string, itemId: string): Promise<ItemLink> {
  const id = await evidenceUserId();
  const { data, error } = await supabase.from(TABLE).insert({ user_id: id, application_id: applicationId, kind: 'item', evidence_item_id: itemId }).select(COLUMNS);
  if (error?.code === '23505') {
    const existing = await supabase.from(TABLE).select(COLUMNS).eq('user_id', id).eq('application_id', applicationId).eq('evidence_item_id', itemId);
    if (!existing.error) return one(existing.data, 'Could not read the existing link. Retry.');
  }
  if (error) throw new Error('Could not link this item. Refresh your library and try again.');
  return one(data, 'Could not link this item. Try again.');
}
export async function unlinkItem(seen: ItemLink) {
  const id = await evidenceUserId();
  const { data, error } = await supabase.from(TABLE).delete().eq('user_id', id).eq('id', seen.id).eq('revision', seen.revision).select('id');
  if (error) throw new Error('Could not unlink this item. Try again.');
  if (data?.length !== 1) throw new Error(CHANGED);
}
async function write(seen: ItemLink, patch: { tailored_title?: string | null; tailored_body?: string | null; source_revision?: string | null }): Promise<ItemLink> {
  const id = await evidenceUserId();
  const { data, error } = await supabase.from(TABLE).update(patch).eq('user_id', id).eq('id', seen.id).eq('revision', seen.revision).select(COLUMNS);
  if (error) throw new Error('Could not save this change. Try again.');
  return one(data);
}
export function tailorItem(seen: ItemLink, input: {title: string; body: string}) {
  const title = input.title.trim(), body = input.body.trim();
  if (!title || title.length > 200 || body.length > 10000) return Promise.reject(new Error('Add a title up to 200 characters and a description up to 10,000 characters.'));
  if (!seen.item) return Promise.reject(new Error('The library item is unavailable. Refresh before tailoring.'));
  return write(seen, { tailored_title: title, tailored_body: body || null, source_revision: seen.item.revision });
}
export function keepItemTailoring(seen: ItemLink) {
  if (!seen.tailoredAt || !seen.item) return Promise.reject(new Error('Refresh this item before keeping the tailoring.'));
  return write(seen, { source_revision: seen.item.revision });
}
export function resetItemTailoring(seen: ItemLink) {
  return write(seen, { tailored_title: null, tailored_body: null, source_revision: null });
}
export function itemSourceChanged(link: ItemLink) {
  return !!(link.tailoredAt && link.item && link.sourceRevision !== link.item.revision);
}
