"use client";
import { useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LibraryDialog } from '@/components/evidence/library-dialog';
import { createEvidenceItem, updateEvidenceItem, EMPTY_EVIDENCE_INPUT, type EvidenceItem, type EvidenceItemInput } from '@/lib/evidence-items';
export function EvidenceItemEditor({ item, usedCount, onSaved, onClose, returnFocusRef, fallbackFocusRef }: { item?: EvidenceItem; usedCount: number; onSaved: (item: EvidenceItem) => void; onClose: () => void; returnFocusRef: RefObject<HTMLElement|null>; fallbackFocusRef: RefObject<HTMLElement|null> }) {
  const [draft, setDraft] = useState<EvidenceItemInput>(() => item ? { kind: item.kind, title: item.title, organisation: item.organisation, role: item.role, start_date: item.start_date, end_date: item.end_date, is_current: item.is_current, description: item.description } : { ...EMPTY_EVIDENCE_INPUT });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<EvidenceItemInput>) => setDraft(cur => ({ ...cur, ...patch }));
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(null);
    try { onSaved(item ? await updateEvidenceItem(item, draft) : await createEvidenceItem(draft)); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this item. Try again.'); }
    finally { setBusy(false); }
  }
  return <LibraryDialog returnFocusRef={returnFocusRef} fallbackFocusRef={fallbackFocusRef} title={item ? 'Edit library item' : 'Add library item'} description={usedCount ? `Used in ${usedCount} applications. Changes appear in applications following the library; tailored versions keep their text.` : 'Save something you have done, then reuse it in your applications.'} busy={busy} onClose={onClose}>
    <form onSubmit={save} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm font-medium">Type
          <select value={draft.kind} onChange={e => change({kind: e.target.value as EvidenceItemInput['kind']})} className="mt-1 w-full rounded-md border bg-background p-2">
            <option value="activity">Activity</option><option value="award">Award</option><option value="experience">Experience</option>
          </select>
        </label>
        <label className="block text-sm font-medium">Title<Input className="mt-1" value={draft.title} maxLength={200} required onChange={e=>change({title:e.target.value})} placeholder="For example, school debating captain" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Organisation<Input className="mt-1" value={draft.organisation ?? ''} maxLength={200} onChange={e=>change({organisation:e.target.value})} /></label>
          <label className="block text-sm font-medium">Role<Input className="mt-1" value={draft.role ?? ''} maxLength={200} onChange={e=>change({role:e.target.value})} /></label>
          <label className="block text-sm font-medium">Start date<Input type="date" className="mt-1" value={draft.start_date ?? ''} onChange={e=>change({start_date:e.target.value})} /></label>
          <label className="block text-sm font-medium">End date<Input type="date" className="mt-1" disabled={draft.is_current} value={draft.end_date ?? ''} onChange={e=>change({end_date:e.target.value})} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_current} onChange={e=>change({is_current:e.target.checked,end_date:e.target.checked ? null : draft.end_date})} />I am still doing this</label>
        <label className="block text-sm font-medium">Description<Textarea className="mt-1 min-h-28" value={draft.description} maxLength={10000} onChange={e=>change({description:e.target.value})} placeholder="What you did, contributed or learned" /></label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy} aria-label="Save item">{busy ? 'Saving…' : 'Save item'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button></div>
    </form>
  </LibraryDialog>;
}
