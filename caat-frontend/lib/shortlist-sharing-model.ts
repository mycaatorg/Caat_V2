import type {Shortlist} from '@/lib/shortlist';
import type {ShareKind,SharedItem,SharedSnapshot} from '@/types/shortlist-sharing';
const kinds=new Set(['course','school','major','scholarship']);
export const SHARE_KIND_LABEL:Record<ShareKind,string>={course:'Course',school:'University',major:'Major',scholarship:'Scholarship'};
export function parseSharedItems(value:unknown):SharedItem[]{
 if(!Array.isArray(value)||value.length<1||value.length>20)throw new Error('Invalid shared items');
 return value.map((item:unknown)=>{
  if(!item||typeof item!=='object')throw new Error('Invalid shared item');
  const r=item as Record<string,unknown>;
  if(typeof r.kind!=='string'||!kinds.has(r.kind)||typeof r.id!=='string'||typeof r.title!=='string'||!Array.isArray(r.details)||!r.details.every(d=>typeof d==='string')||(r.sourceUrl!==null&&typeof r.sourceUrl!=='string'))throw new Error('Invalid shared item');
  return{kind:r.kind as ShareKind,id:r.id,title:r.title,details:r.details as string[],sourceUrl:r.sourceUrl as string|null};
 });
}
export function parseSharedSnapshot(value:unknown):SharedSnapshot{
 if(!value||typeof value!=='object')throw new Error('Invalid shared shortlist');
 const r=value as Record<string,unknown>;
 if(typeof r.created_at!=='string'||!Number.isFinite(Date.parse(r.created_at))||typeof r.expires_at!=='string'||!Number.isFinite(Date.parse(r.expires_at)))throw new Error('Invalid shared dates');
 return{items:parseSharedItems(r.items),created_at:r.created_at,expires_at:r.expires_at};
}
export function newShareToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
export function shareLink(origin:string,token:string){if(!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid link');return `${new URL(origin).origin}/share/shortlist#${token}`;}
export function shareCandidates(list:Shortlist):{kind:ShareKind;id:string;label:string;description:string}[]{
 return [
  ...list.courses.filter(c=>c.active).map(c=>({kind:'course' as const,id:c.id,label:c.name,description:[c.institutionName,c.campus].filter(Boolean).join(' · ')})),
  ...list.schools.map(s=>({kind:'school' as const,id:String(s.id),label:s.name,description:s.country??''})),
  ...list.majors.map(m=>({kind:'major' as const,id:m.id,label:m.name,description:m.category??''})),
  ...list.scholarships.filter(s=>s.active===true).map(s=>({kind:'scholarship' as const,id:s.id,label:s.title,description:s.provider??''})),
 ];
}
export const shareKey=(item:{kind:ShareKind;id:string})=>`${item.kind}:${item.id}`;
