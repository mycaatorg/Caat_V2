import { supabase } from '@/lib/supabase/client';
import { evidenceUserId, evidenceText, type EvidenceItem } from '@/lib/evidence-items';
import { evidencePages } from '@/lib/evidence-pagination';
import { ITEM_KEY_PATTERN } from '@/lib/requirements-checklist';
import type { Database } from '@/types/database';

export type RequirementWorkLink = Database['public']['Tables']['requirement_evidence_links']['Row'];
export type WorkSource = { kind: 'evidence' | 'draft'; id: string; title: string; category: string; body: string; href: string; tailored: boolean };
export type RequirementWork = { links: RequirementWorkLink[]; sources: WorkSource[] };
const TABLE = 'requirement_evidence_links';
const LOAD_ERROR = 'Could not load supporting work. Retry before linking or removing anything.';
const WRITE_ERROR = 'Could not link this work. Refresh to check the scholarship is still attached and the source still exists.';
type EvidenceRow = { id: string; kind: string; tailored_title: string | null; tailored_body: string | null; tailored_at: string | null; documents: {file_name: string} | null; evidence_items: EvidenceItem | null };

/** All reads are paginated and owner-filtered. Application evidence retains its
 * current tailoring; draft content is read directly, never copied or modified. */
export async function fetchRequirementWork(applicationId: string): Promise<RequirementWork> {
 const userId = await evidenceUserId();
 const [links,sources] = await Promise.all([
  evidencePages((from,to)=>supabase.from(TABLE).select('*').eq('user_id',userId).eq('application_id',applicationId).order('created_at').order('id').range(from,to),LOAD_ERROR),
  fetchApplicationWorkSources(applicationId),
 ]);
 return {links,sources};
}
/** Current owned sources shared by scholarship and course preparation. */
export async function fetchApplicationWorkSources(applicationId:string):Promise<WorkSource[]> {
 const userId=await evidenceUserId();
 const [evidence,drafts] = await Promise.all([
  evidencePages((from,to)=>supabase.from('application_evidence_links').select('id, kind, tailored_title, tailored_body, tailored_at, documents(file_name), evidence_items(*)').eq('user_id',userId).eq('application_id',applicationId).order('created_at').order('id').range(from,to),LOAD_ERROR),
  evidencePages((from,to)=>supabase.from('essay_drafts').select('id, label, content, prompt_id, prompt_slug, school_id').eq('user_id',userId).order('id').range(from,to),LOAD_ERROR),
 ]);
 const sources: WorkSource[] = [];
 for(const row of evidence as unknown as EvidenceRow[]) {
  if(row.kind==='document' && row.documents) sources.push({kind:'evidence',id:row.id,title:row.tailored_title??row.documents.file_name,category:'Document',body:row.tailored_body??'Open Documents to view the file.',href:'/documents',tailored:!!row.tailored_at});
  if(row.kind==='item' && row.evidence_items) sources.push({kind:'evidence',id:row.id,title:row.tailored_title??row.evidence_items.title,category:row.evidence_items.kind,body:row.tailored_at?row.tailored_body??'':evidenceText(row.evidence_items),href:'/profile#evidence-library',tailored:!!row.tailored_at});
 }
 for(const row of drafts) sources.push({kind:'draft',id:row.id,title:row.label||row.prompt_slug||'Untitled draft',category:'Essay draft',body:row.content,href:`/essays?prompt=${encodeURIComponent(row.prompt_id)}${row.school_id===null?'':`&school=${row.school_id}`}`,tailored:false});
 return sources;
}
export type LinkWorkInput = { applicationId:string; schoolId:number; scholarshipId:string; itemKey:string; label:string; source:Pick<WorkSource,'kind'|'id'> };
export async function linkRequirementWork(input:LinkWorkInput): Promise<RequirementWorkLink> {
 if(!ITEM_KEY_PATTERN.test(input.itemKey)||!input.label.trim()||input.label.length>10000) throw new Error('This requirement cannot be linked. Refresh the checklist and try again.');
 const userId=await evidenceUserId();
 const sourceColumn=input.source.kind==='evidence'?'evidence_link_id':'essay_draft_id';
 const {data,error}=await supabase.from(TABLE).insert({user_id:userId,application_id:input.applicationId,school_id:input.schoolId,scholarship_id:input.scholarshipId,item_key:input.itemKey,requirement_label:input.label,evidence_link_id:input.source.kind==='evidence'?input.source.id:null,essay_draft_id:input.source.kind==='draft'?input.source.id:null}).select('*');
 if(error?.code==='23505') {
  const existing=await supabase.from(TABLE).select('*').eq('user_id',userId).eq('application_id',input.applicationId).eq('scholarship_id',input.scholarshipId).eq('item_key',input.itemKey).eq(sourceColumn,input.source.id);
  if(!existing.error && existing.data?.length===1) return existing.data[0];
 }
 if(error||data?.length!==1) throw new Error(WRITE_ERROR);
 return data[0];
}
export async function unlinkRequirementWork(link:RequirementWorkLink):Promise<void> {
 const userId=await evidenceUserId();
 const {data,error}=await supabase.from(TABLE).delete().eq('user_id',userId).eq('application_id',link.application_id).eq('id',link.id).select('id');
 if(error) throw new Error('Could not remove this supporting-work link. Try again.');
 if(data?.length!==1) throw new Error('This link was removed or changed elsewhere. Refresh to see the latest.');
}
export function requirementReview(link:RequirementWorkLink,items:readonly {key:string;label:string}[]):'changed'|'removed'|null {
 const item=items.find(i=>i.key===link.item_key);
 return !item?'removed':item.label!==link.requirement_label?'changed':null;
}
export function sourceForLink(link:RequirementWorkLink,sources:WorkSource[]):WorkSource|undefined {
 return sources.find(s=>s.kind==='evidence'?s.id===link.evidence_link_id:s.id===link.essay_draft_id);
}
