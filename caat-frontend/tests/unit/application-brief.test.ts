import { expect, it } from 'vitest';
import { briefHub } from './application-brief-fixture';
import { buildApplicationBrief, briefDate } from '@/lib/application-brief';
const preparedAt='2026-10-30T00:00:00Z';
it('allowlists recorded preparation and excludes notes and unrelated data by default',()=>{
 const hub=briefHub();const before=JSON.stringify(hub);
 const result=buildApplicationBrief(hub,{preparedAt});
 expect(result.schoolName).toBe('Example University');expect(result.status).toBe('Applying');expect(result.majors).toEqual(['Law']);
 expect(result.essays).toEqual([{key:'school:p1',title:'Why this school',scope:'This school',status:'Draft saved'},{key:'shared:p2',title:'Personal statement',scope:'Shared',status:'To write'}]);
 expect(result.documents.map(d=>d.status)).toEqual(['Pending review','Missing']);expect(result.checks.every(c=>c.recorded)).toBe(true);
 expect(result.notes).toBeNull();expect(JSON.stringify(result)).not.toContain('Private application notes');expect(JSON.stringify(result)).not.toContain('Global major');expect(JSON.stringify(result)).not.toContain('user_id');expect(JSON.stringify(hub)).toBe(before);
});
it('includes notes only when explicitly requested and leaves empty work honest',()=>{
 const hub=briefHub({intendedMajors:[],essaysForSchool:[],essaysShared:[],schoolDocuments:[],sharedDocuments:[]});
 expect(buildApplicationBrief(hub,{preparedAt,includeNotes:true}).notes).toBe('Private application notes');
 const result=buildApplicationBrief(hub,{preparedAt});expect(result.majors).toEqual([]);expect(result.essays).toEqual([]);expect(result.documents).toEqual([]);
});
it('formats date-only deadlines in UTC and rejects invalid dates',()=>{
 expect(briefDate('2026-12-01')).toBe('1 December 2026');expect(briefDate(null)).toBe('Not recorded');expect(briefDate('2026-02-30')).toBe('Not recorded');
});

import { scholarshipBriefHub } from './application-brief-fixture';
import { ruleKey } from '@/lib/requirements-checklist';
it('keeps scholarship details out by default and includes only exact attachments when selected',()=>{
 const hub=scholarshipBriefHub();const before=JSON.stringify(hub);
 expect(buildApplicationBrief(hub,{preparedAt}).scholarships).toBeNull();
 const section=buildApplicationBrief(hub,{preparedAt,includeScholarships:true}).scholarships;
 expect(section?.state).toBe('ready');
 if(section?.state!=='ready')throw new Error('Expected complete scholarships');
 expect(section.awards).toHaveLength(1);expect(section.awards[0]).toMatchObject({title:'Attached award',provider:'Example Foundation',inactive:true});
 expect(section.awards[0].sourceNote).toContain('over 90 days');
 expect(section.awards[0].items.find(i=>i.key==='deadline')?.tick).toBe('Marked prepared');
 expect(section.awards[0].items.find(i=>i.key==='essay')?.tick).toBe('No preparation tick recorded');
 expect(JSON.stringify(section)).not.toContain('Other application award');expect(JSON.stringify(section)).not.toContain('Unattached suggestion');
 expect(JSON.stringify(section)).not.toContain('Private application notes');expect(JSON.stringify(section)).not.toContain('user_id');expect(JSON.stringify(hub)).toBe(before);
});
it.each(['savedScholarshipsUnavailable','prepChecksUnavailable'] as const)('does not expose partial scholarship work when %s is true',key=>{
 expect(buildApplicationBrief(scholarshipBriefHub({[key]:true}),{preparedAt,includeScholarships:true}).scholarships).toEqual({state:'unavailable'});
});
it('distinguishes no attachments from unavailable sources and uses checked-with-provider wording for rules',()=>{
 expect(buildApplicationBrief(scholarshipBriefHub({savedScholarships:[]}),{preparedAt,includeScholarships:true}).scholarships).toEqual({state:'ready',awards:[]});
 const hub=scholarshipBriefHub({prepChecks:{award:[ruleKey('Check the residency rule')]}});
 hub.savedScholarships[0].checklist.external_url='javascript:alert(1)';
 const section=buildApplicationBrief(hub,{preparedAt,includeScholarships:true}).scholarships;
 if(section?.state!=='ready')throw new Error('Expected complete scholarships');
 expect(section.awards[0].items.find(i=>i.key.startsWith('rule:'))?.tick).toBe('Marked checked with the provider');
 expect(section.awards[0].items.find(i=>i.key==='official-link')?.href).toBeNull();
});

it('prints custom draft titles and scope without navigation IDs or essay bodies (PROD-267)',()=>{
 const hub=briefHub({essaysForSchool:[{promptId:'custom',promptSlug:'custom',draftId:'private-draft-id',title:'My statement — School version',status:'drafted',lastEdited:null}],essaysShared:[]});
 const result=buildApplicationBrief(hub,{preparedAt});
 expect(result.essays).toEqual([{key:'school:custom',title:'My statement — School version',scope:'This school',status:'Draft saved'}]);
 expect(JSON.stringify(result)).not.toContain('private-draft-id');expect(result.essays[0]).not.toHaveProperty('content');
});
