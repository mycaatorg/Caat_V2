import { describe, it, expect, vi, beforeEach } from "vitest";

// Controllable singleton mock, hoisted so the SUT sees it at module load.
const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  resolver: (() => ({ data: null, error: null })) as (ctx: { table: string; op: string; from?: number }) => {
    data?: unknown;
    error?: { message: string } | null;
  },
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));

vi.mock("@/lib/current-user", () => ({
  getClientUserId: () => Promise.resolve(state.userId),
}));

// Keep the error passthrough deterministic so tests can assert on the message.
vi.mock("@/lib/safe-error", () => ({
  sanitizeError: (e: unknown) =>
    typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : "error",
}));

vi.mock("@/lib/supabase/client", () => {
  const build = (table: string) => {
    const ctx: {table: string; op: string; from?: number} = { table, op: "select" };
    const b: Record<string, unknown> = {};
    const rec = (method: string, args: unknown[]) => state.calls.push({ table, method, args });
    const pass =
      (op?: string) =>
      (...args: unknown[]) => {
        if (op) (ctx as { op: string }).op = op;
        rec(op ?? "filter", args);
        return b;
      };
    for (const m of ["select", "eq", "in", "order", "ilike", "limit"]) {
      b[m] = (...args: unknown[]) => {
        rec(m, args);
        return b;
      };
    }
    b.range = (from: number, to: number) => { ctx.from = from; rec("range", [from, to]); return b; };
    b.insert = pass("insert");
    b.update = pass("update");
    b.delete = pass("delete");
    b.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
      Promise.resolve(state.resolver(ctx)).then(f, r);
    b.maybeSingle = () => Promise.resolve(state.resolver(ctx));
    b.single = () => Promise.resolve(state.resolver(ctx));
    return b;
  };
  const client = { from: (t: string) => build(t) };
  return { supabase: client, getBrowserClient: () => client };
});

import {
  fetchApplications,
  addApplication,
  updateApplication,
  updateApplicationMajors,
  deleteApplication,
  fetchApplicationForSchool,
  searchSchools,
  fetchUnimportedBookmarkCount,
  importBookmarkedSchools,
  fetchPreparationInputs,
} from "@/app/(main)/applications/api";

beforeEach(() => {
  state.userId = "user-1";
  state.resolver = () => ({ data: null, error: null });
  state.calls = [];
});

describe("auth guard", () => {
  it("throws Not authenticated when there is no user id", async () => {
    state.userId = null;
    await expect(fetchApplications()).rejects.toThrow("Not authenticated");
  });
});

describe("fetchApplications", () => {
  it("returns the rows on success", async () => {
    state.resolver = ({from}) => ({ data: from ? [] : [{ id: "a1" }, { id: "a2" }], error: null });
    const rows = await fetchApplications();
    expect(rows).toHaveLength(2);
  });

  it("reads past short server-capped pages with stable owner ordering", async () => {
    const all = Array.from({length:5},(_,i)=>({id:`a${i}`}));
    state.resolver = ({from=0}) => ({data:all.slice(from,from+2),error:null});
    expect(await fetchApplications()).toEqual(all);
    expect(state.calls.filter(c=>c.method==='range').map(c=>c.args)).toEqual([[0,199],[2,201],[4,203],[5,204]]);
    expect(state.calls.filter(c=>c.method==='eq').map(c=>c.args)).toEqual(Array(4).fill(['user_id','user-1']));
    expect(state.calls.filter(c=>c.method==='order').map(c=>c.args)).toEqual(Array.from({length:4},()=>[['created_at',{ascending:false}],['id',{ascending:true}]]).flat());
  });

  it("rejects a later-page failure instead of returning partial applications", async () => {
    state.resolver = ({from=0}) => from ? {data:null,error:{message:'later page failed'}} : {data:[{id:'first'}],error:null};
    await expect(fetchApplications()).rejects.toThrow('later page failed');
  });

  it("throws the sanitized error when the query fails", async () => {
    state.resolver = () => ({ data: null, error: { message: "boom" } });
    await expect(fetchApplications()).rejects.toThrow("boom");
  });
});

describe("addApplication", () => {
  it("seeds intended_majors from the profile and returns the new row", async () => {
    state.resolver = (ctx) => {
      if (ctx.table === "profiles") return { data: { target_majors: ["CS", "", "Law"] }, error: null };
      if (ctx.table === "user_school_applications" && ctx.op === "insert")
        return { data: { id: "a9", school_id: 5 }, error: null };
      return { data: null, error: null };
    };
    const row = await addApplication(5);
    expect(row).toEqual({ id: "a9", school_id: 5 });
    const insertCall = state.calls.find((c) => c.table === "user_school_applications" && c.method === "insert");
    // Blank major names are filtered out before insert.
    expect((insertCall!.args[0] as { intended_majors: string[] }).intended_majors).toEqual(["CS", "Law"]);
  });

  it("throws the sanitized error on insert failure", async () => {
    state.resolver = (ctx) =>
      ctx.op === "insert" ? { data: null, error: { message: "insert failed" } } : { data: { target_majors: [] }, error: null };
    await expect(addApplication(5)).rejects.toThrow("insert failed");
  });
});

describe("updateApplication / deleteApplication", () => {
  // A write that matched no owned row (deleted in another tab, a foreign or
  // stale id) must not be reported as saved.
  const affected = (ctx: { op: string }) =>
    ctx.op === "update" || ctx.op === "delete" ? { data: [{ id: "a1" }], error: null } : { data: null, error: null };

  it("scopes the update to the caller and resolves on success", async () => {
    state.resolver = affected;
    await expect(updateApplication("a1", { status: "applying" })).resolves.toBeUndefined();
    const eqCalls = state.calls.filter((c) => c.method === "eq");
    // Every write is scoped by id AND user_id (defense in depth).
    expect(eqCalls.map((c) => c.args)).toEqual([["id", "a1"], ["user_id", "user-1"]]);
    const patch = state.calls.find((c) => c.method === "update")!.args[0] as Record<string, unknown>;
    expect(patch).toMatchObject({ status: "applying" });
    expect(typeof patch.updated_at).toBe("string");
    // Without a returned row the write cannot be confirmed.
    expect(state.calls.map((c) => c.method).slice(-1)).toEqual(["select"]);
    expect(state.calls.at(-1)!.args).toEqual(["id"]);
  });

  it("throws when the update errors", async () => {
    state.resolver = () => ({ data: null, error: { message: "nope" } });
    await expect(updateApplication("a1", { status: "applying" })).rejects.toThrow("nope");
  });

  it("rejects an update that matched no owned application", async () => {
    state.resolver = (ctx) => (ctx.op === "update" ? { data: [], error: null } : { data: null, error: null });
    await expect(updateApplication("someone-elses", { notes: "x" })).rejects.toThrow("Application not found");
  });

  it("deletes and resolves on success", async () => {
    state.resolver = affected;
    await expect(deleteApplication("a1")).resolves.toBeUndefined();
    expect(state.calls.some((c) => c.method === "delete")).toBe(true);
    expect(state.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["id", "a1"], ["user_id", "user-1"]]);
  });

  it("treats deleting an application that is already gone as done", async () => {
    // Removed in another tab: the outcome the student asked for already holds.
    state.resolver = (ctx) => (ctx.op === "delete" ? { data: [], error: null } : { data: null, error: null });
    await expect(deleteApplication("already-removed")).resolves.toBeUndefined();
  });

  it("throws when the delete errors", async () => {
    state.resolver = () => ({ data: null, error: { message: "delete failed" } });
    await expect(deleteApplication("a1")).rejects.toThrow("delete failed");
  });

  it("never writes when the caller is signed out", async () => {
    state.userId = null;
    await expect(updateApplication("a1", { status: "applying" })).rejects.toThrow("Not authenticated");
    await expect(deleteApplication("a1")).rejects.toThrow("Not authenticated");
    await expect(addApplication(5)).rejects.toThrow("Not authenticated");
    await expect(updateApplicationMajors("a1", ["Law"])).rejects.toThrow("Not authenticated");
    expect(state.calls).toHaveLength(0);
  });
});

describe("updateApplicationMajors", () => {
  it("writes the trimmed list scoped to the caller", async () => {
    state.resolver = (ctx) => (ctx.op === "update" ? { data: [{ id: "a1" }], error: null } : { data: null, error: null });
    await expect(updateApplicationMajors("a1", ["Law", "Commerce"])).resolves.toBeUndefined();
    const patch = state.calls.find((c) => c.method === "update")!.args[0] as { intended_majors: string[] };
    expect(patch.intended_majors).toEqual(["Law", "Commerce"]);
    expect(state.calls.at(-1)).toEqual({ table: "user_school_applications", method: "select", args: ["id"] });
    expect(state.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["id", "a1"], ["user_id", "user-1"]]);
  });

  it("rejects when no owned application was updated", async () => {
    state.resolver = (ctx) => (ctx.op === "update" ? { data: [], error: null } : { data: null, error: null });
    await expect(updateApplicationMajors("missing", ["Law"])).rejects.toThrow("Application not found");
  });

  it("throws the sanitized error on failure", async () => {
    state.resolver = () => ({ data: null, error: { message: "majors failed" } });
    await expect(updateApplicationMajors("a1", ["Law"])).rejects.toThrow("majors failed");
  });
});

describe("fetchApplicationForSchool", () => {
  it("returns null when the caller has not tracked the school", async () => {
    expect(await fetchApplicationForSchool(5)).toBeNull();
    expect(state.calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["user_id", "user-1"], ["school_id", 5]]);
  });

  it("throws the sanitized error on failure", async () => {
    state.resolver = () => ({ data: null, error: { message: "lookup failed" } });
    await expect(fetchApplicationForSchool(5)).rejects.toThrow("lookup failed");
  });
});

describe("searchSchools", () => {
  it("returns [] for a blank query without hitting the DB", async () => {
    expect(await searchSchools("   ")).toEqual([]);
    expect(state.calls).toHaveLength(0);
  });

  it("escapes SQL LIKE wildcards so user input is a literal (C2)", async () => {
    state.resolver = () => ({ data: [{ id: 1, name: "x", country: "AU" }], error: null });
    await searchSchools("100%_off\\");
    const ilike = state.calls.find((c) => c.method === "ilike");
    // % _ and \ must be backslash-escaped inside the %...% wrapper.
    expect(ilike!.args[1]).toBe("%100\\%\\_off\\\\%");
  });

  it("throws the sanitized error on failure", async () => {
    state.resolver = () => ({ data: null, error: { message: "search failed" } });
    await expect(searchSchools("mit")).rejects.toThrow("search failed");
  });
});

describe("fetchUnimportedBookmarkCount", () => {
  it("counts bookmarked schools that have no application yet", async () => {
    state.resolver = (ctx) => {
      if (ctx.table === "user_bookmarked_schools")
        return { data: [{ school_id: 1 }, { school_id: 2 }, { school_id: 3 }], error: null };
      if (ctx.table === "user_school_applications") return { data: [{ school_id: 2 }], error: null };
      return { data: [], error: null };
    };
    expect(await fetchUnimportedBookmarkCount()).toBe(2);
  });
});

describe("importBookmarkedSchools", () => {
  it("returns early with skipped == bookmark count when nothing to import", async () => {
    state.resolver = (ctx) => {
      if (ctx.table === "user_bookmarked_schools") return { data: [{ school_id: 1 }], error: null };
      if (ctx.table === "user_school_applications") return { data: [{ school_id: 1 }], error: null };
      return { data: [], error: null };
    };
    const res = await importBookmarkedSchools();
    expect(res.added).toEqual([]);
    expect(res.skipped).toBe(1);
    // No insert was attempted.
    expect(state.calls.some((c) => c.method === "insert")).toBe(false);
  });

  it("inserts only the un-imported schools and reports counts", async () => {
    state.resolver = (ctx) => {
      if (ctx.table === "user_bookmarked_schools")
        return { data: [{ school_id: 1 }, { school_id: 2 }, { school_id: 3 }], error: null };
      if (ctx.table === "user_school_applications" && ctx.op === "select")
        return { data: [{ school_id: 2 }], error: null };
      if (ctx.table === "profiles") return { data: { target_majors: [] }, error: null };
      if (ctx.table === "user_school_applications" && ctx.op === "insert")
        return { data: [{ id: "n1", school_id: 1 }, { id: "n3", school_id: 3 }], error: null };
      return { data: [], error: null };
    };
    const res = await importBookmarkedSchools();
    expect(res.added).toHaveLength(2);
    expect(res.skipped).toBe(1); // 3 bookmarks - 2 inserted
    const insertCall = state.calls.find((c) => c.method === "insert");
    expect((insertCall!.args[0] as unknown[]).length).toBe(2);
  });
});

describe("importBookmarkedSchools failures", () => {
  it("does not insert when the bookmark read fails", async () => {
    state.resolver = (ctx) =>
      ctx.table === "user_bookmarked_schools" ? { data: null, error: { message: "bookmarks down" } } : { data: [], error: null };
    await expect(importBookmarkedSchools()).rejects.toThrow("bookmarks down");
    expect(state.calls.some((c) => c.method === "insert")).toBe(false);
  });

  it("surfaces an insert failure instead of reporting an empty import", async () => {
    state.resolver = (ctx) => {
      if (ctx.table === "user_bookmarked_schools") return { data: [{ school_id: 1 }], error: null };
      if (ctx.table === "user_school_applications" && ctx.op === "insert")
        return { data: null, error: { message: "duplicate key" } };
      return { data: [], error: null };
    };
    await expect(importBookmarkedSchools()).rejects.toThrow("duplicate key");
  });
});

describe("fetchPreparationInputs", () => {
  it("loads prompts, and only the caller's drafts and documents with their school tags", async () => {
    state.resolver = (ctx) => {
      if (ctx.table === "essay_prompts") return { data: [{ id: "p1", scope: "shared" }], error: null };
      if (ctx.table === "essay_drafts") return { data: [{ prompt_id: "p1", school_id: null }], error: null };
      if (ctx.table === "documents") return { data: [{ category: "identity", school_id: 7 }], error: null };
      return { data: [], error: null };
    };
    expect(await fetchPreparationInputs()).toEqual({
      prompts: [{ id: "p1", scope: "shared" }],
      drafts: [{ prompt_id: "p1", school_id: null }],
      documents: [{ category: "identity", school_id: 7 }],
    });
    const selects = state.calls.filter((c) => c.method === "select").map((c) => [c.table, c.args[0]]);
    expect(selects).toEqual([
      ["essay_prompts", "id, scope"],
      ["essay_drafts", "prompt_id, school_id"],
      ["documents", "category, school_id"],
    ]);
    const owned = state.calls.filter((c) => c.method === "eq").map((c) => [c.table, ...c.args]);
    expect(owned).toEqual([
      ["essay_drafts", "user_id", "user-1"],
      ["documents", "user_id", "user-1"],
    ]);
  });

  it("rejects a failed read instead of reporting nothing prepared", async () => {
    state.resolver = (ctx) => (ctx.table === "documents" ? { data: null, error: { message: "docs down" } } : { data: [], error: null });
    await expect(fetchPreparationInputs()).rejects.toThrow("docs down");
  });
});
