import {safeHref} from '@/lib/safe-href';
import {SHARE_KIND_LABEL} from '@/lib/shortlist-sharing-model';
import type {SharedItem} from '@/types/shortlist-sharing';

export function SharePreview({items}:{items:SharedItem[]}) {
 return <ol data-share-preview className="divide-y border">
  {items.map(item=>{const href=safeHref(item.sourceUrl);return <li key={`${item.kind}:${item.id}`} className="p-5 break-words">
   <p className="font-code text-[10px] uppercase tracking-widest text-muted-foreground">{SHARE_KIND_LABEL[item.kind]}</p>
   <h3 className="mt-1 font-display text-xl">{item.title}</h3>
   {item.details.map((detail,i)=><p key={i} className="mt-1 text-sm text-muted-foreground">{detail}</p>)}
   {href?<a className="mt-3 inline-block text-sm underline underline-offset-4" href={href} target="_blank" rel="noopener noreferrer">View official source<span className="sr-only"> for {item.title} (opens in a new tab)</span></a>:null}
  </li>;})}
 </ol>;
}
