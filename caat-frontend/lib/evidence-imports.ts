import { evidencePages } from '@/lib/evidence-pagination';
import { supabase } from '@/lib/supabase/client';
import { htmlToText } from '@/lib/html-text';
import { EMPTY_EVIDENCE_INPUT, evidenceUserId, validateEvidenceInput, type EvidenceItemInput } from '@/lib/evidence-items';
export interface ImportCandidate { key: string; label: string; input: EvidenceItemInput }
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function activityCandidates(values: unknown): ImportCandidate[] {
  if (!Array.isArray(values)) return [];
  const result = new Map<string, ImportCandidate>();
  for (const value of values) {
    const title = text(value);
    if (!title) continue;
    const key = `activity:${title.toLowerCase().replace(/\s+/g, ' ')}`;
    if (!result.has(key)) result.set(key, { key, label: 'From profile activities', input: { ...EMPTY_EVIDENCE_INPUT, title } });
  }
  return [...result.values()];
}
export function experienceCandidates(sectionId: string, data: unknown): ImportCandidate[] {
  const entries = (data as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) return [];
  const result = new Map<string, ImportCandidate>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = text(e.id), role = text(e.title), organisation = text(e.company), title = role || organisation;
    if (!id || !title) continue;
    // Resume dates are free text (e.g. "Summer 2024"). Preserve them verbatim.
    const dates = [text(e.startDate), e.current === true ? 'Present' : text(e.endDate)].filter(Boolean).join(' – ');
    const description = typeof e.description === 'string' ? htmlToText(e.description.replace(/<\/(p|li|div)>|<br\s*\/?\s*>/gi, '\n$&')) : Array.isArray(e.bullets) ? e.bullets.map(text).filter(Boolean).join('\n') : '';
    const key = `resume:${sectionId}:${id}`;
    result.set(key, { key, label: 'From resume experience', input: { ...EMPTY_EVIDENCE_INPUT, kind: 'experience', title, role: role || null, organisation: organisation || null, description: [dates, text(e.location), description].filter(Boolean).join('\n') } });
  }
  return [...result.values()];
}
export async function fetchImportCandidates(): Promise<ImportCandidate[]> {
  const id = await evidenceUserId();
  const [profile, sections] = await Promise.all([
    supabase.from('profiles').select('activities').eq('id', id),
    evidencePages((from,to) => supabase.from('resume_sections').select('id, structured_data, mode, resumes!inner(user_id, title)').eq('resumes.user_id', id).eq('section_key', 'experience').order('id').range(from,to), 'Could not load resume experience. Try again.'),
  ]);
  if (profile.error) throw new Error('Could not load activities and resume experience. Try again.');
  const result = activityCandidates(profile.data?.[0]?.activities);
  for (const section of sections) {
    if (section.mode === 'free') continue;
    for (const candidate of experienceCandidates(section.id, section.structured_data)) result.push({ ...candidate, label: `From resume: ${section.resumes?.title || 'Untitled'}` });
  }
  return result;
}

export function importCandidateProblem(candidate: ImportCandidate): string | null {
  try { validateEvidenceInput(candidate.input); if (candidate.key.length > 500) throw new Error('This entry is too long.'); return null; }
  catch (e) { return `${e instanceof Error ? e.message : 'This entry cannot be imported.'} Edit the original entry or add a shorter library item manually. Nothing has been copied or shortened.`; }
}
