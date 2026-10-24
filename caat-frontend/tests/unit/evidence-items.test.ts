import { beforeEach, describe, expect, it, vi } from "vitest";

type Ctx = { table: string; op: string; calls: { method: string; args: unknown[] }[] };
type Result = { data?: unknown; error?: { message: string; code?: string } | null };
const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  queries: [] as Ctx[],
  resolver: (() => ({ data: null, error: null })) as (ctx: Ctx) => Result,
}));

vi.mock("@/lib/current-user", () => ({ getClientUserId: () => Promise.resolve(state.userId) }));
vi.mock("@/lib/supabase/client", () => {
  const build = (table: string) => {
    const ctx: Ctx = { table, op: "select", calls: [] };
    state.queries.push(ctx);
    const b: Record<string, unknown> = {};
    const pass = (method: string, op?: string) => (...args: unknown[]) => {
      ctx.calls.push({ method, args });
      if (op) ctx.op = op;
      return b;
    };
    for (const m of ["select", "eq", "in", "order", "limit", "is", "not", "range"]) b[m] = pass(m);
    for (const m of ["insert", "update", "upsert", "delete"]) b[m] = pass(m, m);
    b.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve(state.resolver(ctx)).then(f, r);
    return b;
  };
  const client = { from: (t: string) => build(t) };
  return { supabase: client, getBrowserClient: () => client };
});

import * as items from "@/lib/evidence-items";
import * as links from "@/lib/evidence-item-links";
const input = { kind: "activity" as const, title: "Debate", description: "Led practice", organisation: "Club", role: "Captain", start_date: null, end_date: null, is_current: false };
const source = { ...input, id: "item-1", user_id: "user-1", revision: "v1", created_at: "2026-10-24", origin_key: null };
const row = { id: "link-1", application_id: "app-1", evidence_item_id: source.id, revision: "r1", source_revision: null, tailored_at: null, tailored_title: null, tailored_body: null, evidence_items: source };
const call = (q: Ctx, method: string) => q.calls.filter(c=>c.method===method).map(c=>c.args);
beforeEach(()=>{state.userId="user-1";state.queries=[];state.resolver=()=>({data:[],error:null});});
describe("evidence library writes",()=>{
 it("reads beyond the first API page without dropping saved items",async()=>{
  state.resolver=q=>({data:call(q,"range")[0]?.[0]===200 ? [{...source,id:"last-item"}] : Array.from({length:200},(_,i)=>({...source,id:`item-${i}`}))});
  const result=await items.listEvidenceItems();
  expect(result).toHaveLength(201);
  expect(result[200].id).toBe("last-item");
 });
 it("rejects blank/long titles and invalid dates before a database write",async()=>{
  for(const patch of [{title:" "},{title:"x".repeat(201)},{start_date:"2026-02-30"},{start_date:"2026-02-02",end_date:"2026-02-01"}]) await expect(items.createEvidenceItem({...input,...patch})).rejects.toThrow();
  expect(state.queries).toHaveLength(0);
 });
 it("does not report success for zero-row stale edits or deletions",async()=>{
  await expect(items.updateEvidenceItem(source,input)).rejects.toThrow(/changed|removed/i);
  expect(call(state.queries[0],"eq")).toContainEqual(["revision","v1"]);
  await expect(items.deleteEvidenceItem(source)).rejects.toThrow(/changed|removed/i);
 });
 it("keeps an edited imported item when the same import is repeated",async()=>{
  state.resolver=q=>q.op==="insert"?{error:{code:"23505",message:"duplicate"}}:{data:[{...source,title:"My edited title"}]};
  expect((await items.createEvidenceItem(input,"activity:debate")).title).toBe("My edited title");
  expect(state.queries.map(q=>q.op)).toEqual(["insert","select"]);
  expect(call(state.queries[1],"eq")).toContainEqual(["origin_key","activity:debate"]);
 });
 it("reports linked-source deletion without deleting any links",async()=>{
  state.resolver=()=>({error:{code:"23503",message:"foreign key"}});
  await expect(items.deleteEvidenceItem(source)).rejects.toThrow(/unlink/i);
  expect(state.queries.map(q=>q.table)).toEqual(["evidence_items"]);
 });
 it("distinguishes unavailable items and usage from an empty library",async()=>{
  state.resolver=()=>({error:{message:"offline"}});
  await expect(items.listEvidenceItems()).rejects.toThrow();
  await expect(items.fetchItemUsage()).rejects.toThrow();
 });
});
describe("item links",()=>{
 it("can tailor a maximum-length description together with its metadata",async()=>{
  state.resolver=()=>({data:[row]});
  const [seen]=await links.fetchItemLinks("app-1");
  const full=items.evidenceText({...input,description:"x".repeat(10000),organisation:"o".repeat(200),role:"r".repeat(200)});
  await expect(links.tailorItem(seen,{title:"Complete version",body:full})).resolves.toMatchObject({id:"link-1"});
 });
 it("reads only owned item links and maps their current source",async()=>{
  state.resolver=()=>({data:[row]});
  const result=await links.fetchItemLinks("app-1");
  expect(result[0].item?.title).toBe("Debate");
  expect(call(state.queries[0],"eq")).toEqual([["user_id","user-1"],["application_id","app-1"],["kind","item"]]);
 });
 it("snapshots complete text and acknowledges only the source that was seen",async()=>{
  state.resolver=()=>({data:[row]});
  const [seen]=await links.fetchItemLinks("app-1");
  state.queries=[];
  await links.tailorItem(seen,{title:"For this school",body:"My snapshot"});
  const write=state.queries[0];
  expect(write.table).toBe("application_evidence_links");
  expect(call(write,"update")[0][0]).toMatchObject({tailored_title:"For this school",tailored_body:"My snapshot",source_revision:"v1"});
  expect(call(write,"eq")).toContainEqual(["revision","r1"]);
 });
 it("detects a new source revision without comparing device clocks",async()=>{
  state.resolver=()=>({data:[{...row,tailored_at:"1900-01-01",tailored_title:"Mine",source_revision:"v0"}]});
  const [seen]=await links.fetchItemLinks("app-1");
  expect(links.itemSourceChanged(seen)).toBe(true);
  expect(links.itemSourceChanged({...seen,sourceRevision:"v1"})).toBe(false);
 });
 it("refuses silent zero-row tailoring/unlink and touches only links",async()=>{
  state.resolver=()=>({data:[row]});
  const [seen]=await links.fetchItemLinks("app-1");
  state.resolver=()=>({data:[]});state.queries=[];
  await expect(links.tailorItem(seen,{title:"Mine",body:""})).rejects.toThrow(/changed|removed/i);
  await expect(links.unlinkItem(seen)).rejects.toThrow(/changed|removed/i);
  expect(state.queries.every(q=>q.table==="application_evidence_links")).toBe(true);
 });
});
