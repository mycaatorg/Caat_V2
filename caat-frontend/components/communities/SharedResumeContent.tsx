import { memo } from 'react';
import type { ResumeSnapshot } from '@/lib/community-resume-share-schema';

/** Only accepts the server-sanitized sharing DTO, never raw builder sections. */
export const SharedResumeContent = memo(function SharedResumeContent({snapshot}:{snapshot:ResumeSnapshot}) {
 return <article aria-label="Shared resume content" className="space-y-6 break-words rounded-lg border bg-background p-4 text-foreground sm:p-6">
  <h3 className="font-serif text-xl font-semibold">{snapshot.title}</h3>
  {snapshot.sections.map((section,index)=><section key={index} className="space-y-2">
   <h4 className="border-b pb-1 text-sm font-semibold uppercase tracking-wide">{section.label}</h4>
   <div className="prose prose-sm max-w-none dark:prose-invert [&_a]:break-all [&_a]:underline [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5" dangerouslySetInnerHTML={{__html:section.html}}/>
  </section>)}
 </article>;
});
