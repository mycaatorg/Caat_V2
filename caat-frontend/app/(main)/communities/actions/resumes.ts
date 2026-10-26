'use server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase-server';
import { buildResumeSnapshot, sanitizeResumeSnapshot } from '@/lib/community-resume-snapshot';
import type { ResumeSnapshot } from '@/lib/community-resume-share-schema';

const uuid=z.string().uuid();
type ViewResult={snapshot:ResumeSnapshot|null;error:string|null};
const unavailable:ViewResult={snapshot:null,error:'This shared resume is unavailable. Older attachments need a new, previewed copy.'};
export async function prepareResumeShareAction(resumeId:string):Promise<ViewResult>{
 try {
  if(!uuid.safeParse(resumeId).success) return {snapshot:null,error:'Choose a resume to preview.'};
  const db=await createSupabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user)return {snapshot:null,error:'Sign in to preview your resume.'};
  const {data:resume,error}=await db.from('resumes').select('title').eq('id',resumeId).eq('user_id',user.id).abortSignal(AbortSignal.timeout(12000)).maybeSingle();
  if(error||!resume)return {snapshot:null,error:'Could not load your resume. Please try again.'};
  const result=await db.from('resume_sections').select('section_key,label,mode,content_html,structured_data').eq('resume_id',resumeId).order('sort_order',{ascending:true}).order('id',{ascending:true}).limit(21).abortSignal(AbortSignal.timeout(12000));
  if(result.error)return {snapshot:null,error:'Could not load your resume. Please try again.'};
  return {snapshot:buildResumeSnapshot(resume.title || 'Untitled resume',result.data),error:null};
 }catch{return {snapshot:null,error:'This resume could not be prepared for sharing. Check its content and try again.'};}
}
export async function readCommunityResumeAction(postId:string):Promise<ViewResult>{
 try {
  if(!uuid.safeParse(postId).success)return unavailable;
  const db=await createSupabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user)return unavailable;
  const {data,error}=await db.rpc('read_community_resume',{p_post_id:postId}).abortSignal(AbortSignal.timeout(12000));
  if(error)return {snapshot:null,error:'Could not load the shared resume. Please try again.'};
  if(!data)return unavailable;
  return {snapshot:sanitizeResumeSnapshot(data),error:null};
 }catch{return {snapshot:null,error:'Could not load the shared resume. Please try again.'};}
}
export async function revokeCommunityResumeAction(postId:string):Promise<{error:string|null}>{
 try {
  if(!uuid.safeParse(postId).success)return {error:'Invalid post.'};
  const db=await createSupabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user)return {error:'Sign in to remove your shared copy.'};
  const {error}=await db.from('community_resume_shares').delete().eq('post_id',postId).eq('user_id',user.id).abortSignal(AbortSignal.timeout(12000));
  return {error:error?'Could not remove the shared copy. Please try again.':null};
 }catch{return {error:'Could not remove the shared copy. Please try again.'};}
}

export async function listOwnedResumeSharesAction(page:number):Promise<{rows:{post_id:string;title:string;created_at:string}[];more:boolean;error:string|null}>{
 try {
  if(!Number.isInteger(page)||page<0||page>250)return {rows:[],more:false,error:'Invalid page.'};
  const db=await createSupabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user)return {rows:[],more:false,error:'Sign in to manage shared copies.'};
  const {data,error}=await db.from('community_resume_shares').select('post_id,created_at,title:snapshot->>title').eq('user_id',user.id).order('created_at',{ascending:false}).order('post_id',{ascending:false}).range(page*20,page*20+20).abortSignal(AbortSignal.timeout(12000));
  if(error)return {rows:[],more:false,error:'Could not load your shared copies. Please try again.'};
  return {rows:(data??[]).slice(0,20).map(row=>({post_id:row.post_id,created_at:row.created_at,title:typeof row.title==='string'?row.title.slice(0,200):'Shared resume'})),more:(data??[]).length>20,error:null};
 }catch{return {rows:[],more:false,error:'Could not load your shared copies. Please try again.'};}
}
