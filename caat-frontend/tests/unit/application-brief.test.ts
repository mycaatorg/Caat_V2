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
