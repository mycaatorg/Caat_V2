import type { UnifiedDeadline, DeadlineSource } from '@/lib/unified-deadlines';
import { TODAY_PAGE_SIZE } from '@/lib/today';
export const TIMELINE_ERROR = 'Could not load your planning timeline. Try again.';
export type TimelineSource = DeadlineSource | 'task';
export type TimelinePeriod = 'all' | '7' | '30' | '90' | 'past';
export const TIMELINE_SOURCES: Record<TimelineSource,string> = { app:'Application', scholarship:'Saved scholarship', custom:'Your scholarship', event:'Calendar event', task:'Task' };
export type TimelineItem = Omit<UnifiedDeadline,'source'> & {source:TimelineSource};
export type TimelineTask = {id:string;text:string;due_date:string|null};
export type TimelineData = {items:TimelineItem[];undatedTasks:number};
function dateValue(value:string) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error(TIMELINE_ERROR);
 const date=new Date(`${value}T00:00:00Z`);
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value)throw new Error(TIMELINE_ERROR);
 return date;
}
/** Tasks arrive in Today's canonical due-date/id order; links preserve its page. */
export function createTimeline(deadlines:UnifiedDeadline[],tasks:TimelineTask[],today:string):TimelineData {
 dateValue(today);
 const items:TimelineItem[]=deadlines.flatMap(row=>{dateValue(row.dateISO);return row.dateISO<today?[]:[{...row}];});
 let undatedTasks=0;
 tasks.forEach((task,index)=>{
  if(!task.due_date){undatedTasks++;return;}
  dateValue(task.due_date);
  items.push({id:`task-${task.id}`,title:task.text,dateISO:task.due_date,source:'task',href:`/today?view=todos&page=${Math.floor(index/TODAY_PAGE_SIZE)+1}#todo-${encodeURIComponent(task.id)}`});
 });
 items.sort((a,b)=>a.dateISO.localeCompare(b.dateISO)||a.id.localeCompare(b.id));
 return{items,undatedTasks};
}
const fold=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function filterTimeline(items:TimelineItem[],{today,period,source,query}:{today:string;period:TimelinePeriod;source:TimelineSource|'all';query:string}):TimelineItem[] {
 const start=dateValue(today).valueOf(),end=start+Number(period)*86400000;
 const needle=fold(query);
 return items.filter(item=>{
  if(source!=='all'&&item.source!==source)return false;
  if(needle&&!fold(item.title).includes(needle))return false;
  if(period==='past')return item.source==='task'&&item.dateISO<today;
  return item.dateISO>=today&&(period==='all'||dateValue(item.dateISO).valueOf()<end);
 });
}
export function timelineMonth(date:string){return new Intl.DateTimeFormat('en-AU',{month:'long',year:'numeric',timeZone:'UTC'}).format(dateValue(date));}
export function timelineDay(date:string){return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',weekday:'short',timeZone:'UTC'}).format(dateValue(date));}
