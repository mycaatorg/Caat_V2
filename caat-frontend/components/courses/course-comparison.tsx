import type { CourseOffering } from '@/types/courses';
import { formatCourseFee } from '@/lib/course-data';
import { CourseSource, ProviderLink } from './course-source';

export default function CourseComparison({ courses, checkedAt }: { courses: CourseOffering[]; checkedAt: string }) {
  const years = new Set(courses.filter(c => c.fee_amount !== null && c.fee_year !== null).map(c => c.fee_year));
  const rows: [string, (course: CourseOffering) => React.ReactNode][] = [
    ['Campus', c => c.campus ?? 'Campus not confirmed'],
    ['Duration', c => c.duration ?? 'Duration not confirmed'],
    ['Prerequisites', c => <>{c.prerequisites ?? 'Prerequisites not confirmed. Check the provider.'}{c.prerequisites_url && <p className="mt-2"><ProviderLink href={c.prerequisites_url}>Check prerequisite details</ProviderLink></p>}</>],
    ['Assumed knowledge', c => c.assumed_knowledge ?? 'Assumed knowledge not confirmed'],
    ['Indicative fees', c => formatCourseFee(c)],
    ['How to apply', c => <>{c.application_route ?? 'Application route not confirmed'}<p className="mt-2"><ProviderLink href={c.application_url ?? c.source_url}>Official application instructions</ProviderLink></p></>],
    ['Program and application codes', c => `Program ${c.program_code}${c.uac_code ? `; UAC ${c.uac_code}` : ''}`],
    ['Source', c => <CourseSource course={c} checkedAt={checkedAt} />],
  ];
  return <>
    {years.size > 1 && <p className="mb-4 rounded-md border p-3 text-sm">These fees cover different years. Compare the year, student category and study load before using the amounts.</p>}
    <div role="region" className="overflow-x-auto rounded-md border" tabIndex={0} aria-label="Scroll course comparison horizontally">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Side-by-side comparison of selected university courses</caption>
        <thead><tr><th scope="col" className="p-4 text-left min-w-36 bg-muted">Attribute</th>{courses.map(c => <th scope="col" key={c.id} className="min-w-64 max-w-80 p-4 text-left align-top border-l bg-muted">
          <span className="block font-display text-lg">{c.name}</span><span className="mt-1 block font-normal">{c.institution_name}</span>{!c.active && <span className="block mt-2 font-normal">No longer in the active catalogue</span>}
        </th>)}</tr></thead>
        <tbody>{rows.map(([label, render]) => <tr key={label}><th scope="row" className="p-4 border-t text-left align-top font-medium">{label}</th>{courses.map(c => <td key={c.id} className="p-4 border-t border-l align-top leading-relaxed break-words">{render(c)}</td>)}</tr>)}</tbody>
      </table>
    </div>
    <p className="mt-4 text-sm text-muted-foreground">Assumed knowledge describes expected preparation; it is separate from prerequisites. This comparison does not predict admission or confirm your eligibility.</p>
  </>;
}
