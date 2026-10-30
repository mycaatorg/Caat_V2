import {describe,it,expect} from 'vitest';
import {applicationStage,selectApplications} from '@/lib/application-workspace';
import {APPLICATION_STATUSES,type ApplicationRow} from '@/types/applications';
const row=(id:string,name:string,deadline:string|null=null):ApplicationRow=>({id,user_id:'u',school_id:1,status:'researching',notes:null,deadline_at:deadline,created_at:'2026-01-01',updated_at:'2026-01-01',intended_majors:[],schools:{id:1,name,country:'Australia'}});
describe('application workspace',()=>{
 it('maps all eight manual statuses into honest stages',()=>{
  expect(APPLICATION_STATUSES.map(applicationStage)).toEqual(['researching','preparing','awaiting','awaiting','outcomes','outcomes','outcomes','outcomes']);
 });
 it('searches university and country and combines status filters',()=>{
  const rows=[row('a','Alpha'),{...row('b','Beta'),status:'accepted' as const}];
  expect(selectApplications(rows,'  ALPHA ','all','newest').map(x=>x.id)).toEqual(['a']);
  expect(selectApplications(rows,'AUSTRALIA','outcome','newest').map(x=>x.id)).toEqual(['b']);
 });
 it('sorts deadlines with undated last and ties by id without mutating rows',()=>{
  const rows=[row('c','C'),row('b','B','2026-11-02'),row('a','A','2026-11-02')];
  expect(selectApplications(rows,'','all','deadline').map(x=>x.id)).toEqual(['a','b','c']);
  expect(rows.map(x=>x.id)).toEqual(['c','b','a']);
 });
 it('sorts newest and names deterministically including unavailable school joins',()=>{
  const rows=[{...row('z','Z'),schools:null},{...row('b','Beta'),created_at:'2026-02-01'},row('a','Alpha')];
  expect(selectApplications(rows,'','all','newest').map(x=>x.id)).toEqual(['b','a','z']);
  expect(selectApplications(rows,'','all','university').map(x=>x.id)).toEqual(['a','b','z']);
 });
});
