import {describe,it,expect} from 'vitest';
import {parseSharedSnapshot,newShareToken,shareLink,shareCandidates} from '@/lib/shortlist-sharing-model';
import type {Shortlist} from '@/lib/shortlist';
describe('recipient boundary',()=>{
 it('returns only approved fields even if a response adds private metadata',()=>{
  const parsed=parseSharedSnapshot({items:[{kind:'school',id:'1',title:'School',details:['Australia'],sourceUrl:null,application:{id:'secret'}}],created_at:'2026-10-27T00:00:00Z',expires_at:'2026-11-26T00:00:00Z',user_id:'secret'});
  expect(parsed).toEqual({items:[{kind:'school',id:'1',title:'School',details:['Australia'],sourceUrl:null}],created_at:'2026-10-27T00:00:00Z',expires_at:'2026-11-26T00:00:00Z'});
 });
 it('rejects malformed or oversized shared snapshots',()=>{
  expect(()=>parseSharedSnapshot({items:[{kind:'document'}]})).toThrow();
  expect(()=>parseSharedSnapshot({items:Array(21).fill({kind:'school',id:'1',title:'S',details:[],sourceUrl:null}),created_at:'x',expires_at:'y'})).toThrow();
 });
 it('uses high-entropy fragment capabilities without query tokens',()=>{
  const a=newShareToken(),b=newShareToken();expect(a).toMatch(/^[a-f0-9]{64}$/);expect(a).not.toBe(b);
  expect(shareLink('https://www.mycaat.com',a)).toBe(`https://www.mycaat.com/share/shortlist#${a}`);
 });
 it('never includes private status or application data in selection candidates',()=>{
  const list={courses:[],majors:[],scholarships:[],schools:[{id:1,name:'School',country:'AU',application:{id:'private',status:'submitted'}}]} as Shortlist;
  expect(shareCandidates(list)).toEqual([{kind:'school',id:'1',label:'School',description:'AU'}]);
 });
});
it('omits unavailable scholarship choices without removing active saved choices',()=>{
 const list={courses:[],majors:[],schools:[],scholarships:[{id:'active',title:'Open scholarship',active:true,provider:'Foundation'},{id:'inactive',title:'Retired scholarship',active:false,provider:'Foundation'}]} as unknown as Shortlist;
 expect(shareCandidates(list).map(c=>c.id)).toEqual(['active']);
});
