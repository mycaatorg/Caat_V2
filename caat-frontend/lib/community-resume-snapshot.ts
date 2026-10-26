import { z } from 'zod';
import { publishedHtml } from '@/components/resume-builder/publishedHtml';
import { ResumeSnapshotSchema, type ResumeSnapshot } from './community-resume-share-schema';
import { sanitizePostHtml, htmlToText } from './sanitize-html';

const text = z.string().max(20000).default('');
const entry = z.object({ id:text, institution:text, degree:text, field:text, company:text, title:text,
  location:text, startDate:text, endDate:text, current:z.boolean().default(false), gpa:text,
  description:z.string().max(20000).optional(), bullets:z.array(text).max(100).optional() });
const rowsSchema = z.array(z.object({
  section_key:z.string().max(100), label:z.string().max(100), mode:z.enum(['free','guided']),
  content_html:z.string().max(20000).nullable(), structured_data:z.record(z.string(),z.unknown()).nullable().optional(),
})).min(1).max(20);
const escape = (value:string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

/** Never return arbitrary structured metadata or the unpublished draft. */
export function buildResumeSnapshot(title: unknown, rows: unknown): ResumeSnapshot {
  return sanitizeResumeSnapshot({title, sections:rowsSchema.parse(rows).map(row => {
    let html = row.content_html ?? '';
    if (row.mode === 'guided') {
      const data = row.structured_data ?? {};
      if (row.section_key === 'personal') {
        const personal = z.object({fullName:text,email:text,phone:text,location:text,linkedin:text}).parse(data);
        html = `${personal.fullName ? `<p><strong>${escape(personal.fullName)}</strong></p>` : ''}<p>${[personal.email,personal.phone,personal.location,personal.linkedin].filter(Boolean).map(escape).join(' · ')}</p>`;
      } else if (['education','experience'].includes(row.section_key)) {
        const entries = z.array(entry).max(100).parse(data.entries ?? []);
        html = publishedHtml({type:row.section_key,mode:'guided',contentHtml:'',structuredData:{entries}});
      } else if (row.section_key === 'skills') {
        const categories = z.array(z.object({id:text,name:text,skills:text})).max(100).parse(data.categories ?? []);
        html = publishedHtml({type:'skills',mode:'guided',contentHtml:'',structuredData:{categories}});
      }
    }
    return {label:row.label,html};
  })});
}

/** Apply on preview, publication AND read: direct API writers are untrusted too. */
export function sanitizeResumeSnapshot(input: unknown): ResumeSnapshot {
  const parsed = ResumeSnapshotSchema.parse(input);
  const result = {...parsed, sections:parsed.sections.map(s => ({label:s.label,html:sanitizePostHtml(s.html)}))};
  if (!result.sections.some(s => htmlToText(s.html).replace(/&nbsp;/g,'').trim())) throw new Error('Add some resume content before sharing.');
  return ResumeSnapshotSchema.parse(result);
}
