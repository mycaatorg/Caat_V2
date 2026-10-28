import {expect,it,vi} from "vitest";
import {loadCalendarDeadlines} from "@/lib/deadline-calendar-data";
it("reads only owner due-date sources with unique ordering and keeps existing source rules",async()=>{
 const rows:Record<string,unknown[]>={
  user_school_applications:[{id:'one',deadline_at:'2026-11-01',status:'researching',schools:{name:'Owned application'}},{id:'two',deadline_at:'2026-11-01',status:'withdrawn',schools:{name:'Withdrawn'}}],
  user_bookmarked_scholarships:[{scholarship_id:'public',scholarships:{id:'public',title:'Saved scholarship',deadline_at:'2026-10-29T00:00:00Z'}},{scholarship_id:'unknown',scholarships:{id:'unknown',title:'Undated',deadline_at:null}}],
  user_scholarships:[{id:'custom',title:'Personal deadline',deadline_at:'2026-10-30',status:'interested'},{id:'past',title:'Expired',deadline_at:'2026-10-01',status:'interested'}],
 };
 const calls:{table:string;owner:unknown;order:unknown;select:unknown}[]=[];
 const client={from:vi.fn((table:string)=>{const call={table,owner:undefined as unknown,order:undefined as unknown,select:undefined as unknown};calls.push(call);const q={select:(v:string)=>{call.select=v;return q;},eq:(key:string,v:string)=>{expect(key).toBe('user_id');call.owner=v;return q;},not:()=>q,order:(v:string)=>{call.order=v;return q;},range:async(from:number,to:number)=>({data:rows[table].slice(from,to+1),error:null})};return q;})};
 const result=await loadCalendarDeadlines(client as unknown as Parameters<typeof loadCalendarDeadlines>[0],'owner','2026-10-29');
 expect(result.map(x=>x.title)).toEqual(['Saved scholarship','Personal deadline','Owned application']);
 for(const call of calls){expect(call.owner).toBe('owner');expect(call.order).toBe(call.table==='user_bookmarked_scholarships'?'scholarship_id':'id');expect(call.select).not.toMatch(/\*|notes|description/);}
 expect(new Set(calls.map(c=>c.table))).toEqual(new Set(Object.keys(rows)));
});
