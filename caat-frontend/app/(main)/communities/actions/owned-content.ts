'use server';
import {z} from 'zod';
import {createSupabaseServer} from '@/lib/supabase-server';
import {htmlToText} from '@/lib/html-text';
// PostgreSQL left(...,500) counts code points; a code point can use two UTF-16 units.
const rowSchema=z.object({kind:z.enum(['post','comment']),id:z.string().uuid(),content:z.string().max(1000),created_at:z.string(),removed:z.boolean()});
export type OwnedCommunityContent=z.infer<typeof rowSchema>;
export async function listOwnCommunityContentAction(page:number):Promise<{rows:OwnedCommunityContent[];more:boolean;error:string|null}>{
 try{
  if(!Number.isInteger(page)||page<0||page>250)return {rows:[],more:false,error:'Invalid page.'};
  const db=await createSupabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user)return {rows:[],more:false,error:'Sign in to manage your content.'};
  const {data,error}=await db.rpc('list_owned_community_content',{p_page:page}).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  const rows=z.array(rowSchema).max(21).parse(data);
  return {rows:rows.slice(0,20).map(row=>({...row,content:htmlToText(row.content)})),more:rows.length>20,error:null};
 }catch{return {rows:[],more:false,error:'Could not load your content. Please try again.'};}
}
export async function removeOwnCommunityContentAction(kind:string,id:string):Promise<{error:string|null}>{
 try{
  if(!z.enum(['post','comment']).safeParse(kind).success||!z.string().uuid().safeParse(id).success)return {error:'Invalid content.'};
  const db=await createSupabaseServer();const {data:{user}}=await db.auth.getUser();
  if(!user)return {error:'Sign in to remove your content.'};
  const {data,error}=await db.rpc('remove_owned_community_content',{p_kind:kind,p_id:id}).abortSignal(AbortSignal.timeout(12000));
  if(error)throw error;
  return {error:data===true?null:'This content is unavailable or is not yours. Refresh and try again.'};
 }catch{return {error:'Could not remove your content. Please try again.'};}
}
