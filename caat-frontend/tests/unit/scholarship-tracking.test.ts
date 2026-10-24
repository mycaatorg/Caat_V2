import { describe, it, expect, vi, beforeEach } from "vitest";
import type { QueryResult } from "./mock-supabase";

// Mutable state the mocked singleton reads. vi.hoisted runs before the module
// factories below, so the SUT (which imports the `supabase` singleton and
// `getClientUserId` at module load) sees a live, controllable client.
const state = vi.hoisted(() => ({
  userId: null as string | null,
  resolver: (() => ({ data: null, error: null })) as (ctx: { table: string; op: string }) => {
    data?: unknown;
    error?: { message: string } | null;
  },
}));

vi.mock("@/lib/current-user", () => ({
  getClientUserId: () => Promise.resolve(state.userId),
}));

vi.mock("@/lib/supabase/client", () => {
  const build = (table: string) => {
    const ctx = { table, op: "select" as const };
    const b: Record<string, unknown> = {};
    const pass =
      (op?: string) =>
      () => {
        if (op) (ctx as { op: string }).op = op;
        return b;
      };
    for (const m of ["select", "eq", "in", "order", "ilike", "limit"]) b[m] = pass();
    b.upsert = pass("upsert");
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
  fetchBookmarkTracking,
  trackScholarship,
  untrackScholarship,
  fetchTrackedForSchool,
  SCHOLARSHIP_STATUSES,
} from "@/lib/scholarship-tracking";

beforeEach(() => {
  state.userId = "user-1";
  state.resolver = () => ({ data: null, error: null });
});

describe("fetchBookmarkTracking", () => {
  it("returns an empty map when the user is not signed in", async () => {
    state.userId = null;
    const map = await fetchBookmarkTracking();
    expect(map.size).toBe(0);
  });

  it("maps scholarship_id -> {status, school_id} and defaults a null status to interested", async () => {
    state.resolver = () => ({
      data: [
        { scholarship_id: "s1", status: "applied", school_id: 42 },
        { scholarship_id: "s2", status: null, school_id: null },
      ],
      error: null,
    });
    const map = await fetchBookmarkTracking();
    expect(map.get("s1")).toEqual({ status: "applied", school_id: 42 });
    // Null status must fall back to "interested", not leak null into the UI.
    expect(map.get("s2")).toEqual({ status: "interested", school_id: null });
  });

  it("tolerates a null data payload", async () => {
    state.resolver = () => ({ data: null, error: null });
    const map = await fetchBookmarkTracking();
    expect(map.size).toBe(0);
  });
});

describe("trackScholarship", () => {
  it("throws when unauthenticated (so the optimistic UI rolls back)", async () => {
    state.userId = null;
    await expect(trackScholarship("s1", "applied")).rejects.toThrow("Not authenticated");
  });

  it("resolves when the upsert returns the saved row at the new status", async () => {
    let captured: { table: string; op: string } | null = null;
    state.resolver = (ctx) => {
      captured = ctx;
      return { data: [{ status: "awarded" }], error: null };
    };
    await expect(trackScholarship("s1", "awarded")).resolves.toBeUndefined();
    expect(captured!.op).toBe("upsert");
    expect(captured!.table).toBe("user_bookmarked_scholarships");
  });

  // PROD-150: a write that touches no row (an UPDATE that RLS filtered out)
  // comes back with no error, so it must not be reported as saved.
  it("throws when the write affected no row", async () => {
    state.resolver = () => ({ data: [], error: null });
    await expect(trackScholarship("s1", "applied")).rejects.toThrow("not saved");
    state.resolver = () => ({ data: null, error: null });
    await expect(trackScholarship("s1", "applied")).rejects.toThrow("not saved");
  });

  it("throws when the returned row does not hold the requested status", async () => {
    state.resolver = () => ({ data: [{ status: "interested" }], error: null });
    await expect(trackScholarship("s1", "applied")).rejects.toThrow("not saved");
  });

  it("throws the DB error message on failure (drives the rollback + toast)", async () => {
    state.resolver = () => ({ data: null, error: { message: "conflict" } });
    await expect(trackScholarship("s1", "applied")).rejects.toThrow("conflict");
  });

  it("accepts every declared status", async () => {
    for (const s of SCHOLARSHIP_STATUSES) {
      state.resolver = () => ({ data: [{ status: s }], error: null });
      await expect(trackScholarship("s1", s)).resolves.toBeUndefined();
    }
  });
});

describe("untrackScholarship", () => {
  it("throws when unauthenticated", async () => {
    state.userId = null;
    await expect(untrackScholarship("s1")).rejects.toThrow("Not authenticated");
  });

  it("issues a delete and resolves on success", async () => {
    let captured: { table: string; op: string } | null = null;
    state.resolver = (ctx) => {
      captured = ctx;
      return { data: null, error: null };
    };
    await expect(untrackScholarship("s1")).resolves.toBeUndefined();
    expect(captured!.op).toBe("delete");
  });

  it("throws on delete failure so the UI reverts", async () => {
    state.resolver = () => ({ data: null, error: { message: "denied" } });
    await expect(untrackScholarship("s1")).rejects.toThrow("denied");
  });
});

describe("fetchTrackedForSchool", () => {
  const rows = (data: unknown): QueryResult => ({ data, error: null });

  it("returns [] when unauthenticated or the school name is blank", async () => {
    state.userId = null;
    expect(await fetchTrackedForSchool("UNSW")).toEqual([]);
    state.userId = "user-1";
    expect(await fetchTrackedForSchool("")).toEqual([]);
  });

  it("matches on normalised school name (case + leading 'The' insensitive)", async () => {
    state.resolver = () =>
      rows([
        {
          status: "applied",
          scholarships: {
            id: "s1",
            title: "Merit Award",
            provider_name: "UNSW",
            amount_display: "$5,000",
            school_name: "The University of New South Wales",
          },
        },
        {
          status: null,
          scholarships: {
            id: "s2",
            title: "Other",
            provider_name: "USyd",
            amount_display: null,
            school_name: "University of Sydney",
          },
        },
        {
          status: "interested",
          scholarships: null, // no linked scholarship row -> filtered out
        },
      ]);
    const result = await fetchTrackedForSchool("university of new south wales");
    expect(result).toEqual([
      { id: "s1", title: "Merit Award", provider: "UNSW", amount: "$5,000", status: "applied" },
    ]);
  });

  it("defaults a null status to interested in the mapped shape", async () => {
    state.resolver = () =>
      rows([
        {
          status: null,
          scholarships: {
            id: "s3",
            title: "T",
            provider_name: "P",
            amount_display: null,
            school_name: "Monash University",
          },
        },
      ]);
    const [row] = await fetchTrackedForSchool("Monash University");
    expect(row.status).toBe("interested");
    expect(row.amount).toBeNull();
  });
});
