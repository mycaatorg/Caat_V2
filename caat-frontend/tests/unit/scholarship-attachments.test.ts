import { beforeEach, describe, expect, it, vi } from "vitest";

type Ctx = { table: string; op: string; calls: { method: string; args: unknown[] }[] };
const state = vi.hoisted(() => ({
  userId: "user-1" as string | null,
  queries: [] as Ctx[],
  resolver: (() => ({ data: null, error: null })) as (ctx: Ctx) => { data?: unknown; error?: { message: string; code?: string } | null },
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
    for (const m of ["select", "eq", "in", "order", "limit", "is"]) b[m] = pass(m);
    for (const m of ["insert", "update", "upsert", "delete"]) b[m] = pass(m, m);
    b.then = (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve(state.resolver(ctx)).then(f, r);
    return b;
  };
  const client = { from: (t: string) => build(t) };
  return { supabase: client, getBrowserClient: () => client };
});

import {
  attachScholarship,
  detachScholarship,
  fetchPrepChecks,
  fetchSavedScholarshipsForHub,
  mentionsSchool,
  setPrepCheck,
} from "@/lib/scholarship-tracking";

const eqs = (ctx: Ctx) => ctx.calls.filter((c) => c.method === "eq").map((c) => c.args);
const last = () => state.queries[state.queries.length - 1];

beforeEach(() => {
  state.userId = "user-1";
  state.queries = [];
  state.resolver = () => ({ data: null, error: null });
});

describe("fetchSavedScholarshipsForHub", () => {
  it("reads only the owner's saved scholarships with their attachment and recorded fields", async () => {
    state.resolver = () => ({
      data: [
        {
          scholarship_id: "s1", status: "applied", school_id: 7, schools: { name: "Alpha University" },
          scholarships: { id: "s1", title: "Merit", provider_name: "Alpha", amount_display: "$1", school_name: "The Alpha University", requires_essay: true, deadline_at: null, external_url: null, application_requirements: null, eligibility_summary: null, last_verified_at: null, source_last_synced_at: null, is_active: true },
        },
        { scholarship_id: "gone", status: "interested", school_id: null, schools: null, scholarships: null },
      ],
      error: null,
    });
    const rows = await fetchSavedScholarshipsForHub();
    expect(last().table).toBe("user_bookmarked_scholarships");
    expect(eqs(last())).toEqual([["user_id", "user-1"]]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "s1", title: "Merit", provider: "Alpha", status: "applied", schoolId: 7, attachedSchoolName: "Alpha University", scholarshipSchoolName: "The Alpha University" });
    expect(rows[0].checklist).toMatchObject({ id: "s1", requires_essay: true });
  });

  it("throws on a read error instead of returning an empty list", async () => {
    state.resolver = () => ({ data: null, error: { message: "boom" } });
    await expect(fetchSavedScholarshipsForHub()).rejects.toThrow();
  });

  it("throws when signed out", async () => {
    state.userId = null;
    await expect(fetchSavedScholarshipsForHub()).rejects.toThrow("Not authenticated");
  });
});

describe("mentionsSchool", () => {
  it("matches the recorded school name case- and leading-'The'-insensitively, never guesses", () => {
    expect(mentionsSchool("The University of Sydney", "university of sydney")).toBe(true);
    expect(mentionsSchool("University of Sydney Business School", "University of Sydney")).toBe(false);
    expect(mentionsSchool(null, "University of Sydney")).toBe(false);
  });
});

describe("attach and detach", () => {
  it("attach updates the owner's row and asserts the returned attachment", async () => {
    state.resolver = () => ({ data: [{ scholarship_id: "s1", school_id: 7 }], error: null });
    await attachScholarship("s1", 7);
    const ctx = last();
    expect(ctx.op).toBe("update");
    expect(ctx.calls.find((c) => c.method === "update")?.args[0]).toEqual({ school_id: 7 });
    expect(eqs(ctx)).toEqual([["user_id", "user-1"], ["scholarship_id", "s1"]]);
    expect(ctx.calls.find((c) => c.method === "select")?.args[0]).toBe("scholarship_id, school_id");
    expect(state.queries).toHaveLength(1);
  });

  it("zero rows or a policy error fail with the attach message", async () => {
    state.resolver = () => ({ data: [], error: null });
    await expect(attachScholarship("s1", 7)).rejects.toThrow("Couldn't attach. Make sure you still have this application, then try again.");
    state.resolver = () => ({ data: null, error: { message: "new row violates row-level security policy", code: "42501" } });
    await expect(attachScholarship("s1", 7)).rejects.toThrow("Couldn't attach. Make sure you still have this application, then try again.");
  });

  it("detach writes null on the owner's row and fails on zero rows", async () => {
    state.resolver = () => ({ data: [{ scholarship_id: "s1", school_id: null }], error: null });
    await detachScholarship("s1");
    expect(last().calls.find((c) => c.method === "update")?.args[0]).toEqual({ school_id: null });
    expect(eqs(last())).toEqual([["user_id", "user-1"], ["scholarship_id", "s1"]]);
    state.resolver = () => ({ data: [], error: null });
    await expect(detachScholarship("s1")).rejects.toThrow("Couldn't detach");
  });
});

describe("preparation ticks", () => {
  it("fetchPrepChecks groups the owner's keys by scholarship and throws on error", async () => {
    state.resolver = () => ({ data: [{ scholarship_id: "s1", item_key: "essay" }, { scholarship_id: "s1", item_key: "deadline" }, { scholarship_id: "s2", item_key: "essay" }], error: null });
    expect(await fetchPrepChecks()).toEqual({ s1: ["essay", "deadline"], s2: ["essay"] });
    expect(last().table).toBe("user_scholarship_prep_checks");
    expect(eqs(last())).toEqual([["user_id", "user-1"]]);
    state.resolver = () => ({ data: null, error: { message: "boom" } });
    await expect(fetchPrepChecks()).rejects.toThrow();
  });

  it("ticking upserts the key idempotently and verifies the row", async () => {
    state.resolver = () => ({ data: [{ item_key: "essay" }], error: null });
    await setPrepCheck("s1", "essay", true);
    const ctx = last();
    expect(ctx.op).toBe("upsert");
    expect(ctx.calls.find((c) => c.method === "upsert")?.args).toEqual([
      { user_id: "user-1", scholarship_id: "s1", item_key: "essay" },
      { onConflict: "user_id,scholarship_id,item_key", ignoreDuplicates: true },
    ]);
  });

  it("an ignored duplicate is confirmed by reading the key back", async () => {
    state.resolver = (ctx) => (ctx.op === "upsert" ? { data: [], error: null } : { data: [{ item_key: "essay" }], error: null });
    await setPrepCheck("s1", "essay", true);
    expect(state.queries.map((q) => q.op)).toEqual(["upsert", "select"]);
    state.queries = [];
    state.resolver = () => ({ data: [], error: null });
    await expect(setPrepCheck("s1", "essay", true)).rejects.toThrow();
  });

  it("unticking deletes only the owner's key", async () => {
    await setPrepCheck("s1", "essay", false);
    const ctx = last();
    expect(ctx.op).toBe("delete");
    expect(eqs(ctx)).toEqual([["user_id", "user-1"], ["scholarship_id", "s1"], ["item_key", "essay"]]);
    state.resolver = () => ({ data: null, error: { message: "boom" } });
    await expect(setPrepCheck("s1", "essay", false)).rejects.toThrow();
  });

  it("refuses keys the database would reject, before any request", async () => {
    await expect(setPrepCheck("s1", "Not a key", true)).rejects.toThrow();
    expect(state.queries).toHaveLength(0);
  });
});
