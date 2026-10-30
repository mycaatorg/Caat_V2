import { expect, it } from 'vitest';
import { selectLibrary } from '@/lib/library-workspace';
import type { EvidenceItem } from '@/lib/evidence-items';
const item=(id:string,patch:Partial<EvidenceItem>={}):EvidenceItem=>({id,user_id:'owner',kind:'activity',title:id,organisation:null,role:null,start_date:null,end_date:null,is_current:false,description:'',origin_key:null,revision:'v1',created_at:'2026-01-01',...patch});
const usage={a:[{applicationId:'app',schoolName:'Sydney',tailored:false}]};
it('combines text, type and linked filters across all searchable fields',()=>{
 const rows=[item('a',{title:'Debating',organisation:'School club',role:'Captain',description:'Mentored peers'}),item('b',{kind:'award',title:'Debating prize'}),item('c')];
 expect(selectLibrary(rows,usage,{query:' CAPTAIN ',kind:'activity',usage:'linked'}).map(i=>i.id)).toEqual(['a']);
 for(const query of ['school CLUB','mentored','debating'])expect(selectLibrary(rows,usage,{query,usage:'linked'}).map(i=>i.id)).toEqual(['a']);
 expect(selectLibrary(rows,usage,{query:'debating',usage:'unlinked'}).map(i=>i.id)).toEqual(['b']);
 expect(selectLibrary(rows,usage,{kind:'experience'})).toEqual([]);
});
it('sorts added dates both ways with invalid dates last and stable ties without mutating inputs',()=>{
 const rows=[item('z',{created_at:'invalid'}),item('b',{created_at:'2020-01-01'}),item('a',{created_at:'2020-01-01'}),item('n',{created_at:'2030-01-01'})];
 expect(selectLibrary(rows,{},{}).map(i=>i.id)).toEqual(['n','a','b','z']);
 expect(selectLibrary(rows,{}, {sort:'oldest'}).map(i=>i.id)).toEqual(['a','b','n','z']);
 expect(rows.map(i=>i.id)).toEqual(['z','b','a','n']);
});
it('sorts titles and resolves equal titles by id',()=>{
 expect(selectLibrary([item('b',{title:'Alpha'}),item('z',{title:'Zulu'}),item('a',{title:'Alpha'})],{},{sort:'name'}).map(i=>i.id)).toEqual(['a','b','z']);
});
