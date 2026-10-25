'use client';

import {useEffect,useId,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {LibraryDialog} from '@/components/evidence/library-dialog';
import {editPersonalTask,fetchPersonalTask,TaskAuthError,TaskConflictError,validatePersonalTask,type TaskDetails} from '@/lib/personal-tasks';

type Task = {id:string;text:string;dueDate:string|null};
export function TaskEditor({task,disabled,onSaved}:{task:Task;disabled:boolean;onSaved:(saved:TaskDetails)=>void}) {
 const id=useId();
 const opener=useRef<HTMLButtonElement|null>(null);
 const activeRequest=useRef<AbortController|null>(null);
 const working=useRef(false);
 const generation=useRef(0);
 const saveAction=useRef<HTMLButtonElement|null>(null);
 const dateField=useRef<HTMLInputElement|null>(null);
 const reloadAction=useRef<HTMLButtonElement|null>(null);
 const [open,setOpen]=useState(false);
 const [text,setText]=useState('');
 const [dueDate,setDueDate]=useState('');
 const [original,setOriginal]=useState({id:task.id,text:task.text,due_date:task.dueDate});
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [authError,setAuthError]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [missing,setMissing]=useState(false);
 useEffect(()=>()=>{generation.current++;activeRequest.current?.abort();},[]);

 async function run<T>(action:(signal:AbortSignal)=>Promise<T>,success:(value:T)=>void,loading=false) {
  if(working.current)return;
  const request=++generation.current;
  working.current=true;setBusy(true);setLoading(loading);setError(null);setAuthError(false);
  const controller=new AbortController();activeRequest.current=controller;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
   const value=await Promise.race([action(controller.signal),new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(new Error('Timed out'));},30_000);
   })]);
   if(request===generation.current)success(value);
  } catch(e) {
   if(request!==generation.current)return;
   setAuthError(e instanceof TaskAuthError);
   setError(e instanceof TaskConflictError || e instanceof TaskAuthError ? e.message : loading ? 'Could not load the saved task. Your edits are still here.' : 'Could not confirm the save. Your edits are still here. Reload the saved task to check whether it saved before trying again.');
  } finally {
   clearTimeout(timer);
   if(request===generation.current){activeRequest.current=null;working.current=false;setBusy(false);setLoading(false);}
  }
 }
 function close() {
  if(working.current&&!loading)return;
  generation.current++;activeRequest.current?.abort();activeRequest.current=null;working.current=false;
  setBusy(false);setLoading(false);setOpen(false);
 }
 function save() {
  if(working.current||missing)return;
  if(dateField.current?.validity.badInput){setError("Complete the due date, or clear all its parts to remove it.");dateField.current.focus();return;}
  let values;
  try {values=validatePersonalTask({text,due_date:dueDate||null});}
  catch(e) {setError(e instanceof Error ? e.message : 'Check your task text and due date.');return;}
  saveAction.current?.focus();
  void run(signal=>editPersonalTask(original,values,signal),saved=>{onSaved(saved);setOpen(false);});
 }
 function reload() {
  if(working.current)return;
  reloadAction.current?.focus();
  void run(signal=>fetchPersonalTask(task.id,signal),saved=>{
   if(!saved){setMissing(true);setError('This task is no longer available. Close this editor and refresh Today.');return;}
   setMissing(false);setOriginal({id:saved.id,text:saved.text,due_date:saved.due_date});setText(saved.text);setDueDate(saved.due_date??'');
  },true);
 }
 return <>
  <Button ref={opener} type="button" size="sm" variant="ghost" disabled={disabled} className="shrink-0" aria-label={`Edit task: ${task.text}`} onClick={()=>{
   setOriginal({id:task.id,text:task.text,due_date:task.dueDate});setText(task.text);setDueDate(task.dueDate??'');setError(null);setAuthError(false);setMissing(false);setOpen(true);
  }}>Edit</Button>
  {open&&<LibraryDialog title="Edit personal task" description="Update your task text or due date. Completion and priority stay unchanged." busy={busy&&!loading} onClose={close} returnFocusRef={opener}>
   <form className="space-y-4" onSubmit={e=>{e.preventDefault();save();}} noValidate>
    <div><label htmlFor={`${id}-text`} className="block text-sm font-medium">Task</label>
     <textarea id={`${id}-text`} value={text} onChange={e=>setText(e.target.value)} disabled={busy||missing} maxLength={1000} rows={3} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"/>
    </div>
    <div><label htmlFor={`${id}-date`} className="block text-sm font-medium">Due date (optional)</label>
     <input ref={dateField} id={`${id}-date`} type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} disabled={busy||missing} className="mt-1 min-w-0 max-w-full rounded-md border bg-background px-3 py-2 text-sm"/>
    </div>
    {error&&<div role="alert" className="text-sm text-destructive"><p>{error}</p>{authError&&<Link href="/login?next=/today" className="underline">Sign in again</Link>}</div>}
    <div className="flex flex-wrap gap-2">
     <Button ref={saveAction} type="submit" aria-disabled={busy||missing} aria-busy={busy}>{busy?'Working…':'Save changes'}</Button>
     <Button type="button" variant="ghost" disabled={busy&&!loading} onClick={close}>Cancel</Button>
    </div>
    <div className="border-t pt-3">
     <p className="text-xs text-muted-foreground">Reload replaces your edits with the latest saved text and date.</p>
     <Button ref={reloadAction} type="button" variant="ghost" size="sm" className="mt-1" aria-disabled={busy} onClick={reload}>Reload saved task</Button>
    </div>
   </form>
  </LibraryDialog>}
 </>;
}
