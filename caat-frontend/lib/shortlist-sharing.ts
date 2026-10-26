import {supabase} from '@/lib/supabase/client';
import {getClientUserId} from '@/lib/current-user';
import {loadShortlist} from '@/lib/shortlist';
import {evidencePages} from '@/lib/evidence-pagination';
import {parseSharedItems,parseSharedSnapshot,shareCandidates} from '@/lib/shortlist-sharing-model';
import type {ShareSelection,SharedItem,ShareRecord} from '@/types/shortlist-sharing';

import {bounded} from '@/lib/share-request';
const SAVE_ERROR='Could not confirm the link change. Refresh your links, or retry the same action.';
function one(rows:ShareRecord[]|null){if(rows?.length!==1)throw new Error(SAVE_ERROR);const row=rows[0];return{...row,...parseSharedSnapshot(row)};}
export async function loadShareCandidates(){
 const uid=await getClientUserId();
 if(!uid)throw new Error('Sign in again to view shared links.');const list=await bounded(async signal=>({data:await loadShortlist(supabase,uid,signal),error:null}),'Could not load saved items. Try again.');
 if(!list)throw new Error('Could not load saved items.');return shareCandidates(list);
}
export async function loadShares():Promise<ShareRecord[]>{
 const uid=await getClientUserId();
 if(!uid)throw new Error('Sign in again to view shared links.');
 const rows=await evidencePages(async(from,to)=>({data:await bounded(signal=>supabase.from('shortlist_shares').select('*').eq('user_id',uid).order('created_at',{ascending:false}).order('id').range(from,to).abortSignal(signal),'Could not load shared links. Try again.'),error:null}),'Could not load shared links.');
 return rows.map(r=>({...r,...parseSharedSnapshot(r)}));
}
export async function previewShare(selection:ShareSelection){
 return parseSharedItems(await bounded(signal=>supabase.rpc('preview_shortlist_share',{p_selection:selection}).abortSignal(signal),'Could not preview these items. Try again.'));
}
export async function createShare(selection:ShareSelection,items:SharedItem[],token:string){
 return one(await bounded(signal=>supabase.rpc('create_shortlist_share',{p_selection:selection,p_expected_items:items,p_token:token}).abortSignal(signal),SAVE_ERROR));
}
export async function replaceShare(share:ShareRecord,token:string){
 return one(await bounded(signal=>supabase.rpc('replace_shortlist_share',{p_id:share.id,p_expected_revision:share.revision,p_token:token}).abortSignal(signal),SAVE_ERROR));
}
export async function revokeShare(id:string){return one(await bounded(signal=>supabase.rpc('revoke_shortlist_share',{p_id:id}).abortSignal(signal),SAVE_ERROR));}
export async function removeShare(id:string){
 const data=await bounded(signal=>supabase.from('shortlist_shares').delete().eq('id',id).select('id').abortSignal(signal),'Could not remove this link. Refresh and try again.');
 if(data?.length!==1)throw new Error('Could not remove this link. Refresh and try again.');
}
