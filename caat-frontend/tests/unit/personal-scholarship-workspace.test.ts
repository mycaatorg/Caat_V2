import {describe,it,expect} from 'vitest';
import {scholarshipDateKey,scholarshipDeadlineGroup,selectPersonalScholarships} from '@/lib/personal-scholarship-workspace';
import type {UserScholarship} from '@/app/(main)/scholarships/user-scholarships-api';
const row=(id:string,title:string,deadline_at:string|null):UserScholarship=>({id,title,deadline_at,user_id:'u',provider_name:'Rotary',country:'Australia',created_at:'2026-01-01',updated_at:'2026-01-01',description:null,amount_display:null,amount_value:null,amount_currency:'AUD',awards_count:null,frequency:null,study_level:[],funding_type:[],eligible_countries:[],external_url:null,notes:null});
describe('personal scholarship planning',()=>{
 it('validates dates without normalizing impossible calendar days',()=>{
  expect(scholarshipDateKey('2026-10-30T12:00:00Z')).toBe('2026-10-30');
  for(const date of [null,'bad','2026-02-30','2025-02-29','2026-13-01'])expect(scholarshipDateKey(date)).toBeNull();
  expect(scholarshipDateKey('2028-02-29')).toBe('2028-02-29');
 });
 it('uses inclusive local today and separates past and undated',()=>{
  expect(['2026-10-29','2026-10-30','2026-10-31',null,'bad'].map(d=>scholarshipDeadlineGroup(row('a','A',d),'2026-10-30'))).toEqual(['past','upcoming','upcoming','undated','undated']);
 });
 it('combines case-insensitive name/provider/country search with deadline filters',()=>{
  const rows=[row('a','Travel Award','2026-11-01'),row('b','Past Award','2025-01-01')];
  for(const query of [' travel ','ROTARY','australia'])expect(selectPersonalScholarships(rows,query,'upcoming','deadline','2026-10-30').map(r=>r.id)).toEqual(['a']);
 });
 it('sorts date, newest and name deterministically without modifying input',()=>{
  const rows=[row('z','Zed',null),row('b','Beta','2026-11-01'),{...row('a','Alpha','2026-11-01'),created_at:'2026-02-01'}];
  for(const sort of ['deadline','newest','name'] as const)expect(selectPersonalScholarships(rows,'','all',sort,'2026-10-30').map(r=>r.id)).toEqual(['a','b','z']);
  expect(rows.map(r=>r.id)).toEqual(['z','b','a']);
 });
});
