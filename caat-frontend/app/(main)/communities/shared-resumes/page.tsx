import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { ResumeInlinePreview } from '@/components/communities/ResumeInlinePreview';
import { listOwnedResumeSharesAction } from '../actions';

export const metadata={title:'Your shared resumes | CAAT',robots:{index:false,follow:false}};
export default async function SharedResumesPage({searchParams}:{searchParams:Promise<{page?:string}>}){
 const params=await searchParams;const page=/^\d{1,3}$/.test(params.page??'')?Number(params.page):0;
 const result=await listOwnedResumeSharesAction(page);
 return <><PageHeader title="Shared resumes"/><div className="mx-auto w-full max-w-3xl space-y-6 p-6">
  <Link className="text-sm underline" href="/communities">Back to Community Campus</Link>
  <div className="space-y-2"><h1 className="font-serif text-3xl font-semibold">Your shared resumes</h1><p className="text-muted-foreground">Manage the copies you published with community posts, including posts in groups you have left. Removing a copy keeps your private draft saved. Readers may have already saved what they saw.</p></div>
  {result.error?<div role="alert" className="space-y-2"><p>{result.error}</p><Link href={`/communities/shared-resumes?page=${page}`} className="underline">Retry loading copies</Link></div>:<>
   {result.rows.length?<ul className="space-y-4">{result.rows.map(row=><li key={row.post_id} className="space-y-2"><h2 className="font-medium">{row.title}</h2><Link className="text-sm underline" href={`/communities/${row.post_id}`}>Open original post</Link><ResumeInlinePreview postId={row.post_id} isOwner management/></li>)}</ul>:<p>No shared copies on this page.</p>}
   <nav aria-label="Shared resume pages" className="flex gap-4">{page>0&&<Link className="underline" href={`/communities/shared-resumes?page=${page-1}`}>Previous copies</Link>}{result.more&&<Link className="underline" href={`/communities/shared-resumes?page=${page+1}`}>More copies</Link>}</nav>
  </>}
 </div></>;
}
