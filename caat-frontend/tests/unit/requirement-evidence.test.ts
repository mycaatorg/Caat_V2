import { rangedFixture } from "./ranged-fixture";
import { beforeEach, expect, it, vi } from "vitest";

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

import { fetchRequirementWork, linkRequirementWork, unlinkRequirementWork, requirementReview } from "@/lib/requirement-evidence";
const call = (q: Ctx, method: string) => q.calls.filter(c=>c.method===method).map(c=>c.args);
const row = { id:"r1", user_id:"user-1", application_id:"app-1", school_id:1, scholarship_id:"sch-1", item_key:"essay", requirement_label:"Essay required", evidence_link_id:"link-1", essay_draft_id:null, created_at:"2026-10-25" };
const input = { applicationId:"app-1", schoolId:1, scholarshipId:"sch-1", itemKey:"essay", label:"Essay required", source:{kind:"evidence" as const,id:"link-1"} };
beforeEach(()=>{state.userId="user-1";state.queries=[];state.resolver=()=>({data:[],error:null});});
it("loads owned associations and application-specific sources with stable pagination",async()=>{
 state.resolver=q=>({data:q.table==="requirement_evidence_links"?rangedFixture([row],q.calls):[]});
 const bundle=await fetchRequirementWork("app-1");
 expect(bundle.links).toEqual([row]);
 for (const q of state.queries) {
  expect(call(q, "eq")).toContainEqual(["user_id", "user-1"]);
  const [from, to] = call(q, "range")[0] as number[];
  expect(to - from).toBe(199);
 }
 for(const q of state.queries.filter(q=>q.table!=="essay_drafts")) expect(call(q,"eq")).toContainEqual(["application_id","app-1"]);
});
it("paginates past the API cap",async()=>{
 state.resolver=q=>({data:q.table==="requirement_evidence_links"?rangedFixture([...Array.from({length:200},(_,i)=>({...row,id:`r${i}`})),{...row,id:"last"}],q.calls):[]});
 expect((await fetchRequirementWork("app-1")).links).toHaveLength(201);
});
it("fails closed on unavailable sources",async()=>{
 state.resolver=q=>q.table==="essay_drafts"?{error:{message:"secret"}}:{data:[]};
 await expect(fetchRequirementWork("app-1")).rejects.toThrow(/load/i);
});
it("links only the association and does not change ticks or sources",async()=>{
 state.resolver=()=>({data:[row]});
 expect(await linkRequirementWork(input)).toEqual(row);
 expect(state.queries).toHaveLength(1);
 expect(call(state.queries[0],"insert")[0][0]).toMatchObject({user_id:"user-1",requirement_label:"Essay required",evidence_link_id:"link-1",essay_draft_id:null});
});
it("reads the exact existing association on a duplicate without rewriting its observed label",async()=>{
 state.resolver=q=>q.op==="insert"?{error:{code:"23505",message:"duplicate"}}:{data:[row]};
 expect(await linkRequirementWork(input)).toEqual(row);
 expect(call(state.queries[1],"eq")).toEqual(expect.arrayContaining([["user_id","user-1"],["application_id","app-1"],["scholarship_id","sch-1"],["item_key","essay"],["evidence_link_id","link-1"]]));
});
it("validates requirement identity before writes",async()=>{
 for(const patch of [{itemKey:"bad"},{label:" "},{label:"x".repeat(10001)}]) await expect(linkRequirementWork({...input,...patch})).rejects.toThrow();
 expect(state.queries).toHaveLength(0);
});
it("never claims success on missing links or failed writes",async()=>{
 await expect(linkRequirementWork(input)).rejects.toThrow();
 await expect(unlinkRequirementWork(row)).rejects.toThrow(/removed|changed/i);
 expect(call(state.queries[1],"eq")).toContainEqual(["user_id","user-1"]);
 expect(call(state.queries[1],"eq")).toContainEqual(["application_id","app-1"]);
});
it("distinguishes changed labels from removed keys without hiding either",()=>{
 expect(requirementReview(row,[{key:"essay",label:"Essay required"}])).toBe(null);
 expect(requirementReview(row,[{key:"essay",label:"No essay recorded"}])).toBe("changed");
 expect(requirementReview({...row,item_key:"rule:01234567"},[{key:"essay",label:"Essay required"}])).toBe("removed");
});
