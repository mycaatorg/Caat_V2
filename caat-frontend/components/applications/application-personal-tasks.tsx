'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/components/providers/AuthContext';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {TaskEditor} from '@/components/today/task-editor';
import {toggleTodo} from '@/components/dashboard/api';
import {validatePersonalTask,type TaskDetails} from '@/lib/personal-tasks';
import {fetchApplicationTasks,fetchAvailableApplicationTasks,createApplicationTask,linkApplicationTask,unlinkApplicationTask} from '@/lib/application-tasks';

const PAGE_SIZE=20;
const dateLabel=(day:string)=>new Date(`${day}T00:00:00Z`).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
export function ApplicationPersonalTasks({applicationId}:{applicationId:string}) {
 const {user,loading}=useAuth();
 if(loading)return <p role="status">Loading personal tasks…</p>;
 if(!user)return null;
 return <TaskWorkspace key={`${user.id}:${applicationId}`} applicationId={applicationId}/>;
}
function TaskWorkspace({applicationId}:{applicationId:string}) {
 const [tasks,setTasks]=useState<TaskDetails[]|null>(null),[loading,setLoading]=useState(true),[version,setVersion]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState('');
 const [query,setQuery]=useState(''),[page,setPage]=useState(0);
 const [draft,setDraft]=useState<{id:string;text:string;date:string}|null>(null);
 const [picker,setPicker]=useState(false),[available,setAvailable]=useState<TaskDetails[]|null>(null),[pickerError,setPickerError]=useState(false);
 const [pickerQuery,setPickerQuery]=useState(''),[pickerPage,setPickerPage]=useState(0);
 const alive=useRef(true),writing=useRef(false),pickerGeneration=useRef({value:0}),region=useRef<HTMLElement|null>(null),dateField=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{const generation=pickerGeneration.current;alive.current=true;return()=>{alive.current=false;generation.value++;};},[]);
 useEffect(()=>{
  let active=true;
  fetchApplicationTasks(applicationId).then(rows=>{if(active){setTasks(rows);setError(null);}}).catch(()=>{if(active){setTasks(null);setError('Could not load personal tasks completely. Refresh to try again.');}}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[applicationId,version]);
 function refresh(){setLoading(true);setError(null);setVersion(v=>v+1);}
 async function run(action:()=>Promise<unknown>,success:()=>void,message:string){
  if(writing.current)return;
  writing.current=true;setBusy(true);setError(null);setNotice('');
  const origin=document.activeElement;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
   // A slow request can still reach the database. Keep the write gate held
   // until it settles; a timeout must not enable a conflicting retry/relink.
   timer=setTimeout(()=>{if(alive.current)setError('Still waiting for confirmation. Your text is kept here. Other changes will be available when this request finishes.');},30000);
   await action();
   if(!alive.current)return;
   success();setNotice(message);refresh();
   if(document.activeElement===origin||document.activeElement===document.body)region.current?.focus();
  } catch {
   if(alive.current)setError('Could not confirm the change. Your task text is still here. Refresh to check what saved, or retry the same task without changing it.');
  } finally {clearTimeout(timer);if(alive.current){writing.current=false;setBusy(false);}}
 }
 function saveDraft(){
  if(!draft||writing.current)return;
  if(dateField.current?.validity.badInput){setError('Complete the due date, or clear it.');dateField.current.focus();return;}
  let values;
  try{values=validatePersonalTask({text:draft.text,due_date:draft.date||null});}
  catch(e){setError(e instanceof Error?e.message:'Check your task text and date.');return;}
  void run(()=>createApplicationTask(applicationId,draft.id,values),()=>setDraft(null),'Personal task saved. It is also available in Today.');
 }
 function closePicker(){pickerGeneration.current.value++;setPicker(false);setAvailable(null);setPickerQuery('');setPickerPage(0);}
 async function openPicker(){
  const request=++pickerGeneration.current.value;setPicker(true);setAvailable(null);setPickerError(false);setPickerPage(0);
  try{const rows=await fetchAvailableApplicationTasks();if(alive.current&&request===pickerGeneration.current.value)setAvailable(rows);}
  catch{if(alive.current&&request===pickerGeneration.current.value)setPickerError(true);}
 }
 const blocked=loading||busy||!!error;
 const selected=(tasks??[]).filter(t=>t.text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>Number(a.done)-Number(b.done)||(a.due_date??'9999-99-99').localeCompare(b.due_date??'9999-99-99')||a.id.localeCompare(b.id));
 const lastPage=Math.max(0,Math.ceil(selected.length/PAGE_SIZE)-1),currentPage=Math.min(page,lastPage);
 const choices=(available??[]).filter(t=>t.text.toLocaleLowerCase().includes(pickerQuery.trim().toLocaleLowerCase())).sort((a,b)=>a.text.localeCompare(b.text)||a.id.localeCompare(b.id));
 const lastPickerPage=Math.max(0,Math.ceil(choices.length/PAGE_SIZE)-1),currentPickerPage=Math.min(pickerPage,lastPickerPage);
 return <section ref={region} id="personal-tasks" tabIndex={-1} aria-label="Personal application tasks" aria-busy={loading||busy} className="min-w-0 scroll-mt-20">
  <Card><CardHeader><CardTitle className="text-base">Personal tasks</CardTitle></CardHeader><CardContent className="space-y-4">
   <p className="text-sm text-muted-foreground">Your own preparation steps, not official entry requirements. These are the same tasks you see in Today. Completing them does not submit an application.</p>
   <div className="flex flex-wrap gap-2">
    <Button size="sm" disabled={blocked||!!draft||picker} onClick={()=>{setDraft({id:crypto.randomUUID(),text:'',date:''});setNotice('');}}>Add personal task</Button>
    <Button size="sm" variant="outline" disabled={blocked||!!draft||picker} onClick={()=>void openPicker()}>Link existing task</Button>
    <Button size="sm" variant="outline" disabled={loading||busy} onClick={refresh}>Refresh tasks</Button>
   </div>
   {loading&&<p className="text-sm">Loading personal tasks…</p>}
   <p role="status" aria-live="polite" className="text-sm">{notice}</p>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   {draft&&<form className="space-y-3 border p-3" onSubmit={e=>{e.preventDefault();saveDraft();}}>
    <label className="block text-sm font-medium">New personal task<textarea aria-label="New personal task" maxLength={1000} value={draft.text} disabled={busy} onChange={e=>setDraft({...draft,text:e.target.value})} className="mt-1 block min-h-24 w-full rounded-none border bg-background p-2 font-normal"/></label>
    <label className="block text-sm font-medium">Due date<input ref={dateField} aria-label="Due date" type="date" value={draft.date} disabled={busy} onChange={e=>setDraft({...draft,date:e.target.value})} className="mt-1 block w-full rounded-none border bg-background p-2 font-normal"/></label>
    <div className="flex gap-2"><Button size="sm" type="submit" disabled={busy||loading}>Save task</Button><Button size="sm" type="button" variant="outline" disabled={busy} onClick={()=>{setDraft(null);setError(null);}}>Cancel task</Button></div>
   </form>}
   {picker&&<div className="space-y-3 border p-3" aria-label="Link an existing personal task">
    <p className="text-sm">Choose a task that is not linked to another application.</p>
    <label className="block text-sm">Search unlinked tasks<input aria-label="Search unlinked tasks" value={pickerQuery} disabled={busy} onChange={e=>{setPickerQuery(e.target.value);setPickerPage(0);}} className="mt-1 block w-full rounded-none border bg-background p-2"/></label>
    {pickerError?<div><p role="alert" className="text-sm">Could not load available tasks. Try again.</p><Button variant="outline" size="sm" onClick={()=>void openPicker()}>Retry available tasks</Button></div>:available===null?<p className="text-sm">Loading available tasks…</p>:<>
     {!choices.length&&<p className="text-sm text-muted-foreground">No unlinked tasks match. Add a personal task instead.</p>}
     <ul className="divide-y">{choices.slice(currentPickerPage*PAGE_SIZE,(currentPickerPage+1)*PAGE_SIZE).map(t=><li key={t.id} className="flex items-start justify-between gap-3 py-2"><span className="min-w-0 break-words text-sm">{t.text}{t.done?' (completed)':''}</span><Button size="sm" variant="outline" disabled={busy||loading} aria-label={`Link ${t.text}`} onClick={()=>void run(()=>linkApplicationTask(applicationId,t.id),closePicker,'Existing task linked. Its saved content is unchanged.')}>Link</Button></li>)}</ul>
     {lastPickerPage>0&&<div className="flex items-center gap-3"><Button size="sm" variant="outline" aria-label="Previous available tasks" disabled={busy||currentPickerPage===0} onClick={()=>setPickerPage(currentPickerPage-1)}>Previous</Button><span className="text-xs">Page {currentPickerPage+1} of {lastPickerPage+1}</span><Button size="sm" variant="outline" aria-label="Next available tasks" disabled={busy||currentPickerPage===lastPickerPage} onClick={()=>setPickerPage(currentPickerPage+1)}>Next</Button></div>}
    </>}
    <Button size="sm" variant="outline" disabled={busy} onClick={closePicker}>Close task picker</Button>
   </div>}
   {tasks&&<>
    <p className="text-sm text-muted-foreground">{tasks.length} linked · {tasks.filter(t=>!t.done).length} open</p>
    {tasks.length>0&&<label className="block text-sm">Search application tasks<input aria-label="Search application tasks" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} className="mt-1 block w-full rounded-none border bg-background p-2"/></label>}
    {!selected.length&&<p className="text-sm text-muted-foreground">{tasks.length?'No tasks match your search.':'Add a personal task or link one from Today to start.'}</p>}
    <ul className="divide-y">{selected.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE).map(t=><li key={t.id} className="flex flex-wrap items-start gap-3 py-3">
     <label className="flex min-w-0 flex-1 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#9a1a27]" checked={t.done} disabled={blocked} aria-label={t.done?`Reopen ${t.text}`:`Mark ${t.text} done`} onChange={()=>void run(()=>toggleTodo(t.id,!t.done),()=>{},t.done?'Task reopened.':'Task completed.')}/><span className="min-w-0 break-words"><span className={t.done?'line-through':''}>{t.text}</span><span className="block text-xs text-muted-foreground">{t.done?'Completed':t.due_date?`Due ${dateLabel(t.due_date)}`:'No due date'}</span></span></label>
     <div className="flex flex-wrap gap-2"><TaskEditor task={{id:t.id,text:t.text,dueDate:t.due_date}} disabled={blocked} onSaved={()=>{setNotice('Task updated.');refresh();}} onMissing={refresh} fallbackFocusRef={region} returnTo={`/applications/${encodeURIComponent(applicationId)}#personal-tasks`}/><Button size="sm" variant="outline" disabled={blocked} aria-label={`Unlink ${t.text}`} onClick={()=>void run(()=>unlinkApplicationTask(applicationId,t.id),()=>{},'Task unlinked. It is still available in Today.')}>Unlink</Button></div>
    </li>)}</ul>
    {lastPage>0&&<div className="flex items-center gap-3"><Button size="sm" variant="outline" disabled={blocked||currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous tasks</Button><span className="text-xs">Page {currentPage+1} of {lastPage+1}</span><Button size="sm" variant="outline" disabled={blocked||currentPage===lastPage} onClick={()=>setPage(currentPage+1)}>Next tasks</Button></div>}
   </>}
   <p className="text-xs text-muted-foreground">Unlinking or removing this application keeps your personal tasks.</p>
   <Link href="/today?view=todos" className="text-sm underline underline-offset-4">View tasks in Today</Link>
  </CardContent></Card>
 </section>;
}
