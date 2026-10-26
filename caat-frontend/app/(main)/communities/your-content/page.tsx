import Link from 'next/link';
import {PageHeader} from '@/components/PageHeader';
import {OwnedContentManager} from '@/components/communities/OwnedContentManager';
import {listOwnCommunityContentAction} from '../actions';
export const metadata={title:'Your community content | CAAT',robots:{index:false,follow:false}};
export default async function OwnContentPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const params=await searchParams;const page=/^\d{1,3}$/.test(params.page??'')?Number(params.page):0;
 const result=await listOwnCommunityContentAction(page);
 return <><PageHeader title="Your content"/><div className="mx-auto w-full max-w-3xl space-y-6 p-6">
  <Link href="/communities" className="text-sm underline">Back to Community Campus</Link>
  <div className="space-y-2"><h1 className="font-serif text-3xl font-semibold">Your community content</h1><p className="text-muted-foreground">Remove your posts and comments, including those in private groups you have left. Only your own text is shown here. A placeholder keeps replies in place; this does not restore access to a group. People may have saved earlier copies.</p></div>
  {result.error?<div role="alert"><p>{result.error}</p><Link href={`/communities/your-content?page=${page}`} className="underline">Retry loading content</Link></div>:<>
   {result.rows.length?<OwnedContentManager rows={result.rows}/>:<p>No content on this page.</p>}
   <nav aria-label="Your content pages" className="flex gap-4">{page>0&&<Link href={`/communities/your-content?page=${page-1}`} className="underline">Previous content</Link>}{result.more&&<Link href={`/communities/your-content?page=${page+1}`} className="underline">More content</Link>}</nav>
  </>}
 </div></>;
}
