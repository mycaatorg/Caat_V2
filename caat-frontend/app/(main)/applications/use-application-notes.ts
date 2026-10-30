'use client';
import {useEffect,useRef,useState} from 'react';
import type {ApplicationRow} from '@/types/applications';
export type ApplicationNoteDraft={text:string;open:boolean;state:'saved'|'saving'|'failed'};
/** Workspace-owned drafts survive card remounts during lane/filter/view changes. */
export function useApplicationNotes(save:(id:string,text:string)=>Promise<boolean>) {
 const [drafts,setDrafts]=useState<Record<string,ApplicationNoteDraft>>({});
 const timers=useRef(new Map<string,ReturnType<typeof setTimeout>>());
 const sequences=useRef(new Map<string,number>());
 const mounted=useRef(true);
 useEffect(()=>{
  mounted.current=true;
  const pending=timers.current;
  return ()=>{mounted.current=false;pending.forEach(clearTimeout);pending.clear();};
 },[]);
 function get(app:ApplicationRow):ApplicationNoteDraft {return drafts[app.id]??{text:app.notes??'',open:false,state:'saved'};}
 function patch(app:ApplicationRow,change:Partial<ApplicationNoteDraft>) {
  if(mounted.current)setDrafts(previous=>({...previous,[app.id]:{...(previous[app.id]??{text:app.notes??'',open:false,state:'saved'}),...change}}));
 }
 function clearTimer(id:string){clearTimeout(timers.current.get(id));timers.current.delete(id);}
 function next(id:string){const seq=(sequences.current.get(id)??0)+1;sequences.current.set(id,seq);return seq;}
 async function persist(app:ApplicationRow,text:string) {
  clearTimer(app.id);const seq=next(app.id);patch(app,{text,state:'saving'});
  let ok=false;
  try {ok=await save(app.id,text);} catch { /* Keep the draft retryable. */ }
  if(sequences.current.get(app.id)===seq)patch(app,{state:ok?'saved':'failed'});
 }
 function input(app:ApplicationRow,text:string){
  next(app.id);clearTimer(app.id);patch(app,{text,state:'saving'});
  timers.current.set(app.id,setTimeout(()=>void persist(app,text),800));
 }
 function cancel(app:ApplicationRow){
  next(app.id);clearTimer(app.id);
  setDrafts(previous=>previous[app.id]?.state==='saving'?{...previous,[app.id]:{...previous[app.id],state:'failed'}}:previous);
 }
 return {get,input,persist,cancel,toggle:(app:ApplicationRow)=>patch(app,{open:!get(app).open})};
}
