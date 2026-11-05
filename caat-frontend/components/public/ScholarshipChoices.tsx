import Link from 'next/link';
import { publicScholarshipPath } from '@/lib/public-scholarship-identity';
import { safeHref } from '@/lib/safe-href';
import { formatAmountDisplay, type ScholarshipRow } from '@/types/scholarships';

/** Older shared links may refer to multiple imported listings. Show the facts
 * needed to choose without merging records or changing anyone's saved award. */
export function ScholarshipChoices({ scholarships }: { scholarships: ScholarshipRow[] }) {
  return <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10 lg:px-8">
    <Link href="/scholarship" className="text-sm text-[#525252] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a1a27]">All scholarships</Link>
    <h1 className="mt-6 font-serif text-3xl font-bold leading-tight md:text-4xl">Choose a scholarship</h1>
    <p className="mt-4 max-w-xl text-[#525252]">More than one listing uses this link. Compare the details below and choose the scholarship you want to view.</p>
    <ul className="mt-8 divide-y divide-[#e5e5e5] border-y border-[#e5e5e5]">
      {scholarships.map((s, index) => {
        const source = safeHref(s.external_url);
        const date = s.deadline_at ? new Date(s.deadline_at) : null;
        const deadline = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
        const amount = formatAmountDisplay(s);
        const context = `${s.provider_name?.trim() || 'provider not recorded'}, ${amount}, ${deadline ? `recorded deadline ${deadline}` : 'deadline not recorded'}, listing ${index + 1} of ${scholarships.length}`;
        return <li key={s.id} className="py-6">
          <p className="text-sm font-medium text-[#9a1a27]">{s.provider_name}</p>
          <h2 className="mt-1 font-serif text-xl font-semibold">
            <Link href={publicScholarshipPath(s.slug!, s.id)} className="underline decoration-[#e5e5e5] underline-offset-4 hover:decoration-[#9a1a27] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a1a27] focus-visible:outline-offset-4">{s.title}{" "}<span className="sr-only">— {context}</span></Link>
          </h2>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-[#525252]">Award</dt><dd className="font-medium">{amount}</dd></div>
            <div><dt className="text-[#525252]">Recorded deadline</dt><dd>{deadline ?? 'Not recorded'}</dd></div>
          </dl>
          {!s.is_active && <p className="mt-3 text-sm text-[#525252]">This listing is no longer active.</p>}
          {source && <a href={source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block max-w-full break-all text-sm text-[#525252] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a1a27]">Official scholarship page{" "}<span className="sr-only">for {s.title} — {context}</span></a>}
        </li>;
      })}
    </ul>
    <p className="mt-5 text-sm text-[#525252]">Check the official source for current details before applying.</p>
  </main>;
}
