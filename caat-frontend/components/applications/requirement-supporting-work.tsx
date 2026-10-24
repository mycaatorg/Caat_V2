'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { REQUIREMENT_WORK_CHANGED } from '@/lib/requirement-work-events';
import { LibraryDialog } from '@/components/evidence/library-dialog';
import { fetchRequirementWork, linkRequirementWork, unlinkRequirementWork, requirementReview, sourceForLink, type RequirementWork, type RequirementWorkLink, type WorkSource } from '@/lib/requirement-evidence';

type Requirement = { key: string; label: string };
type Target = { scholarshipId: string; item: Requirement };
type Context = {
  work: RequirementWork | null; disabled: boolean;
  open: (target: Target) => void; remove: (link: RequirementWorkLink) => void;
};
const WorkContext = createContext<Context | null>(null);
const sourceKey = (source: WorkSource) => `${source.kind}:${source.id}`;
const LOAD_ERROR = 'Could not load supporting work. Refresh to try again.';

/** One batch for the application's requirements. Refresh on opening a picker
 * and returning to the tab so source edits and cascaded removals are visible. */
export function RequirementWorkProvider({ applicationId, schoolId, children }: { applicationId: string; schoolId: number; children: ReactNode }) {
  const [work, setWork] = useState<RequirementWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const generation = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const supportRegion = useRef<HTMLDivElement | null>(null);
  const writing = useRef(false);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const next = await fetchRequirementWork(applicationId);
      if (request === generation.current) { setWork(next); setError(null); return true; }
      return false;
    } catch {
      if (request === generation.current) { setWork(null); setError(LOAD_ERROR); }
      return false;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [applicationId]);
  const cancelPending = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    void load();
    const refresh = () => { if (!writing.current) void load(); };
    const knownChange = () => { void load(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(REQUIREMENT_WORK_CHANGED, knownChange);
    return () => { cancelPending(); window.removeEventListener('focus', refresh); window.removeEventListener(REQUIREMENT_WORK_CHANGED, knownChange); };
  }, [load, cancelPending]);
  // Dialog unmount effects can run before the opener's disabled attribute is
  // removed. Restore after the commit, with a stable fallback during load errors.
  useEffect(() => {
    if (target || !returnFocus.current) return;
    const opener = returnFocus.current;
    returnFocus.current = null;
    if (opener.isConnected) opener.focus();
    if (document.activeElement !== opener) supportRegion.current?.focus();
  }, [target]);
  const open = (next: Target) => {
    returnFocus.current = document.activeElement as HTMLElement;
    setTarget(next); setSelected(''); setQuery(''); setError(null); void load();
  };
  const run = async (action: () => Promise<void>, onSuccess?: () => void) => {
    if (writing.current) return;
    writing.current = true; setBusy(true); setError(null);
    try { await action(); if (await load()) onSuccess?.(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this link. Try again.'); }
    finally { writing.current = false; setBusy(false); }
  };
  const remove = (link: RequirementWorkLink) => void run(() => unlinkRequirementWork(link));
  const alreadyLinked = (source: WorkSource) => !!target && !!work?.links.some(link => link.scholarship_id === target.scholarshipId && link.item_key === target.item.key && (source.kind === 'evidence' ? link.evidence_link_id === source.id : link.essay_draft_id === source.id));
  const selectedSource = work?.sources.find(source => sourceKey(source) === selected);
  const matches = work?.sources.filter(source => `${source.title} ${source.category}`.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
  const disabled = loading || busy || !work;

  return <WorkContext.Provider value={{ work, disabled, open, remove }}>
    <div ref={supportRegion} tabIndex={-1} aria-label="Supporting work" className="mb-3 space-y-2">
      <p className="text-xs text-muted-foreground">Connect supporting work to each requirement. Links follow your current work; you decide when to tick preparation.</p>
      <p className="text-xs text-muted-foreground">Moving or detaching a scholarship clears its requirement links. Your saved work and preparation ticks stay.</p>
      <Button size="sm" variant="ghost" disabled={loading || busy} onClick={() => void load()}>Refresh supporting work</Button>
      {loading && <p role="status" className="text-xs text-muted-foreground">Loading supporting work…</p>}
      {error && !target && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
    {children}
    {target && <LibraryDialog title="Link supporting work" description={target.item.label} busy={busy} onClose={() => { setTarget(null); setError(null); }}>
      <p className="text-sm text-muted-foreground">Choose a document or library item already linked to this application, or one of your saved essay drafts. Linking does not complete the requirement or send anything to the provider.</p>
      <p className="mt-2 text-xs text-muted-foreground">To add more choices, use this application&apos;s Documents or Activities, awards &amp; experience card, or save a draft in <Link href="/essays" className="underline">Essays</Link>.</p>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {loading ? <p role="status" className="my-4 text-sm">Loading supporting work…</p> : !work ? <Button className="mt-3" variant="outline" onClick={() => void load()}>Retry supporting work</Button> : <>
        <label className="mt-4 block text-sm">Find supporting work
          <input value={query} onChange={e => setQuery(e.target.value)} disabled={busy} className="mt-1 w-full rounded-md border bg-background px-3 py-2" placeholder="Search titles or types" />
        </label>
        <fieldset disabled={busy} className="mt-3 min-w-0 space-y-2">
          <legend className="sr-only">Supporting work choices</legend>
          {matches.map(source => <label key={sourceKey(source)} className="flex min-w-0 items-start gap-2 rounded-md border p-3 text-sm">
            <input type="radio" name="supporting-work" className="mt-1 shrink-0" checked={selected === sourceKey(source)} disabled={alreadyLinked(source)} onChange={() => setSelected(sourceKey(source))} />
            <span className="min-w-0 break-words"><span className="block font-medium">{source.title}</span><span className="text-xs text-muted-foreground">{source.category}{alreadyLinked(source) ? ' · Already linked' : ''}</span></span>
          </label>)}
          {!matches.length && <p className="text-sm text-muted-foreground">{work.sources.length ? 'No matching work. Try another search.' : 'No supporting work available yet. Add work using the cards above or save an essay draft.'}</p>}
        </fieldset>
        {selectedSource && <WorkPreview source={selectedSource} />}
      </>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={disabled || !selectedSource || alreadyLinked(selectedSource)} onClick={() => {
          if (!selectedSource) return;
          void run(async () => {
            await linkRequirementWork({ applicationId, schoolId, scholarshipId: target.scholarshipId, itemKey: target.item.key, label: target.item.label, source: { kind: selectedSource.kind, id: selectedSource.id } });
          }, () => { setTarget(null); setSelected(''); });
        }}>{busy ? 'Saving…' : 'Link selected work'}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => { setTarget(null); setError(null); }}>Cancel</Button>
      </div>
    </LibraryDialog>}
  </WorkContext.Provider>;
}

function WorkPreview({ source }: { source: WorkSource }) {
  return <div className="mt-3 min-w-0 rounded-md bg-muted/40 p-3 text-sm">
    <p className="text-xs font-medium">{source.tailored ? 'Application-specific version' : 'Current saved work'}</p>
    <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">{source.body || 'No text saved yet.'}</p>
    <p className="mt-2 text-xs text-muted-foreground">This link follows changes to the work. It is not a submitted copy.</p>
    <Link href={source.href} className="mt-2 inline-block text-xs underline">{source.kind === 'draft' ? 'Open essay workspace' : source.category === 'Document' ? 'Open Documents' : 'Open library source'}</Link>
  </div>;
}
function LinkedWork({ link, changed = false }: { link: RequirementWorkLink; changed?: boolean }) {
  const context = useContext(WorkContext)!;
  const source = sourceForLink(link, context.work?.sources ?? []);
  return <li data-requirement-link={link.id} className="min-w-0 rounded-md border bg-background p-2 text-xs">
    {changed && <p className="mb-2 text-amber-800 dark:text-amber-300">Requirement changed. Previously: {link.requirement_label}. Check the provider, then remove and re-link if this work still applies.</p>}
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 flex-1 break-words font-medium">{source?.title ?? 'Supporting work unavailable'}</span>
      <Button size="sm" variant="ghost" disabled={context.disabled} aria-label={`Remove supporting link: ${source?.title ?? 'unavailable work'}`} onClick={() => context.remove(link)}>Remove link</Button>
    </div>
    {source ? <details><summary className="cursor-pointer">View {source.category.toLowerCase()}</summary><WorkPreview source={source} /></details> : <p>Refresh to check whether the source was removed. Removing this link leaves other work untouched.</p>}
  </li>;
}
export function RequirementSupportingWork({ scholarshipId, item }: Target) {
  const context = useContext(WorkContext);
  if (!context) return null;
  const links = context.work?.links.filter(link => link.scholarship_id === scholarshipId && link.item_key === item.key) ?? [];
  return <div className="mt-2 min-w-0">
    {!!links.length && <ul className="space-y-2">{links.map(link => <LinkedWork key={link.id} link={link} changed={requirementReview(link, [item]) === 'changed'} />)}</ul>}
    <Button size="sm" variant="ghost" className="h-auto max-w-full whitespace-normal px-0 py-2 text-xs" disabled={context.disabled} aria-label={`Link supporting work: ${item.label}`} onClick={() => context.open({ scholarshipId, item })}>+ Link supporting work{links.length ? ` (${links.length} linked)` : ''}</Button>
  </div>;
}
export function RemovedRequirementWork({ scholarshipId, items }: { scholarshipId: string; items: Requirement[] }) {
  const context = useContext(WorkContext);
  if (!context?.work) return null;
  const removed = context.work.links.filter(link => link.scholarship_id === scholarshipId && requirementReview(link, items) === 'removed');
  if (!removed.length) return null;
  return <section aria-label="Requirements no longer listed" className="mt-4 min-w-0 rounded-md border border-amber-300 p-3">
    <h4 className="text-sm font-medium">Requirements no longer listed</h4>
    <p className="mt-1 text-xs text-muted-foreground">The recorded checklist changed. Review this work with the provider before linking it to a current requirement.</p>
    <ul className="mt-2 space-y-3">{removed.map(link => <li key={link.id} className="min-w-0"><p className="mb-1 break-words text-xs">{link.requirement_label}</p><ul><LinkedWork link={link} /></ul></li>)}</ul>
  </section>;
}
