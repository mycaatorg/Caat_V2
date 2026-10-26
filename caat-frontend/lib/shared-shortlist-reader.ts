import {createClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database';
import type {SharedSnapshot} from '@/types/shortlist-sharing';
import {parseSharedSnapshot} from '@/lib/shortlist-sharing-model';
import {bounded} from '@/lib/share-request';

export async function readSharedShortlist(token:string):Promise<SharedSnapshot|null>{
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 // Never reuse the signed-in browser client for recipient capabilities.
 const reader=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store'})},
 });
 const data=await bounded(signal=>reader.rpc('read_shortlist_share',{p_token:token}).abortSignal(signal),'Could not check this shared link. Try again.');
 return data===null?null:parseSharedSnapshot(data);
}
