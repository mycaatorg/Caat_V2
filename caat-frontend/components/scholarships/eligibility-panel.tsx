import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { EligibilityReport } from '@/lib/scholarship-eligibility';

const labels = { matched: 'Matches your profile', unmet: 'Does not match your profile', unknown: 'Needs checking' };
const colours = { matched: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200', unmet: 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200', unknown: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' };
function dateLabel(value: string) { return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }

export default function EligibilityPanel({ report }: { report: EligibilityReport }) {
  return <Card className="mb-6" role="region" aria-labelledby="eligibility-check-title">
    <CardHeader>
      <h2 id="eligibility-check-title" className="text-base font-semibold font-display">Check your eligibility</h2>
      <p className="text-sm text-muted-foreground">Recommendations suggest opportunities to explore. The provider decides eligibility; a matching criterion is not an offer or a complete eligibility decision.</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium">{report.counts.matched + report.counts.unmet > 0 ? `${report.counts.matched} matching · ${report.counts.unmet} not matching · ${report.counts.unknown} to check` : `${report.counts.unknown} criteria need checking · eligibility unconfirmed`}</p>
        <p>{report.freshness === 'stale' ? 'Last verification was more than 90 days ago. Check the current requirements before relying on this record.' : report.freshness === 'unverified' ? 'No valid verification date is available. Eligibility remains unconfirmed.' : 'Recently recorded verification is a starting point; requirements can still change.'}</p>
        {report.verifiedAt && <p>Recorded verification: <time dateTime={report.verifiedAt}>{dateLabel(report.verifiedAt)}</time></p>}
        {report.syncedAt && <p className="text-muted-foreground">Last imported: <time dateTime={report.syncedAt}>{dateLabel(report.syncedAt)}</time>. Importing is not a new verification.</p>}
        {report.sourceUrl ? <a className="font-medium underline underline-offset-4" href={report.sourceUrl} target="_blank" rel="noopener noreferrer">Check the provider’s current requirements <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a> : <p>Source link unavailable. Find the scholarship on the provider’s official website.</p>}
      </div>
      <ul className="divide-y">
        {report.criteria.map(criterion => <li key={criterion.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{criterion.label}</h3>
            <span className={`rounded-md px-2 py-1 text-xs font-medium ${colours[criterion.status]}`}>{labels[criterion.status]}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-line break-words">{criterion.reason}</p>
        </li>)}
      </ul>
    </CardContent>
  </Card>;
}
