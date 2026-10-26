import { beforeEach, describe, expect, it, vi } from "vitest";

type Query = { table: string; filters: Array<{ method: string; args: unknown[] }> };
type QueryResult = { data: unknown; error: { message: string } | null };

const state = vi.hoisted(() => ({
  user: { id: "user-1", email: "ada@example.test" } as { id: string; email?: string } | null,
  queries: [] as Query[],
  resolve: null as unknown as (query: Query) => QueryResult,
  getUser: vi.fn(),
  clientError: null as Error | null,
}));

vi.mock("next/server", () => ({
  NextResponse: class extends Response {
    static json(value: unknown, init?: ResponseInit) {
      return new Response(JSON.stringify(value), {
        ...init,
        headers: { "Content-Type": "application/json", ...init?.headers },
      });
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    if (state.clientError) throw state.clientError;
    return ({
    auth: { getUser: state.getUser },
    from: (table: string) => {
      const query: Query = { table, filters: [] };
      state.queries.push(query);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "filter", "in", "order", "range"]) {
        builder[method] = (...args: unknown[]) => {
          if (method === "filter" && args[1] === "eq") query.filters.push({ method: "eq", args: [args[0], args[2]] });
          else if (method !== "select") query.filters.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(state.resolve(query)).then(resolve, reject);
      return builder;
    },
  });
  },
}));

import { GET } from "@/app/(main)/settings/export/route";

beforeEach(() => {
  state.user = { id: "user-1", email: "ada@example.test" };
  state.queries = [];
  state.clientError = null;
  state.resolve = () => ({ data: [], error: null });
  state.getUser.mockReset().mockImplementation(async () => ({ data: { user: state.user }, error: null }));
});

describe("settings data export route", () => {
  it("denies unauthenticated export without querying account data", async () => {
    state.user = null;

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
    expect(state.queries).toHaveLength(0);
  });

  it("scopes owned rows and related child rows to the signed-in account", async () => {
    state.resolve = (query) => {
      if (query.table === "standardised_test_scores") return { data: [{ id: "score-1" }], error: null };
      if (query.table === "resumes") return { data: [{ id: "resume-1" }], error: null };
      return { data: [], error: null };
    };

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveProperty("evidence_items");
    expect(payload.data).toHaveProperty("requirement_evidence_links");
    expect(payload.account).toEqual({ id: "user-1", email: "ada@example.test" });
    expect(state.queries.find((query) => query.table === "profiles")?.filters).toEqual(expect.arrayContaining([
      { method: "eq", args: ["id", "user-1"] },
    ]));
    for (const query of state.queries.filter((item) => !["profiles", "standardised_test_scores", "standardised_test_subjects", "resumes", "resume_sections", "community_groups", "community_blocks", "community_follows"].includes(item.table))) {
      expect(query.filters).toContainEqual({ method: "eq", args: ["user_id", "user-1"] });
    }
    expect(state.queries.find((query) => query.table === "standardised_test_scores")?.filters).toContainEqual({
      method: "eq", args: ["profile_id", "user-1"],
    });
    expect(state.queries.find((query) => query.table === "standardised_test_subjects")?.filters).toContainEqual({
      method: "in", args: ["test_score_id", ["score-1"]],
    });
    expect(state.queries.find((query) => query.table === "resume_sections")?.filters).toContainEqual({
      method: "in", args: ["resume_id", ["resume-1"]],
    });
    expect(state.queries.find((query) => query.table === "community_groups")?.filters).toContainEqual({
      method: "eq", args: ["creator_id", "user-1"],
    });
  });

  it.each([
    "profiles",
    "standardised_test_scores",
    "standardised_test_subjects",
    "resumes",
    "resume_sections",
    "community_groups",
    "calendar_events",
    "user_todos",
    "user_recommenders",
    "user_scholarships",
    "user_school_applications",
    "user_school_notes",
    "user_bookmarked_schools",
    "user_bookmarked_scholarships",
    "user_scholarship_prep_checks",
    "application_evidence_links",
    "evidence_items",
    "requirement_evidence_links",
    "user_bookmarked_majors",
    "custom_essay_prompts",
    "essay_drafts",
    "documents",
    "dashboard_layouts",
    "user_dashboard_widgets",
    "community_posts",
    "community_comments",
    "community_group_members",
    "notifications",
  ])("returns a generic error instead of a partial export when %s query fails", async (failedTable) => {
    state.resolve = (query) => {
      if (query.table === failedTable) return { data: null, error: { message: "sensitive database details" } };
      if (query.table === "standardised_test_scores") return { data: [{ id: "score-1" }], error: null };
      if (query.table === "resumes") return { data: [{ id: "resume-1" }], error: null };
      return { data: [], error: null };
    };

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Could not export your data. Please try again." });
    expect(JSON.stringify(body)).not.toContain("sensitive database details");
  });
});

 it.each(["evidence_items", "requirement_evidence_links"])("exports every page of %s", async (table) => {
   state.resolve = q => ({data:q.table===table?(q.filters.some(f=>f.method==="range"&&f.args[0]===200)?[{id:"last"}]:Array.from({length:200},(_,i)=>({id:`item-${i}`}))):[],error:null});
   const response=await GET();
   expect(response.status).toBe(200);
   expect((await response.json()).data[table]).toHaveLength(201);
 });

const newCollections = ["user_course_bookmarks", "community_comment_likes", "community_group_requests", "community_likes", "community_poll_votes", "community_profile_settings", "community_saves", "community_blocks", "community_follows"];

it.each(newCollections)("includes owned %s and fails closed when it cannot be read", async table => {
  const response = await GET();
  expect((await response.json()).data).toHaveProperty(table);
  const owner = table === "community_blocks" ? "blocker_id" : table === "community_follows" ? "follower_id" : "user_id";
  expect(state.queries.find(q => q.table === table)?.filters).toContainEqual({method:"eq",args:[owner,"user-1"]});
  state.resolve = q => ({data:[],error:q.table === table ? {message:"private database detail"}:null});
  const failed = await GET();
  expect(failed.status).toBe(500);
  expect(failed.headers.get("Cache-Control")).toBe("no-store");
  expect(await failed.json()).toEqual({error:"Could not export your data. Please try again."});
});

it("paginates existing collections and fails rather than downloading a partial later page", async () => {
  state.resolve = q => ({data:q.table === "user_todos" ? (q.filters.find(f=>f.method === "range")?.args[0] === 200 ? [{id:"last"}] : Array.from({length:200},(_,i)=>({id:String(i)}))) : [],error:null});
  expect((await (await GET()).json()).data.user_todos).toHaveLength(201);
  state.resolve = q => ({data:q.table === "user_todos" ? Array.from({length:200},(_,i)=>({id:String(i)})) : [],error:q.table === "user_todos" && q.filters.find(f=>f.method === "range")?.args[0] === 200 ? {message:"private failure"} : null});
  const failed = await GET();
  expect(failed.status).toBe(500);
  expect(await failed.json()).not.toHaveProperty("data");
});

it("uses stable complete composite ordering and bounds every page", async () => {
  await GET();
  const keys: Record<string,string[]> = {
    community_resume_shares:["post_id"],
    user_scholarship_prep_checks:["user_id","scholarship_id","item_key"],
    community_blocks:["blocker_id","blocked_id"], community_follows:["follower_id","followee_id"],
    community_group_members:["group_id","user_id"], community_group_requests:["group_id","user_id"],
    community_comment_likes:["comment_id","user_id"], community_likes:["post_id","user_id"],
    community_poll_votes:["post_id","user_id"], community_saves:["post_id","user_id"],
    user_bookmarked_majors:["user_id","major_id"], user_bookmarked_schools:["user_id","school_id"],
    user_bookmarked_scholarships:["user_id","scholarship_id"], user_course_bookmarks:["user_id","course_id"],
    user_school_notes:["user_id","school_id"], dashboard_layouts:["user_id"], community_profile_settings:["user_id"],
  };
  for (const q of state.queries) {
    expect(q.filters.filter(f=>f.method === "order").map(f=>f.args[0]),q.table).toEqual(keys[q.table] ?? ["id"]);
    expect(q.filters,q.table).toContainEqual({method:"range",args:[0,199]});
  }
  expect(state.queries.some(q=>q.table === "community_reports")).toBe(false);
});

it.each([
  ["resumes","resume_sections","resume_id"],
  ["standardised_test_scores","standardised_test_subjects","test_score_id"],
])("paginates %s and batches only owned parent IDs for %s", async (parent,child,foreignKey) => {
  const parents = Array.from({length:201},(_,i)=>({id:`owned-${i}`}));
  state.resolve = q => {
    const [from,to] = (q.filters.find(f=>f.method === "range")?.args ?? [0,199]) as number[];
    if(q.table === parent) return {data:parents.slice(from,to+1),error:null};
    if(q.table === child) {
      const ids = q.filters.find(f=>f.method === "in")?.args[1] as string[];
      expect(ids.length).toBeLessThanOrEqual(100);
      expect(ids.every(id=>id.startsWith("owned-"))).toBe(true);
      // Three child rows per parent exercises child pagination inside each batch.
      const rows = ids.flatMap(id=>[0,1,2].map(i=>({id:`${id}-${i}`,[foreignKey]:id})));
      return {data:rows.slice(from,to+1),error:null};
    }
    return {data:[],error:null};
  };
  const response = await GET();
  expect(response.status).toBe(200);
  const data = (await response.json()).data;
  expect(data[parent]).toHaveLength(201);
  expect(data[child]).toHaveLength(603);
  expect(new Set(data[child].map((r:{id:string})=>r.id)).size).toBe(603);
  const childQueries = state.queries.filter(q=>q.table === child);
  expect(childQueries).toHaveLength(5);
  expect(childQueries.every(q=>q.filters.some(f=>f.method === "in" && f.args[0] === foreignKey))).toBe(true);
});

it("documents download scope, skips child reads with no owned parents, and prevents caching", async () => {
  const response = await GET();
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const payload = await response.json();
  expect(payload.scope.excludes).toEqual(expect.arrayContaining(["uploaded_file_contents","authentication_secrets","moderation_reports"]));
  expect(state.queries.some(q=>["resume_sections","standardised_test_subjects"].includes(q.table))).toBe(false);
  state.user=null;
  expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
});

it.each(["resume_sections", "standardised_test_subjects"])("rejects the whole export when a later %s batch fails", async child => {
  const parent = child === "resume_sections" ? "resumes" : "standardised_test_scores";
  state.resolve = q => {
    if (q.table === parent) return {data:Array.from({length:101},(_,i)=>({id:`parent-${i}`})),error:null};
    if (q.table === child) {
      const ids = q.filters.find(f=>f.method === "in")?.args[1] as string[];
      return {data:ids.map(id=>({id})),error:ids.includes("parent-100") ? {message:"secret child failure"} : null};
    }
    return {data:[],error:null};
  };
  const response = await GET();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({error:"Could not export your data. Please try again."});
});

it.each(["client", "auth"])("returns a generic noncached error when %s setup throws", async source => {
  if (source === "client") state.clientError = new Error("sensitive connection details");
  else state.getUser.mockRejectedValueOnce(new Error("sensitive auth details"));
  const response = await GET();
  expect(response.status).toBe(500);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({error:"Could not export your data. Please try again."});
  expect(state.queries).toHaveLength(0);
});
