// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase/client',()=>({supabase:{}}));
import { activityCandidates, experienceCandidates } from '@/lib/evidence-imports';
describe('explicit evidence imports',()=>{
 it('deduplicates activity names without changing source text',()=>{
  const input=[' Debate ', 'debate', 'Music', '', null];
  const result=activityCandidates(input);
  expect(result.map(c=>c.input.title)).toEqual(['Debate','Music']);
  expect(input[0]).toBe(' Debate ');
 });
 it('copies rich-text experience and preserves imprecise dates as text',()=>{
  const result=experienceCandidates('section-1',{entries:[{id:'e1',title:'Volunteer',company:'Food bank',startDate:'Jan 2024',endDate:'',current:true,location:'Sydney',description:'<p>Sorted <b>donations</b>.</p><p>Led shifts.</p>'}]});
  expect(result).toHaveLength(1);
  expect(result[0].key).toBe('resume:section-1:e1');
  expect(result[0].input).toMatchObject({kind:'experience',title:'Volunteer',organisation:'Food bank',start_date:null,end_date:null});
  expect(result[0].input.description).toContain('Jan 2024');
  expect(result[0].input.description).toContain('Present');
  expect(result[0].input.description).toContain('Sorted donations.');
  expect(result[0].input.description).not.toContain('<');
 });
 it('skips malformed or unidentified entries and retains legacy bullets',()=>{
  const result=experienceCandidates('s',{entries:[null,{}, {id:'empty'}, {id:'valid',company:'Club',bullets:['Built a team','Held events']}]});
  expect(result).toHaveLength(1);
  expect(result[0].input.description).toContain('Built a team\nHeld events');
 });
});
