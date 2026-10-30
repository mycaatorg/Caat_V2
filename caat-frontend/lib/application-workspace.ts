import type {ApplicationRow, ApplicationStatus} from '@/types/applications';
export type ApplicationFilter = 'all' | 'active' | 'outcome';
export type ApplicationSort = 'newest' | 'deadline' | 'university';
export const APPLICATION_STAGES = [
 {key:'researching',label:'Researching',description:'Explore your options'},
 {key:'preparing',label:'Preparing',description:'Work on your application'},
 {key:'awaiting',label:'Awaiting outcome',description:'Track submitted applications'},
 {key:'outcomes',label:'Outcomes',description:'Review your next steps'},
] as const;
export type ApplicationStage = typeof APPLICATION_STAGES[number]['key'];
export function applicationStage(status:ApplicationStatus):ApplicationStage {
 if(status==='researching')return 'researching';
 if(status==='applying')return 'preparing';
 if(status==='submitted'||status==='decision_pending')return 'awaiting';
 return 'outcomes';
}
export function selectApplications(rows:ApplicationRow[],query:string,filter:ApplicationFilter,sort:ApplicationSort):ApplicationRow[] {
 const q=query.trim().toLocaleLowerCase();
 return rows.filter(row=>{
  const outcome=applicationStage(row.status)==='outcomes';
  return (filter==='all'||(filter==='outcome'?outcome:!outcome)) && (!q||`${row.schools?.name??'Unknown School'} ${row.schools?.country??''}`.toLocaleLowerCase().includes(q));
 }).sort((a,b)=>{
  const order=sort==='deadline' ? (a.deadline_at??'9999-99-99').localeCompare(b.deadline_at??'9999-99-99')
   :sort==='university' ? (a.schools?.name??'Unknown School').localeCompare(b.schools?.name??'Unknown School')
   :b.created_at.localeCompare(a.created_at);
  return order||a.id.localeCompare(b.id);
 });
}
