import { evidencePages } from '@/lib/evidence-pagination';
import { supabase } from '@/lib/supabase/client';
import { getClientUserId } from '@/lib/current-user';
import type { Database } from '@/types/database';
export const EVIDENCE_KINDS = ['activity', 'award', 'experience'] as const;
export type EvidenceKind = typeof EVIDENCE_KINDS[number];
export type EvidenceItem = Omit<Database['public']['Tables']['evidence_items']['Row'], 'kind'> & { kind: EvidenceKind };
export type EvidenceItemInput = Pick<EvidenceItem, 'kind' | 'title' | 'organisation' | 'role' | 'start_date' | 'end_date' | 'is_current' | 'description'>;
export type ItemUsage = { applicationId: string; schoolName: string; tailored: boolean };
export const EMPTY_EVIDENCE_INPUT: EvidenceItemInput = { kind: 'activity', title: '', organisation: null, role: null, start_date: null, end_date: null, is_current: false, description: '' };
export const ITEM_CHANGED = 'This item changed in another tab or was removed. Reload the library before trying again.';
export async function evidenceUserId() {
  const id = await getClientUserId();
  if (!id) throw new Error('Not authenticated');
  return id;
}
function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function validateEvidenceInput(input: EvidenceItemInput): EvidenceItemInput {
  const clean = { ...input, title: input.title.trim(), organisation: input.organisation?.trim() || null, role: input.role?.trim() || null, description: input.description.trim(), start_date: input.start_date || null, end_date: input.is_current ? null : input.end_date || null };
  if (!EVIDENCE_KINDS.includes(clean.kind)) throw new Error('Choose an activity, award or experience.');
  if (!clean.title || clean.title.length > 200) throw new Error('Use a title between 1 and 200 characters.');
  if ((clean.organisation?.length ?? 0) > 200 || (clean.role?.length ?? 0) > 200) throw new Error('Keep the organisation and role to 200 characters each.');
  if (clean.description.length > 10000) throw new Error('Keep the description to 10,000 characters.');
  if ([clean.start_date, clean.end_date].some(d => d && !validDate(d))) throw new Error('Enter valid dates.');
  if (clean.start_date && clean.end_date && clean.end_date < clean.start_date) throw new Error('The end date must be on or after the start date.');
  return clean;
}
function oneItem(data: unknown, message: string): EvidenceItem {
  const rows = data as EvidenceItem[] | null;
  if (rows?.length !== 1) throw new Error(message);
  return rows[0];
}
export async function listEvidenceItems(): Promise<EvidenceItem[]> {
  const id = await evidenceUserId();
  const data = await evidencePages((from,to) => supabase.from('evidence_items').select('*').eq('user_id', id).order('created_at', { ascending: false }).order('id').range(from,to), 'Could not load your library. Try again.');
  return data as EvidenceItem[];
}
export async function createEvidenceItem(input: EvidenceItemInput, originKey?: string): Promise<EvidenceItem> {
  const clean = validateEvidenceInput(input);
  if (originKey && originKey.length > 500) throw new Error('This import has an invalid identifier.');
  const id = await evidenceUserId();
  const { data, error } = await supabase.from('evidence_items').insert({ ...clean, user_id: id, origin_key: originKey ?? null }).select('*');
  if (error?.code === '23505' && originKey) {
    const existing = await supabase.from('evidence_items').select('*').eq('user_id', id).eq('origin_key', originKey);
    if (!existing.error) return oneItem(existing.data, 'Could not read the existing import. Retry.');
  }
  if (error) throw new Error('Could not save this item. Try again.');
  return oneItem(data, 'Could not save this item. Try again.');
}
export async function updateEvidenceItem(seen: EvidenceItem, input: EvidenceItemInput): Promise<EvidenceItem> {
  const clean = validateEvidenceInput(input), id = await evidenceUserId();
  const { data, error } = await supabase.from('evidence_items').update(clean).eq('user_id', id).eq('id', seen.id).eq('revision', seen.revision).select('*');
  if (error) throw new Error('Could not save your changes. Try again.');
  return oneItem(data, ITEM_CHANGED);
}
export async function deleteEvidenceItem(seen: EvidenceItem): Promise<void> {
  const id = await evidenceUserId();
  const { data, error } = await supabase.from('evidence_items').delete().eq('user_id', id).eq('id', seen.id).eq('revision', seen.revision).select('id');
  if (error?.code === '23503') throw new Error('Unlink this item from its applications before deleting it. Refresh where it is used to see the latest links.');
  if (error) throw new Error('Could not delete this item. Try again.');
  if (data?.length !== 1) throw new Error(ITEM_CHANGED);
}
export async function fetchItemUsage(): Promise<Record<string, ItemUsage[]>> {
  const id = await evidenceUserId();
  const data = await evidencePages((from,to) => supabase.from('application_evidence_links').select('evidence_item_id, application_id, tailored_at, user_school_applications!inner(schools(name))').eq('user_id', id).eq('kind', 'item').order('id').range(from,to), 'Could not load where your library items are used.');
  const usage: Record<string, ItemUsage[]> = {};
  for (const row of data ?? []) {
    if (!row.evidence_item_id) continue;
    (usage[row.evidence_item_id] ??= []).push({ applicationId: row.application_id, schoolName: row.user_school_applications?.schools?.name ?? 'Application', tailored: row.tailored_at !== null });
  }
  return usage;
}
/** Complete display text; tailoring snapshots this instead of falling back to live fields. */
export function evidenceText(item: EvidenceItemInput): string {
  const dates = [item.start_date, item.is_current ? 'Present' : item.end_date].filter(Boolean).join(' – ');
  return [[item.role, item.organisation].filter(Boolean).join(' — '), dates, item.description].filter(Boolean).join('\n');
}
