import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type QueryContext, type QueryResult } from "./mock-supabase";

// Server-side modules pull in next/headers via supabase-server; stub it so the
// pure helpers (which take the client as an argument) import cleanly under node.
const serverState = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServer: () => Promise.resolve(serverState.client),
}));
vi.mock("@/lib/safe-error", () => ({
  sanitizeError: (e: unknown, fallback?: string) =>
    (typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : fallback) ?? "error",
}));

import {
  canAccessGroup,
  canAccessPost,
  isBlockedBetween,
  fetchBlockedIds,
  enrichPosts,
} from "@/app/(main)/communities/actions/_shared";
import { fetchCommunityProfileAction } from "@/app/(main)/communities/actions/profiles";

type Client = ReturnType<typeof createMockSupabase>;
// The helpers are typed against the real server client; the mock is structurally
// compatible for what they touch.
const asClient = (c: Client) => c as unknown as Parameters<typeof canAccessGroup>[0];

beforeEach(() => {
  serverState.client = null;
});

describe("canAccessGroup", () => {
  const groupRow = (row: unknown): QueryResult => ({ data: row, error: null });

  it("returns false for an unknown group", async () => {
    const c = createMockSupabase({ resolver: () => groupRow(null) });
    expect(await canAccessGroup(asClient(c), "g1", "u1")).toBe(false);
  });

  it("allows anyone into a public group", async () => {
    const c = createMockSupabase({ resolver: () => groupRow({ is_private: false, creator_id: "owner" }) });
    expect(await canAccessGroup(asClient(c), "g1", undefined)).toBe(true);
  });

  it("denies a private group to an anonymous caller", async () => {
    const c = createMockSupabase({ resolver: () => groupRow({ is_private: true, creator_id: "owner" }) });
    expect(await canAccessGroup(asClient(c), "g1", undefined)).toBe(false);
  });

  it("allows the creator into their own private group", async () => {
    const c = createMockSupabase({ resolver: () => groupRow({ is_private: true, creator_id: "owner" }) });
    expect(await canAccessGroup(asClient(c), "g1", "owner")).toBe(true);
  });

  it("allows a member and denies a non-member of a private group", async () => {
    const member = createMockSupabase({
      resolver: (ctx: QueryContext) =>
        ctx.table === "community_groups"
          ? groupRow({ is_private: true, creator_id: "owner" })
          : groupRow({ user_id: "u1" }),
    });
    expect(await canAccessGroup(asClient(member), "g1", "u1")).toBe(true);

    const nonMember = createMockSupabase({
      resolver: (ctx: QueryContext) =>
        ctx.table === "community_groups"
          ? groupRow({ is_private: true, creator_id: "owner" })
          : groupRow(null),
    });
    expect(await canAccessGroup(asClient(nonMember), "g1", "u1")).toBe(false);
  });
});

describe("canAccessPost", () => {
  it("returns false for an unknown or hidden post", async () => {
    const unknown = createMockSupabase({ resolver: () => ({ data: null, error: null }) });
    expect(await canAccessPost(asClient(unknown), "p1", "u1")).toBe(false);
    const hidden = createMockSupabase({ resolver: () => ({ data: { group_id: null, is_hidden: true }, error: null }) });
    expect(await canAccessPost(asClient(hidden), "p1", "u1")).toBe(false);
  });

  it("allows a visible non-group post", async () => {
    const c = createMockSupabase({ resolver: () => ({ data: { group_id: null, is_hidden: false }, error: null }) });
    expect(await canAccessPost(asClient(c), "p1", "u1")).toBe(true);
  });

  it("delegates to the group gate for a grouped post", async () => {
    const c = createMockSupabase({
      resolver: (ctx: QueryContext) => {
        if (ctx.table === "community_posts") return { data: { group_id: "g1", is_hidden: false }, error: null };
        if (ctx.table === "community_groups") return { data: { is_private: true, creator_id: "owner" }, error: null };
        return { data: null, error: null }; // not a member
      },
    });
    expect(await canAccessPost(asClient(c), "p1", "outsider")).toBe(false);
  });
});

describe("isBlockedBetween", () => {
  it("returns false for missing ids or self-comparison without querying", async () => {
    const c = createMockSupabase({ resolver: () => ({ data: [{ blocker_id: "x" }], error: null }) });
    expect(await isBlockedBetween(asClient(c), undefined, "b")).toBe(false);
    expect(await isBlockedBetween(asClient(c), "a", null)).toBe(false);
    expect(await isBlockedBetween(asClient(c), "a", "a")).toBe(false);
    expect(c.from).not.toHaveBeenCalled();
  });

  it("returns true when a block row exists in either direction", async () => {
    const c = createMockSupabase({ resolver: () => ({ data: [{ blocker_id: "a" }], error: null }) });
    expect(await isBlockedBetween(asClient(c), "a", "b")).toBe(true);
  });

  it("returns false when no block row exists", async () => {
    const c = createMockSupabase({ resolver: () => ({ data: [], error: null }) });
    expect(await isBlockedBetween(asClient(c), "a", "b")).toBe(false);
  });
});

describe("fetchBlockedIds", () => {
  it("returns [] when not signed in", async () => {
    const c = createMockSupabase({ resolver: () => ({ data: [], error: null }) });
    expect(await fetchBlockedIds(asClient(c), undefined)).toEqual([]);
  });

  it("merges users the caller blocked and users who blocked the caller", async () => {
    // Stateful resolver returns different rows for the two parallel reads.
    let n = 0;
    const c = createMockSupabase({
      resolver: () => {
        n += 1;
        return n === 1
          ? { data: [{ blocked_id: "b1" }], error: null }
          : { data: [{ blocker_id: "b2" }], error: null };
      },
    });
    const ids = await fetchBlockedIds(asClient(c), "me");
    expect(ids.sort()).toEqual(["b1", "b2"]);
  });
});

describe("enrichPosts (B2 anonymity + tallies)", () => {
  const baseRow = (over: Record<string, unknown>) => ({
    id: "p1",
    user_id: "author-1",
    content: "hello",
    topic_tag: "general",
    group_id: null,
    is_hidden: false,
    is_anonymous: false,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    likes: [{ count: 3 }],
    comments: [{ count: 2 }],
    ...over,
  });

  const client = (rpcName: string, rows: unknown, savesRows: unknown[] = []) =>
    createMockSupabase({
      rpc: (name) => {
        if (name === "get_public_profiles")
          return {
            data: [{ id: "author-1", first_name: "Ada", last_name: "L", avatar_url: null, is_verified: true }],
            error: null,
          };
        if (name === "get_poll_vote_counts")
          return { data: [{ post_id: "p1", option_id: "o1", votes: 5 }], error: null };
        return { data: [], error: null };
      },
      resolver: (ctx: QueryContext) => {
        if (ctx.table === "community_saves") return { data: savesRows, error: null };
        if (ctx.table === "community_likes") return { data: [{ post_id: "p1" }], error: null };
        return { data: [], error: null };
      },
    });

  it("populates the author for a non-anonymous post", async () => {
    const c = client("", null);
    const [post] = await enrichPosts(asClient(c), [baseRow({})], "viewer");
    expect(post.author).toEqual({
      id: "author-1",
      first_name: "Ada",
      last_name: "L",
      avatar_url: null,
      is_verified: true,
    });
    expect(post.user_id).toBe("author-1");
    expect(post.likes_count).toBe(3);
    expect(post.comments_count).toBe(2);
  });

  it("nulls the author AND tokenises user_id for another user's anonymous post", async () => {
    const c = client("", null);
    const [post] = await enrichPosts(asClient(c), [baseRow({ is_anonymous: true })], "viewer");
    expect(post.author).toBeNull();
    expect(post.user_id).toBe("anon:p1"); // never the real author id
    expect(post.is_anonymous).toBe(true);
  });

  it("keeps the owner's real id on their own anonymous post (so they can edit) but still hides the author", async () => {
    const c = client("", null);
    const [post] = await enrichPosts(asClient(c), [baseRow({ is_anonymous: true })], "author-1");
    expect(post.user_id).toBe("author-1");
    expect(post.author).toBeNull();
  });

  it("maps poll vote counts and per-viewer like/save state", async () => {
    const c = client("", null, [{ post_id: "p1" }]);
    const [post] = await enrichPosts(asClient(c), [baseRow({ poll_options: [{ id: "o1", label: "A" }] })], "viewer");
    expect(post.poll_votes).toEqual({ o1: 5 });
    expect(post.saves_count).toBe(1);
    expect(post.viewer_has_liked).toBe(true);
    expect(post.viewer_has_saved).toBe(true);
  });

  it("returns [] for an empty row set", async () => {
    const c = client("", null);
    expect(await enrichPosts(asClient(c), [], "viewer")).toEqual([]);
  });
});

describe("fetchCommunityProfileAction (A1 privacy gating)", () => {
  const profile = {
    id: "target",
    first_name: "Sam",
    last_name: "T",
    avatar_url: null,
    graduation_year: 2027,
    school_name: "UNSW",
    preferred_countries: ["AU"],
    target_majors: ["CS"],
  };

  it("reports a failed profile read instead of claiming the person is missing", async () => {
    serverState.client = createMockSupabase({ rpc: () => ({ data: null, error: { message: "internal database details", code: "PGRST000" } }), user: { id: "viewer" } });
    const res = await fetchCommunityProfileAction("target");
    expect(res.profile).toBeNull();
    expect(res.error).toBe("Could not load this community profile. Please try again.");
  });

  it("logs only a fixed stage and safe code, never backend message details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      serverState.client = createMockSupabase({ user: { id: "viewer" }, rpc: () => ({ data: [profile], error: { message: "private token and query", code: "unsafe/code?secret" } }) });
      const res = await fetchCommunityProfileAction("target");
      expect(res.profile).toBeNull();
      expect(res.error).toBe("Could not load this community profile. Please try again.");
      expect(log).toHaveBeenCalledExactlyOnceWith("[community-profile] load failed", { stage: "profile", code: "unknown" });
    } finally { log.mockRestore(); }
  });

  it("does not render partial profile data when related reads fail", async () => {
    for (const table of ["community_profile_settings", "community_follows"]) {
      serverState.client = createMockSupabase({
        user: { id: "viewer" }, rpc: () => ({ data: [profile], error: null }),
        resolver: ctx => ctx.table === table ? { data: null, error: { message: "private details", code: "XX000" } } : { data: null, error: null, count: 0 },
      });
      const res = await fetchCommunityProfileAction("target");
      expect(res.profile).toBeNull();
      expect(res.error).toBe("Could not load this community profile. Please try again.");
    }
  });

  it("stops before profile queries when the caller is unauthenticated", async () => {
    const client = createMockSupabase({ rpc: () => ({ data: [profile], error: null }) });
    serverState.client = client;
    const res = await fetchCommunityProfileAction("target");
    expect(res.profile).toBeNull();
    expect(res.error).toBe("Could not load this community profile. Please try again.");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns not-found when the profile RPC yields no rows", async () => {
    serverState.client = createMockSupabase({ rpc: () => ({ data: [], error: null }), user: { id: "viewer" } });
    const res = await fetchCommunityProfileAction("target");
    expect(res.profile).toBeNull();
    expect(res.error).toBeNull();
  });

  it("hides fields whose show_* flag is false and reveals those that are true", async () => {
    serverState.client = createMockSupabase({
      user: { id: "viewer" },
      rpc: () => ({ data: [profile], error: null }),
      resolver: (ctx: QueryContext) => {
        if (ctx.table === "community_profile_settings")
          return {
            data: {
              show_graduation_year: true,
              show_school_name: false,
              show_preferred_countries: false,
              show_target_majors: true,
            },
            error: null,
          };
        return { data: null, error: null, count: 0 };
      },
    });
    const { profile: p } = await fetchCommunityProfileAction("target");
    expect(p!.graduation_year).toBe(2027); // shown
    expect(p!.school_name).toBeNull(); // hidden
    expect(p!.preferred_countries).toEqual([]); // hidden -> empty
    expect(p!.target_majors).toEqual(["CS"]); // shown
    expect(p!.is_own_profile).toBe(false);
  });

  it("applies the default settings (school shown, countries/majors hidden) when no settings row exists", async () => {
    serverState.client = createMockSupabase({
      user: { id: "target" },
      rpc: () => ({ data: [profile], error: null }),
      resolver: () => ({ data: null, error: null, count: 0 }),
    });
    const { profile: p } = await fetchCommunityProfileAction("target");
    expect(p!.school_name).toBe("UNSW");
    expect(p!.preferred_countries).toEqual([]);
    expect(p!.target_majors).toEqual([]);
    expect(p!.is_own_profile).toBe(true);
  });
});
