import type {BriefCourseFacts} from '@/lib/application-brief-extras';
import { CHECKLIST_NOTICE } from '@/lib/requirements-checklist';
import { briefDate, type ApplicationBrief, type BriefRow } from '@/lib/application-brief';
function WorkTable({rows,label}:{rows:BriefRow[];label:string}) {
 return rows.length ? <table aria-label={label}><thead><tr><th scope="col">Work</th><th scope="col">Applies to</th><th scope="col">Recorded status</th></tr></thead><tbody>{rows.map(row=><tr key={row.key}><td>{row.title}</td><td>{row.scope}</td><td>{row.status}</td></tr>)}</tbody></table> : <p>No {label.toLowerCase()} recorded.</p>;
}
function CourseFacts({facts}:{facts:BriefCourseFacts|null}) {
 if(!facts)return <p>Current course information is unavailable. Check with the provider.</p>;
 return <div>
  <p>{facts.name??'Name not recorded'} · {facts.programCode??'Program code not recorded'} · {facts.campus??'Campus not recorded'}</p>
  <p className="brief-notes">{facts.text??'No information recorded. Check with the provider; this does not mean there is no requirement.'}</p>
  {facts.url&&<p className="brief-source-note"><a href={facts.url} target="_blank" rel="noopener noreferrer">Provider details: {facts.url}</a></p>}
  {facts.sourceUrl&&<p className="brief-source-note"><a href={facts.sourceUrl} target="_blank" rel="noopener noreferrer">Course source: {facts.sourceUrl}</a></p>}
  <p className="brief-source-note">Source year: {facts.sourceYear??'not recorded'} · {facts.sourceNote}</p>
 </div>;
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
  {brief.scholarships && <section aria-label="Attached scholarship checklists">
   <h2>Attached scholarship checklists</h2>
   {brief.scholarships.state === 'unavailable' ? <p>This section is unavailable. Refresh the brief or exclude it before printing.</p> : <>
    <p>{CHECKLIST_NOTICE}</p>
    {brief.scholarships.awards.length === 0 ? <p>No scholarships are attached to this application.</p> : brief.scholarships.awards.map(award => <div key={award.key} className="brief-award">
     <h3>{award.title}</h3><p>{award.provider} · Recorded tracking status: {award.status}</p>
     {award.inactive && <p>No longer active in CAAT’s catalogue.</p>}
     <p className="brief-source-note">{award.sourceNote}</p>
     <table aria-label={`Checklist for ${award.title}`}><thead><tr><th scope="col">Recorded requirement or next check</th><th scope="col">Your preparation</th></tr></thead>
      <tbody>{award.items.map(item => <tr key={item.key}><td>
       {item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a> : item.label}
       {item.detail && <p>{item.detail}</p>}
       <p className="brief-source-note">{item.source} · {item.sourceSuffix}</p>
      </td><td>{item.tick}</td></tr>)}</tbody>
     </table>
    </div>)}
   </>}
  </section>}
  {brief.courses&&<section aria-label="Course preparation in this brief"><h2>Course preparation</h2>
   <p>These are personal preparation checks, not confirmation of eligibility or a submitted application. Check the provider before applying.</p>
   {brief.courses.state!=='ready'?<p>{brief.courses.state==='loading'?'Loading course preparation…':'Course preparation is unavailable. Refresh or exclude it before printing.'}</p>:brief.courses.rows.length===0?<p>No course preparation recorded for this application.</p>:brief.courses.rows.map(course=><div key={course.key} className="brief-award">
    <h3>{course.title}{course.code?` · ${course.code}`:''}{course.campus?` · ${course.campus}`:''}</h3>
    {!course.saved&&<p>No longer saved. Previous preparation is retained.</p>}
    {!course.available&&<p>This course is unavailable for this application. Confirm current information with the provider.</p>}
    <table aria-label={`Preparation for ${course.title}`}><thead><tr><th scope="col">Recorded information and next check</th><th scope="col">Your preparation</th></tr></thead><tbody>{course.items.map(item=><tr key={item.key}><td>
     <strong>{item.label}</strong>{item.guidance&&<p>Preparation guidance, not automatically an entry requirement.</p>}
     {item.previous&&<div><p><strong>Previously saved information</strong></p><CourseFacts facts={item.previous}/><p>Recorded information changed or is unavailable. Review it with the provider before continuing.</p></div>}
     <p><strong>Current recorded information</strong></p><CourseFacts facts={item.current}/>
    </td><td>{item.status}</td></tr>)}</tbody></table>
   </div>)}
  </section>}
  {brief.personalTasks&&<section aria-label="Personal application tasks in this brief"><h2>Personal application tasks</h2>
   <p>Your own preparation steps, not official requirements. Completing them does not submit an application.</p>
   {brief.personalTasks.state!=='ready'?<p>{brief.personalTasks.state==='loading'?'Loading personal tasks…':'Personal tasks are unavailable. Refresh or exclude them before printing.'}</p>:brief.personalTasks.rows.length===0?<p>No personal tasks linked to this application.</p>:<table aria-label="Personal application tasks"><thead><tr><th scope="col">Personal task</th><th scope="col">Due date</th><th scope="col">Recorded status</th></tr></thead><tbody>{brief.personalTasks.rows.map(task=><tr key={task.key}><td className="brief-notes">{task.text}</td><td>{task.date}</td><td>{task.status}</td></tr>)}</tbody></table>}
  </section>}
  {brief.notes && <section><h2>Application notes</h2><p className="brief-notes">{brief.notes}</p></section>}
  <footer>This is a snapshot of your records in CAAT. It is not a university submission or confirmation. Check official application requirements and deadlines before submitting.</footer>
 </article>;
}
