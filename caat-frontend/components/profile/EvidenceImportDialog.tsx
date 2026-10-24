"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LibraryDialog } from '@/components/evidence/library-dialog';
import { createEvidenceItem, type EvidenceItem } from '@/lib/evidence-items';
import { fetchImportCandidates, type ImportCandidate } from '@/lib/evidence-imports';
export function EvidenceImportDialog({ existingKeys, onImported, onClose }: { existingKeys: Set<string>; onImported: (item: EvidenceItem)=>void; onClose: ()=>void }) {
  const [candidates,setCandidates]=useState<ImportCandidate[] | null>(null), [loadError,setLoadError]=useState(false), [retry,setRetry]=useState(0);
  const [busy,setBusy]=useState<string | null>(null), [error,setError]=useState<string | null>(null);
  useEffect(()=>{let active=true;fetchImportCandidates().then(data=>{if(active){setCandidates(data);setLoadError(false);}}).catch(()=>{if(active)setLoadError(true);});return()=>{active=false;};},[retry]);
  async function add(candidate:ImportCandidate) {
    if(busy)return;setBusy(candidate.key);setError(null);
    try {onImported(await createEvidenceItem(candidate.input,candidate.key));}catch(e){setError(e instanceof Error?e.message:'Could not import this item. Try again.');}finally{setBusy(null);}
  }
  return <LibraryDialog title="Import existing work" description="Choose activities or structured resume experience to copy into your library. Dates and notes keep their wording; resume formatting is converted to text. Your profile and resumes stay unchanged." busy={busy!==null} onClose={onClose}>
    {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
    {loadError ? <div role="alert"><p>Could not load your existing work.</p><Button variant="outline" onClick={()=>{setLoadError(false);setRetry(n=>n+1);}}>Retry imports</Button></div> : candidates===null ? <p role="status">Loading existing work…</p> : candidates.length===0 ? <p className="text-sm text-muted-foreground">No activities or structured resume experience to import yet. You can add a library item directly.</p> : <ul className="divide-y">
      {candidates.map(c=><li key={c.key} className="py-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium break-words">{c.input.title}</p><p className="text-xs text-muted-foreground">{c.label}</p></div><Button size="sm" variant="outline" disabled={busy!==null || existingKeys.has(c.key)} aria-label={`Import ${c.input.title}`} onClick={()=>void add(c)}>{existingKeys.has(c.key)?'Imported':busy===c.key?'Importing…':'Import'}</Button></div>
        {c.input.description && <p className="mt-2 whitespace-pre-line break-words text-sm text-muted-foreground">{c.input.description}</p>}
      </li>)}
    </ul>}
  </LibraryDialog>;
}
