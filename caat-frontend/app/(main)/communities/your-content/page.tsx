import Link from 'next/link';
import {PageHeader} from '@/components/PageHeader';
import {OwnedContentManager} from '@/components/communities/OwnedContentManager';
import {listOwnCommunityContentPageAction} from '../actions';
export const metadata={title:'Your community content | CAAT',robots:{index:false,follow:false}};
export default async function OwnContentPage({searchParams}:{searchParams:Promise<{cursor?:string|string[]}>}){
 const params=await searchParams;
 const cursor=Array.isArray(params.cursor)?'invalid':params.cursor;
 const result=await listOwnCommunityContentPageAction(cursor);
 const href=(value:string)=>`/communities/your-content?cursor=${encodeURIComponent(value)}`;
 return <><PageHeader title="Your content"/><div className="mx-auto w-full max-w-3xl space-y-6 p-6">
  <Link href="/communities" className="text-sm underline">Back to Community Campus</Link>
  <div className="space-y-2"><h1 className="font-serif text-3xl font-semibold">Your community content</h1><p className="text-muted-foreground">Remove your posts and comments, including those in private groups you have left. Only your own text is shown here. A placeholder keeps replies in place; this does not restore access to a group. People may have saved earlier copies.</p></div>
  {result.error?<div role="alert"><p>{result.error}</p>{!result.invalidCursor&&<Link href={cursor?href(cursor):'/communities/your-content'} className="underline">Retry loading content</Link>}</div>:<>
   {result.rows.length?<OwnedContentManager rows={result.rows}/>:<p>No content on this page.</p>}
   <nav aria-label="Your content pages" className="flex gap-4">{result.previous&&<Link href={href(result.previous)} className="underline">Previous content</Link>}{result.next&&<Link href={href(result.next)} className="underline">More content</Link>}</nav>
  </>}
  {cursor!==undefined&&<Link href="/communities/your-content" className="inline-block underline">Newest content</Link>}
 </div></>;
}
