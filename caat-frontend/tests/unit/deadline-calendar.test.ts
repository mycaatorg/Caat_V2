import { describe, expect, it, vi } from "vitest";
import { calendarPages, serializeDeadlineCalendar } from "@/lib/deadline-calendar";
import type { UnifiedDeadline } from "@/lib/unified-deadlines";
const row: UnifiedDeadline = {id:"app-one",source:"app",title:"University, Arts; Sciences",dateISO:"2028-02-29",href:"/applications/one"};
const now=new Date("2026-10-29T02:03:04Z");
const make=(rows:UnifiedDeadline[],user="owner")=>serializeDeadlineCalendar(rows,user,now);
describe("calendar snapshot",()=>{
 it("preserves leap-day all-day dates and uses an exclusive next day",()=>{
  const text=make([row]);expect(text).toContain("DTSTART;VALUE=DATE:20280229\r\nDTEND;VALUE=DATE:20280301");
  expect(text).toContain("DTSTAMP:20261029T020304Z");expect(text).toContain("SUMMARY:University\\, Arts\\; Sciences");
  expect(text).toContain("URL:https://mycaat.com/applications/one");expect(text).toContain("CLASS:PRIVATE");
  expect(text).not.toContain("VALARM");expect(text).toMatch(/END:VCALENDAR\r\n$/);
 });
 it("folds Unicode by bytes and prevents property injection",()=>{
  const title="🎓É".repeat(50)+"\\notes\r\nBEGIN:VEVENT\nATTENDEE:intruder";
  const text=make([{...row,title}]);for(const line of text.split("\r\n"))expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  const unfolded=text.replace(/\r\n /g,"");expect(unfolded.match(/\r\nBEGIN:VEVENT\r\n/g)).toHaveLength(1);
  expect(unfolded).toContain("\\\\notes\\nBEGIN:VEVENT\\nATTENDEE:intruder");expect(unfolded).toContain("🎓É".repeat(50));
 });
 it("uses stable account-scoped UIDs and safely advances year-end",()=>{
  const uid=(text:string)=>text.match(/UID:[^\r]+/)?.[0];expect(uid(make([row]))).toBe(uid(make([{...row,title:"New title"}])));expect(uid(make([row],"peer"))).not.toBe(uid(make([row])));
  expect(make([{...row,dateISO:"2026-12-31"}])).toContain("DTEND;VALUE=DATE:20270101");
 });
 it("rejects invalid dates and off-site links rather than emitting misleading events",()=>{
  expect(()=>make([{...row,dateISO:"2026-02-30"}])).toThrow();expect(()=>make([{...row,href:"//evil.example/path"}])).toThrow();
 });
 it("does not export timed appointments as date-only deadlines",()=>expect(()=>make([{...row,source:"event"}])).toThrow());
});
describe("bounded calendar pages",()=>{
 it("keeps reading short server-capped pages until empty",async()=>{
  const data=Array.from({length:205},(_,id)=>({id}));const fetch=vi.fn(async(from:number,to:number)=>({data:data.slice(from,Math.min(from+37,to+1)),error:null}));
  expect(await calendarPages(fetch)).toEqual(data);expect(fetch).toHaveBeenLastCalledWith(205,404);
 });
 it("fails closed on source errors or a source that never ends",async()=>{
  await expect(calendarPages(async()=>({data:null,error:{message:"private detail"}}))).rejects.toThrow("Could not prepare your calendar");
  await expect(calendarPages(async()=>({data:[1],error:null}),{maxPages:2})).rejects.toThrow();
 });
});
