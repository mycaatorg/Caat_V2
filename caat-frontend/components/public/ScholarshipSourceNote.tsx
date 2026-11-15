import type { ScholarshipSourceState } from '@/lib/scholarship-eligibility';

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

export function ScholarshipSourceNote({ source }: { source: ScholarshipSourceState }) {
  return <section aria-labelledby="recorded-details-heading" className="border border-[#e5e5e5] bg-[#fafafa] p-5 mb-10 text-sm text-[#404040] leading-relaxed">
    <h2 id="recorded-details-heading" className="font-serif text-base font-semibold text-black mb-2">Recorded details</h2>
    <p className="mb-3">{source.freshness === 'stale'
      ? 'Verification was last recorded more than 90 days ago. Check current requirements with the provider.'
      : source.freshness === 'unverified'
        ? 'No valid verification date is recorded. Check current requirements with the provider.'
        : 'Recently recorded verification is a starting point; requirements can still change.'}</p>
    {source.verifiedAt && <p>Recorded verification: <time dateTime={source.verifiedAt}>{dateLabel(source.verifiedAt)}</time></p>}
    {source.syncedAt && <p>Last imported: <time dateTime={source.syncedAt}>{dateLabel(source.syncedAt)}</time>. Importing is not a new verification.</p>}
    <p className="mt-3">{source.sourceUrl
      ? 'Confirm availability, deadlines and eligibility on the provider’s official page before applying.'
      : 'Find the scholarship on the provider’s official website to confirm availability, deadlines and eligibility.'}</p>
  </section>;
}
