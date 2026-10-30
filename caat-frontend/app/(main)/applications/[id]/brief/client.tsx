'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthContext';
import { Button } from '@/components/ui/button';
import { fetchApplicationHub, type ApplicationHub } from '../api';
import { buildApplicationBrief } from '@/lib/application-brief';
import { ApplicationBriefDocument } from '@/components/applications/application-brief-document';
export default function ApplicationBriefClient({applicationId}:{applicationId:string}) {
 const {user,loading}=useAuth();
 if(loading)return <p role="status" className="p-6">Loading your application brief…</p>;
 if(!user)return <p className="p-6"><Link className="underline" href={`/login?next=${encodeURIComponent(`/applications/${applicationId}/brief`)}`}>Sign in to view this application brief</Link></p>;
 return <BriefWorkspace key={`${user.id}:${applicationId}`} applicationId={applicationId}/>;
}
function BriefWorkspace({applicationId}:{applicationId:string}) {
 const [snapshot,setSnapshot]=useState<{hub:ApplicationHub;preparedAt:string}|null>(null);
 const [error,setError]=useState(false),[version,setVersion]=useState(0),[includeNotes,setIncludeNotes]=useState(false);
 useEffect(()=>{let active=true;fetchApplicationHub(applicationId).then(hub=>{if(active)setSnapshot({hub,preparedAt:new Date().toISOString()});}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[applicationId,version]);
 function reload(){setSnapshot(null);setError(false);setVersion(v=>v+1);}
 const back=<Link className="text-sm underline underline-offset-4" href={`/applications/${encodeURIComponent(applicationId)}`}>Back to application</Link>;
 if(error)return <div className="space-y-4 p-6"><p role="alert">Could not load this application brief. Try again.</p><Button onClick={reload}>Retry brief</Button><div>{back}</div></div>;
 if(!snapshot)return <p role="status" className="p-6">Loading your application brief…</p>;
 const brief=buildApplicationBrief(snapshot.hub,{preparedAt:snapshot.preparedAt,includeNotes});
 return <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
  <div className="flex flex-wrap items-center justify-between gap-3">{back}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={reload}>Refresh brief</Button><Button onClick={()=>window.print()}>Print / Save PDF</Button></div></div>
  <div className="space-y-3 rounded-lg border bg-muted/20 p-4"><h1 className="text-xl font-semibold">Preview your application brief</h1><p className="max-w-prose text-sm text-muted-foreground">Print includes the preparation information shown below. Essay bodies and document contents are excluded.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeNotes} onChange={e=>setIncludeNotes(e.target.checked)} disabled={!snapshot.hub.application.notes?.trim()} className="h-4 w-4 accent-[#9a1a27]"/>Include my application notes</label></div>
  <div data-application-brief-preview className="overflow-hidden rounded-lg border shadow-sm"><ApplicationBriefDocument brief={brief}/></div>
  {typeof document!=='undefined' && createPortal(<div data-print-application aria-hidden="true"><ApplicationBriefDocument brief={brief}/></div>,document.body)}
 </div>;
}
