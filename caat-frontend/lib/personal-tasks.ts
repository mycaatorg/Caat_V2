import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/types/database';

export type TaskDetails = Pick<Database['public']['Tables']['user_todos']['Row'], 'id' | 'text' | 'due_date' | 'done' | 'priority'>;
export type TaskEdit = Pick<TaskDetails, 'text' | 'due_date'>;
const COLUMNS = 'id, text, due_date, done, priority';
export class TaskAuthError extends Error {
  constructor() { super('Please sign in again. Copy your unsaved edits before leaving this page.'); }
}
export class TaskConflictError extends Error {
  constructor() { super('This task changed or was removed elsewhere. Reload the saved task before trying again.'); }
}
export function validatePersonalTask(patch: TaskEdit): TaskEdit {
  const text = patch.text.trim();
  if (!text || text.length > 1000) throw new Error('Write a task between 1 and 1,000 characters.');
  const day = patch.due_date;
  if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day)) throw new Error('Choose a valid due date, or leave it empty.');
  return { text, due_date: day || null };
}
async function owner(signal?: AbortSignal): Promise<string> {
  const {data:{user},error}=await supabase.auth.getUser();
  if (error || !user) throw new TaskAuthError();
  if (signal?.aborted) throw new Error('Request canceled');
  return user.id;
}
export async function fetchPersonalTask(id: string, signal?: AbortSignal): Promise<TaskDetails | null> {
  const userId=await owner(signal);
  const query=supabase.from('user_todos').select(COLUMNS).eq('user_id',userId).eq('id',id);
  const {data,error}=await (signal ? query.abortSignal(signal) : query).maybeSingle();
  if (error) throw new Error('Could not load the saved task. Try again.');
  return data;
}
/** Compare only editable fields: completion/priority can change independently.
 * PostgreSQL checks these conditions atomically with the owner-scoped update. */
export async function editPersonalTask(original: Pick<TaskDetails,'id'|'text'|'due_date'>, patch: TaskEdit, signal?: AbortSignal): Promise<TaskDetails> {
  const values=validatePersonalTask(patch);
  await owner(signal);
  const query=supabase.rpc('edit_personal_task',{
    p_id:original.id,p_original_text:original.text,p_original_due_date:original.due_date,
    p_text:values.text,p_due_date:values.due_date,
  });
  const {data,error}=await (signal ? query.abortSignal(signal) : query);
  if (error) throw new Error('Could not save the task. Your edits are still here.');
  if (!data || data.length !== 1) throw new TaskConflictError();
  return data[0];
}
