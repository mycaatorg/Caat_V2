import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatAmountDisplay, type ScholarshipRow } from '@/types/scholarships';
import { requirementsChecklist, type RequirementsChecklist } from '@/lib/requirements-checklist';
import { scholarshipSourceState, type ScholarshipSourceState } from '@/lib/scholarship-eligibility';

type Choice = { row: ScholarshipRow; checklist: RequirementsChecklist; source: ScholarshipSourceState; position: number };
const list = (values: unknown) => Array.isArray(values) && values.some(value => typeof value === 'string' && value.trim())
  ? values.filter(value => typeof value === 'string' && value.trim()).join(', ') : 'Not recorded';
const day = (value: string) => new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const frequencies = { one_time: 'One-time award', yearly: 'Yearly', semester: 'Each semester', monthly: 'Monthly', custom: 'Custom schedule — check the provider' };
function funding(row: ScholarshipRow) {
  const amount = formatAmountDisplay(row);
  if (amount === 'See Details') return 'Amount not recorded';
  if (row.amount_value != null && !row.amount_currency && formatAmountDisplay({ ...row, amount_value: null }) === 'See Details') return `${row.amount_value.toLocaleString('en-AU')} (currency not recorded)`;
  if (row.amount_value != null && row.amount_currency && !['AUD', 'GBP', 'EUR', 'USD'].includes(row.amount_currency) && formatAmountDisplay({ ...row, amount_value: null }) === 'See Details') return `${row.amount_currency} ${row.amount_value.toLocaleString('en-AU')}`;
  return <>{amount}{row.amount_currency && <span className="block text-xs text-muted-foreground">Recorded currency: {row.amount_currency}</span>}</>;
}
function rules(choice: Choice, kinds: string[]) {
  const items = choice.checklist.items.filter(item => kinds.includes(item.kind));
  return items.length ? <ul className="space-y-2">{items.map(item => <li key={item.key}>{item.label}{item.detail && <p className="mt-1 text-muted-foreground">{item.detail}</p>}</li>)}</ul> : 'Eligibility requirements not recorded';
}

export default function ScholarshipComparison({ scholarships, now }: { scholarships: ScholarshipRow[]; now: Date }) {
  const choices: Choice[] = scholarships.map((row, index) => ({ row, checklist: requirementsChecklist(row, now), source: scholarshipSourceState(row, now), position: index + 1 }));
  const attributes: [string, (choice: Choice) => ReactNode][] = [
    ['Recorded funding', choice => funding(choice.row)],
    ['Payment schedule', choice => choice.row.frequency ? frequencies[choice.row.frequency] ?? 'Not recorded' : 'Not recorded'],
    ['Recorded deadline', choice => choice.checklist.items.find(item => item.kind === 'deadline')?.label ?? 'No closing date recorded'],
    ['Study level', choice => list(choice.row.study_level)],
    ['Field of study', choice => list(choice.row.field_of_study)],
    ['Recorded citizenship', choice => list(choice.row.citizenships)],
    ['Recorded eligibility', choice => rules(choice, ['rule'])],
    ['Application steps', choice => rules(choice, ['separate-application', 'essay'])],
    ['Source and verification', choice => <div className="space-y-3">
      <p>{choice.checklist.sourceNote}</p>
      {choice.source.syncedAt && <p>Last imported: {day(choice.source.syncedAt)}. Importing is not a new verification.</p>}
      {choice.source.sourceUrl ? <a className="underline underline-offset-4" href={choice.source.sourceUrl} target="_blank" rel="noopener noreferrer">Official source{" "}<span className="sr-only">for {choice.row.title}, listing {choice.position} (opens in a new tab)</span></a> : <p>No safe official link recorded. Check the provider’s website.</p>}
    </div>],
  ];
  return <>
    <p className="mb-4 text-sm text-muted-foreground">Compare the recorded details, then check each provider. Amounts may cover different costs or payment periods; this comparison does not confirm eligibility.</p>
    <div role="region" aria-label="Scroll scholarship comparison horizontally" tabIndex={0} className="max-w-full overflow-x-auto rounded-md border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9a1a27]">
      <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: `${176 + choices.length * 280}px` }}>
        <caption className="sr-only">Side-by-side comparison of selected scholarships</caption>
        <colgroup><col style={{ width: 176 }} />{choices.map(choice => <col key={choice.row.id} style={{ width: 280 }} />)}</colgroup>
        <thead><tr><th scope="col" className="bg-muted p-4 text-left">Recorded detail</th>{choices.map(({ row, position }) => <th scope="col" key={row.id} className="border-l bg-muted p-4 text-left align-top [overflow-wrap:anywhere]">
          <Link href={`/scholarships/${encodeURIComponent(row.id)}`} className="font-display text-lg underline underline-offset-4">{row.title}{" "}<span className="sr-only">— listing {position}</span></Link>
          <span className="mt-2 block font-normal">{row.provider_name || 'Provider not recorded'}</span>
          {!row.is_active && <span className="mt-2 block font-normal">No longer active. Check current availability.</span>}
        </th>)}</tr></thead>
        <tbody>{attributes.map(([label, render]) => <tr key={label}><th scope="row" className="border-t p-4 text-left align-top font-medium">{label}</th>{choices.map(choice => <td key={choice.row.id} className="border-l border-t p-4 align-top leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">{render(choice)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  </>;
}
