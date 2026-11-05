import { briefDate, type ApplicationBrief, type BriefRow } from '@/lib/application-brief';
function WorkTable({rows,label}:{rows:BriefRow[];label:string}) {
 return rows.length ? <table aria-label={label}><thead><tr><th scope="col">Work</th><th scope="col">Applies to</th><th scope="col">Recorded status</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><td>{row.title}</td><td>{row.scope}</td><td>{row.status}</td></tr>)}</tbody></table> : <p>No {label.toLowerCase()} recorded.</p>;
}
export function ApplicationBriefDocument({brief}:{brief:ApplicationBrief}) {
 return <article className="application-brief-document" aria-label="Application planning brief">
  <header><p className="brief-eyebrow">CAAT / Application planning brief</p><h1>{brief.schoolName}</h1>{brief.country && <p>{brief.country}</p>}
   <p className="brief-timestamp">Prepared {brief.preparedAt.slice(0,16).replace('T',' ')} UTC</p>
  </header>
  <dl className="brief-facts"><div><dt>Recorded status</dt><dd>{brief.status}</dd></div><div><dt>Application deadline</dt><dd>{briefDate(brief.deadline)}</dd></div><div><dt>Intended majors</dt><dd>{brief.majors.length?brief.majors.join(', '):'Not recorded for this application'}</dd></div></dl>
  <section><h2>Preparation recorded in CAAT</h2><p>These checks track saved work, not admission eligibility.</p><ul className="brief-checks">{brief.checks.map(check=><li key={check.label}><span>{check.label}</span><strong>{check.recorded?'Recorded':'Not yet recorded'}</strong></li>)}</ul></section>
  <section><h2>Writing</h2><WorkTable rows={brief.essays} label="Writing"/></section>
  <section><h2>Documents</h2><WorkTable rows={brief.documents} label="Documents"/></section>
  {brief.notes && <section><h2>Application notes</h2><p className="brief-notes">{brief.notes}</p></section>}
  <footer>This is a snapshot of your records in CAAT. It is not a university submission or confirmation. Check official application requirements and deadlines before submitting.</footer>
 </article>;
}
