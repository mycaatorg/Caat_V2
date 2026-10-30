import { describe, expect, it, vi } from 'vitest';
import { createTimeline, filterTimeline, timelineMonth, TIMELINE_ERROR } from '@/lib/planning-timeline';
import type { UnifiedDeadline } from '@/lib/unified-deadlines';
const today='2026-10-30';
const deadline=(id:string,dateISO:string,source:UnifiedDeadline['source']='app'):UnifiedDeadline=>({id,title:`Study ${id}`,dateISO,source,href:`/applications/${id}`});
describe('planning timeline',()=>{
 it('keeps sources distinct, only open dated task input, stable chronological order and undated count',()=>{
  const tasks=[{id:'old',text:'Past work',due_date:'2026-10-01'},{id:'today',text:'Résumé',due_date:today},{id:'none',text:'Plan later',due_date:null}];
  const before=JSON.stringify(tasks);
  const result=createTimeline([deadline('app',today),deadline('award','2026-11-01','scholarship'),deadline('past','2020-01-01')],tasks,today);
  expect(result.items.map(r=>r.id)).toEqual(['task-old','app','task-today','award']);
  expect(result.undatedTasks).toBe(1);expect(JSON.stringify(tasks)).toBe(before);
  expect(result.items.find(r=>r.id==='task-today')?.href).toBe('/today?view=todos&page=1#todo-today');
 });
 it('uses the same ten-row Today page for a late task link, including undated task offsets',()=>{
  const tasks=Array.from({length:21},(_,i)=>({id:`t${i}`,text:'Task',due_date:today}));
  expect(createTimeline([],tasks,today).items.find(r=>r.id==='task-t20')?.href).toBe('/today?view=todos&page=3#todo-t20');
 });
 it('filters inclusive start and exclusive seven-day boundary, source and folded search',()=>{
  const rows=createTimeline([deadline('six','2026-11-05'),deadline('seven','2026-11-06')],[{id:'now',text:'Résumé review',due_date:today},{id:'old',text:'Old',due_date:'2026-10-29'}],today).items;
  expect(filterTimeline(rows,{today,period:'7',source:'all',query:''}).map(r=>r.id)).toEqual(['task-now','six']);
  expect(filterTimeline(rows,{today,period:'all',source:'task',query:'resume'}).map(r=>r.id)).toEqual(['task-now']);
  expect(filterTimeline(rows,{today,period:'past',source:'all',query:''}).map(r=>r.id)).toEqual(['task-old']);
 });
 it.each(['2026-02-30','bad','2026-10-30T00:00:00Z'])('rejects an invalid recorded date %s instead of inventing a month',date=>{
  expect(()=>createTimeline([deadline('invalid',date)],[],today)).toThrow(TIMELINE_ERROR);
 });
 it('labels months without timezone shifts',()=>{expect(timelineMonth('2026-11-01')).toBe('November 2026');});
});

const io=vi.hoisted(()=>({deadlines:vi.fn()}));
vi.mock('@/lib/unified-deadlines',()=>({fetchUnifiedDeadlines:io.deadlines}));
import { loadPlanningTimeline } from '@/lib/planning-timeline-data';
import { createMockSupabase } from './mock-supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
it('reads all open owner tasks through short server pages and passes owner/date to deadlines',async()=>{
 io.deadlines.mockResolvedValue([deadline('app',today)]);
 const rows=Array.from({length:5},(_,i)=>({id:`t${i}`,text:`Task${i}`,due_date:today}));
 const mock=createMockSupabase({resolver:ctx=>{const from=Number(ctx.calls.find(c=>c.method==='range')?.args[0]??0);return{data:rows.slice(from,from+2),error:null};}});
 const data=await loadPlanningTimeline(mock as unknown as SupabaseClient,'owner',today);
 expect(data.items).toHaveLength(6);expect(io.deadlines).toHaveBeenCalledWith(mock,'owner',today);
 expect(mock.queries.map(q=>q.calls.find(c=>c.method==='range')?.args[0])).toEqual([0,2,4,5]);
 for(const q of mock.queries){expect(q.calls.filter(c=>c.method==='eq').map(c=>c.args)).toEqual([['user_id','owner'],['done',false]]);expect(q.calls.filter(c=>c.method==='order').map(c=>c.args[0])).toEqual(['due_date','id']);}
});
it('rejects later task errors without publishing partial timeline',async()=>{
 io.deadlines.mockResolvedValue([]);
 const mock=createMockSupabase({resolver:ctx=>Number(ctx.calls.find(c=>c.method==='range')?.args[0]??0)===0?{data:[{id:'t',text:'Task',due_date:today}],error:null}:{data:null,error:{message:'private'}}});
 await expect(loadPlanningTimeline(mock as unknown as SupabaseClient,'owner',today)).rejects.toThrow(TIMELINE_ERROR);
});
