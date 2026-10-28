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

const cursorSchema = z.object({
 created_at: z.string().datetime({offset: true}),
 id: z.string().uuid(),
 kind: z.enum(['post', 'comment']),
 direction: z.enum(['older', 'newer']),
}).strict();
const cursorRowSchema = rowSchema.extend({created_at: z.string().datetime({offset: true})});
function contentCursor(row: OwnedCommunityContent, direction: 'older' | 'newer') {
 return Buffer.from(JSON.stringify({created_at: row.created_at, id: row.id, kind: row.kind, direction})).toString('base64url');
}

/** Opaque navigation tuples are not authorization: the RPC always scopes to auth.uid(). */
export async function listOwnCommunityContentPageAction(cursor?: string | null): Promise<{
 rows: OwnedCommunityContent[]; next: string | null; previous: string | null;
 error: string | null; invalidCursor: boolean;
}> {
 const empty = {rows: [], next: null, previous: null, invalidCursor: false};
 let anchor: z.infer<typeof cursorSchema> | null = null;
 if (cursor != null) {
  try {
   if (typeof cursor !== 'string' || cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error('Invalid cursor');
   anchor = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
  } catch {
   return {...empty, invalidCursor: true, error: 'This content link is no longer valid. Open your newest content to continue.'};
  }
 }
 try {
  const db = await createSupabaseServer();
  const {data: {user}} = await db.auth.getUser();
  if (!user) return {...empty, error: 'Sign in to manage your content.'};
  const {data, error} = await db.rpc('list_owned_community_content_page', anchor ? {
   p_created_at: anchor.created_at, p_id: anchor.id, p_kind: anchor.kind, p_direction: anchor.direction,
  } : {}).abortSignal(AbortSignal.timeout(12000));
  if (error) throw error;
  const fetched = z.array(cursorRowSchema).max(21).parse(data);
  const rows = fetched.slice(0, 20);
  const newer = anchor?.direction === 'newer';
  // The reverse query returns the nearest rows first; discard its sentinel BEFORE reversing.
  if (newer) rows.reverse();
  const next = rows.length && (newer || fetched.length > 20) ? contentCursor(rows[rows.length - 1], 'older') : null;
  const previous = rows.length && (newer ? fetched.length > 20 : anchor !== null) ? contentCursor(rows[0], 'newer') : null;
  return {rows: rows.map(row => ({...row, content: htmlToText(row.content)})), next, previous, error: null, invalidCursor: false};
 } catch {
  return {...empty, error: 'Could not load your content. Please try again.'};
 }
}
