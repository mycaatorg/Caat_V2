import {supabase} from './supabase/client';
import {evidencePages} from './evidence-pagination';
import {TaskAuthError,validatePersonalTask,type TaskDetails,type TaskEdit} from './personal-tasks';
const COLUMNS='id, text, due_date, done, priority';
const LOAD_ERROR='Could not load personal tasks completely. Refresh to try again.';
const LINK_ERROR='Could not confirm this task link. Refresh to check whether it is already linked to an application.';
async function owner():Promise<string> {
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)throw new TaskAuthError();
 return user.id;
}
export async function fetchApplicationTasks(applicationId:string):Promise<TaskDetails[]> {
 const userId=await owner();
 const application=await supabase.from('user_school_applications').select('id').eq('user_id',userId).eq('id',applicationId).maybeSingle();
 if(application.error||!application.data)throw new Error(LOAD_ERROR);
 const links=await evidencePages((from,to)=>supabase.from('application_task_links').select('task_id').eq('user_id',userId).eq('application_id',applicationId).order('task_id').range(from,to),LOAD_ERROR);
 const tasks:TaskDetails[]=[];
 for(let i=0;i<links.length;i+=100){
  tasks.push(...await evidencePages((from,to)=>supabase.from('user_todos').select(COLUMNS).eq('user_id',userId).in('id',links.slice(i,i+100).map(l=>l.task_id)).order('id').range(from,to),LOAD_ERROR));
 }
 const byId=new Map(tasks.map(task=>[task.id,task]));
 // A concurrent deletion must not publish a misleading partial checklist.
 return links.map(link=>{const task=byId.get(link.task_id);if(!task)throw new Error(LOAD_ERROR);return task;});
}
export async function fetchAvailableApplicationTasks():Promise<TaskDetails[]> {
 const userId=await owner();
 const [tasks,links]=await Promise.all([
  evidencePages((from,to)=>supabase.from('user_todos').select(COLUMNS).eq('user_id',userId).order('id').range(from,to),LOAD_ERROR),
  evidencePages((from,to)=>supabase.from('application_task_links').select('task_id').eq('user_id',userId).order('task_id').range(from,to),LOAD_ERROR),
 ]);
 const linked=new Set(links.map(l=>l.task_id));
 return tasks.filter(task=>!linked.has(task.id));
}
export async function createApplicationTask(applicationId:string,requestId:string,patch:TaskEdit):Promise<TaskDetails> {
 const values=validatePersonalTask(patch);
 await owner();
 const {data,error}=await supabase.rpc('create_application_task',{p_task_id:requestId,p_application_id:applicationId,p_text:values.text,p_due_date:values.due_date});
 if(error||data?.length!==1)throw new Error(error?.code==='PT409'?'This task changed or the request conflicts. Refresh your tasks before trying again.':'Could not confirm the saved task. Your text is still here. Retry without changing it, or refresh tasks to check whether it saved.');
 return data[0];
}
export async function linkApplicationTask(applicationId:string,taskId:string):Promise<void> {
 const userId=await owner();
 const {data,error}=await supabase.from('application_task_links').insert({user_id:userId,application_id:applicationId,task_id:taskId}).select('task_id').maybeSingle();
 if(error?.code==='23505'){
  // An identical retry may follow a successful write whose response was lost.
  const existing=await supabase.from('application_task_links').select('task_id').eq('user_id',userId).eq('application_id',applicationId).eq('task_id',taskId).maybeSingle();
  if(!existing.error&&existing.data?.task_id===taskId)return;
 }
 if(error||data?.task_id!==taskId)throw new Error(LINK_ERROR);
}
export async function unlinkApplicationTask(applicationId:string,taskId:string):Promise<void> {
 const userId=await owner();
 const {data,error}=await supabase.from('application_task_links').delete().eq('user_id',userId).eq('application_id',applicationId).eq('task_id',taskId).select('task_id').maybeSingle();
 if(error||data?.task_id!==taskId)throw new Error('Could not unlink this task or its link changed elsewhere. Refresh to check.');
}
