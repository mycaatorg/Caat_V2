'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthContext';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { resolveTimeZone, zonedTodayISO } from '@/lib/today-data';
import { loadPlanningTimeline } from '@/lib/planning-timeline-data';
import { filterTimeline, timelineDay, timelineMonth, TIMELINE_ERROR, TIMELINE_SOURCES, type TimelineData, type TimelinePeriod, type TimelineSource } from '@/lib/planning-timeline';

type Snapshot = TimelineData & {today:string;timeZone:string};
const PAGE_SIZE=20;
export default function PlannerClient() {
  const {user,loading}=useAuth();
  if(loading)return <p role="status" className="p-6">Loading your planning timeline…</p>;
  if(!user)return <p className="p-6"><Link href="/login?next=/workspace/planner">Sign in to view your planning timeline</Link></p>;
  return <TimelineWorkspace key={user.id} userId={user.id}/>;
}
function TimelineWorkspace({userId}:{userId:string}) {
  const [data,setData]=useState<Snapshot|null>(null);
  const [error,setError]=useState(false);
  const [version,setVersion]=useState(0);
  const [query,setQuery]=useState('');
  const [source,setSource]=useState<TimelineSource|'all'>('all');
  const [period,setPeriod]=useState<TimelinePeriod>('all');
  const [page,setPage]=useState(1);
  useEffect(()=>{
    let active=true;
    const timeZone=resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const today=zonedTodayISO(timeZone);
    loadPlanningTimeline(supabase,userId,today).then(result=>{if(active)setData({...result,today,timeZone});}).catch(()=>{if(active)setError(true);});
    return()=>{active=false;};
  },[userId,version]);
  const reload=()=>{setData(null);setError(false);setVersion(v=>v+1);};
  const filtered=data?filterTimeline(data.items,{today:data.today,period,source,query}):[];
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safePage=Math.min(page,pages);
  if(data && page!==safePage)setPage(safePage);
  const visible=filtered.slice((safePage-1)*PAGE_SIZE,safePage*PAGE_SIZE);
  const groups=new Map<string,typeof visible>();
  for(const item of visible){
    const month=item.dateISO.slice(0,7);
    const group=groups.get(month);
    if(group)group.push(item);else groups.set(month,[item]);
  }
  return <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl space-y-2"><p className="font-code text-xs uppercase tracking-widest text-muted-foreground">Your planning workspace</p><h1 className="font-display text-3xl font-semibold">Planning timeline</h1><p className="text-sm text-muted-foreground">See recorded dates across applications, scholarships, calendar events and your open tasks. Check official sources for closing times and changes.</p></div>
      <div className="flex gap-3 items-center"><Link className="text-sm underline" href="/today">Back to Today</Link><Button variant="outline" onClick={reload} disabled={!data&&!error}>Refresh timeline</Button></div>
    </div>
    {error?<div className="space-y-3 rounded-lg border p-6"><p role="alert">{TIMELINE_ERROR}</p><Button onClick={reload}>Retry timeline</Button></div>:!data?<p role="status">Loading your planning timeline…</p>:<>
      <p className="text-xs text-muted-foreground">Date ranges start {timelineDay(data.today)} · {data.timeZone}. Refresh to load changes.</p>
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Search timeline<input aria-label="Search timeline" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Find a deadline, event or task" className="block w-full min-w-0 rounded-md border bg-background px-3 py-2"/></label>
        <label className="space-y-1 text-sm">Source<select aria-label="Source" value={source} onChange={e=>{setSource(e.target.value as TimelineSource|'all');setPage(1);}} className="block w-full rounded-md border bg-background px-3 py-2"><option value="all">All sources</option>{Object.entries(TIMELINE_SOURCES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm">Date range<select aria-label="Date range" value={period} onChange={e=>{setPeriod(e.target.value as TimelinePeriod);setPage(1);}} className="block w-full rounded-md border bg-background px-3 py-2"><option value="all">All upcoming</option><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="90">Next 90 days</option><option value="past">Past-due tasks</option></select></label>
      </div>
      {data.undatedTasks>0?<p className="text-sm text-muted-foreground">{data.undatedTasks} open {data.undatedTasks===1?'task has':'tasks have'} no date. <Link className="underline" href="/today?view=todos">Manage your tasks</Link></p>:null}
      <p role="status" aria-label="Timeline results" className="text-sm text-muted-foreground">{filtered.length} {filtered.length===1?'item':'items'} · Page {safePage} of {pages}</p>
      {!visible.length?<div className="rounded-lg border border-dashed p-8 text-center"><h2 className="font-semibold">No dates match these filters</h2><p className="mt-2 text-sm text-muted-foreground">Try another source or date range, or add a date from your application, scholarship, calendar or task.</p><Button variant="outline" className="mt-4" onClick={()=>{setQuery('');setSource('all');setPeriod('all');setPage(1);}}>Reset timeline filters</Button></div>:Array.from(groups,([month,items])=><section key={month} aria-label={timelineMonth(items[0].dateISO)} className="space-y-3"><h2 className="font-display text-xl font-semibold">{timelineMonth(items[0].dateISO)}</h2><ul className="divide-y rounded-lg border bg-card">{items.map(item=><li data-timeline-item key={item.id}><Link href={item.href} className="grid gap-2 p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 sm:grid-cols-[8rem_1fr]">
        <time dateTime={item.dateISO} className="text-sm font-medium">{timelineDay(item.dateISO)}</time><div className="min-w-0"><span className="block break-words font-medium">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground">{TIMELINE_SOURCES[item.source]}{item.source==='task'&&item.dateISO<data.today?' · Past due':''}{item.source==='event'&&item.timeStart?` · ${item.timeStart.slice(0,5)}${item.timeEnd?`–${item.timeEnd.slice(0,5)}`:''}`:''}</span></div>
      </Link></li>)}</ul></section>)}
      {pages>1?<nav aria-label="Timeline pages" className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={safePage===1} onClick={()=>setPage(safePage-1)}>Previous timeline page</Button><Button variant="outline" disabled={safePage===pages} onClick={()=>setPage(safePage+1)}>Next timeline page</Button></nav>:null}
    </>}
  </div>;
}
