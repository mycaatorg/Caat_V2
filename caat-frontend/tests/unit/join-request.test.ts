import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServer: async () => mocks.client,
}));
vi.mock("@/lib/rate-limit", () => ({
  gate: async () => ({ ok: true }),
  ratelimits: new Proxy({}, { get: () => ({}) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createMockSupabase, type QueryContext } from "./mock-supabase";
import {
  fetchGroupJoinCardAction,
  fetchJoinRequestQueueAction,
  requestJoinGroupAction,
} from "@/app/(main)/communities/actions/groups";
import { notificationHref } from "@/lib/notification-href";

const OWNER = "owner-1";
const REQUESTER = "requester-1";
const SECOND = "requester-2";
const GROUP = "550e8400-e29b-41d4-a716-446655440003";
const OTHER_GROUP = "550e8400-e29b-41d4-a716-446655440004";

type Result = { data?: unknown; error?: { message: string } | null };

function setDb(
  user: { id: string } | null,
  resolver: (ctx: QueryContext) => Result = () => ({ data: null }),
  rpc?: (name: string, args: Record<string, unknown>) => Result,
) {
  const db = createMockSupabase({ user, resolver, rpc });
  mocks.client = db;
  return db;
}

function writes(db: ReturnType<typeof createMockSupabase>) {
  return db.queries.filter((ctx) => ctx.op !== "select");
}

function hasCall(ctx: QueryContext | undefined, method: string, ...args: unknown[]) {
  return ctx?.calls.some((call) => call.method === method &&
    args.every((arg, index) => JSON.stringify(call.args[index]) === JSON.stringify(arg))) ?? false;
}

describe("requestJoinGroupAction (PROD-86)", () => {
  beforeEach(() => { mocks.client = null; });

  it("records the request through the trusted RPC with only the group id", async () => {
    const db = setDb({ id: REQUESTER }, () => ({ data: null }), () => ({ data: "requested", error: null }));

    const result = await requestJoinGroupAction(GROUP);

    expect(result.error).toBeNull();
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("request_community_group_join", { p_group_id: GROUP });
    // Owner lookup, request row and notification all belong to the database:
    // the requester cannot read a private group or write a notification.
    expect(db.from).not.toHaveBeenCalled();
    expect(writes(db)).toHaveLength(0);
  });

  it("treats a retry or an existing membership as success without extra writes", async () => {
    for (const outcome of ["pending", "member"]) {
      const db = setDb({ id: REQUESTER }, () => ({ data: null }), () => ({ data: outcome, error: null }));

      expect((await requestJoinGroupAction(GROUP)).error).toBeNull();
      expect(db.rpc).toHaveBeenCalledTimes(1);
      expect(writes(db)).toHaveLength(0);
    }
  });

  it("reports a refused request instead of claiming it was sent", async () => {
    const db = setDb({ id: REQUESTER }, () => ({ data: null }), () => ({
      data: null, error: { message: "This community is not accepting join requests" },
    }));

    const result = await requestJoinGroupAction(GROUP);

    expect(result.error).toBe("Could not request to join this community.");
    expect(writes(db)).toHaveLength(0);
  });

  it("rejects anonymous callers before reaching the database", async () => {
    const db = setDb(null);

    expect((await requestJoinGroupAction(GROUP)).error).toBe("Not signed in");
    expect(db.rpc).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("fetchGroupJoinCardAction (PROD-86)", () => {
  beforeEach(() => { mocks.client = null; });

  it("returns only the id, name and pending flag from the minimal join card", async () => {
    const db = setDb({ id: REQUESTER }, () => ({ data: null }), () => ({
      data: [{ id: GROUP, name: "Private Study", has_pending_request: true, description: "must not leak" }],
      error: null,
    }));

    const { card } = await fetchGroupJoinCardAction("private-study");

    expect(db.rpc).toHaveBeenCalledWith("get_community_group_join_card", { p_slug: "private-study" });
    expect(card).toEqual({ id: GROUP, name: "Private Study", has_pending_request: true });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("returns no card for a missing slug, an RPC failure or an anonymous caller", async () => {
    setDb({ id: REQUESTER }, () => ({ data: null }), () => ({ data: [], error: null }));
    expect((await fetchGroupJoinCardAction("missing")).card).toBeNull();

    setDb({ id: REQUESTER }, () => ({ data: null }), () => ({ data: null, error: { message: "boom" } }));
    expect((await fetchGroupJoinCardAction("broken")).card).toBeNull();

    const anonymous = setDb(null);
    expect((await fetchGroupJoinCardAction("private-study")).card).toBeNull();
    expect(anonymous.rpc).not.toHaveBeenCalled();
  });
});

describe("fetchJoinRequestQueueAction (PROD-86)", () => {
  beforeEach(() => { mocks.client = null; });

  it("lists pending requests only for groups the caller owns, oldest first", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups") return {
        data: [
          { id: GROUP, name: "Private Study", slug: "private-study" },
          { id: OTHER_GROUP, name: "Quiet Group", slug: "quiet-group" },
        ],
      };
      if (ctx.table === "community_group_requests") return {
        data: [
          { group_id: GROUP, user_id: REQUESTER, created_at: "2026-10-07T01:00:00Z" },
          { group_id: GROUP, user_id: SECOND, created_at: "2026-10-07T02:00:00Z" },
        ],
      };
      return { data: null };
    }, (name) => name === "get_public_profiles"
      ? { data: [{ id: REQUESTER, first_name: "Ada", last_name: "Lovelace", avatar_url: null }], error: null }
      : { data: null, error: null });

    const { groups, error } = await fetchJoinRequestQueueAction();

    expect(error).toBeNull();
    const ownedQuery = db.queries.find((ctx) => ctx.table === "community_groups");
    expect(hasCall(ownedQuery, "eq", "creator_id", OWNER)).toBe(true);
    const requestQuery = db.queries.find((ctx) => ctx.table === "community_group_requests");
    expect(hasCall(requestQuery, "in", "group_id", [GROUP, OTHER_GROUP])).toBe(true);
    expect(hasCall(requestQuery, "eq", "status", "pending")).toBe(true);
    expect(hasCall(requestQuery, "order", "created_at", { ascending: true })).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("get_public_profiles", { user_ids: [REQUESTER, SECOND] });
    expect(groups).toEqual([{
      id: GROUP, name: "Private Study", slug: "private-study",
      requests: [
        { user_id: REQUESTER, created_at: "2026-10-07T01:00:00Z", user: { id: REQUESTER, first_name: "Ada", last_name: "Lovelace", avatar_url: null } },
        { user_id: SECOND, created_at: "2026-10-07T02:00:00Z", user: null },
      ],
    }]);
    expect(writes(db)).toHaveLength(0);
  });

  it("returns an empty queue when the caller owns no groups", async () => {
    const db = setDb({ id: OWNER }, () => ({ data: [] }));

    expect(await fetchJoinRequestQueueAction()).toEqual({ groups: [], error: null });
    expect(db.queries.some((ctx) => ctx.table === "community_group_requests")).toBe(false);
  });

  it("reports load failures instead of showing an empty queue", async () => {
    setDb({ id: OWNER }, (ctx) => ctx.table === "community_groups"
      ? { data: null, error: { message: "groups failed" } }
      : { data: [] });
    expect(await fetchJoinRequestQueueAction()).toEqual({ groups: [], error: "Could not load join requests." });

    setDb({ id: OWNER }, (ctx) => ctx.table === "community_groups"
      ? { data: [{ id: GROUP, name: "Private Study", slug: "private-study" }] }
      : { data: null, error: { message: "requests failed" } });
    expect(await fetchJoinRequestQueueAction()).toEqual({ groups: [], error: "Could not load join requests." });
  });

  it("requires a signed-in owner", async () => {
    const db = setDb(null);

    expect(await fetchJoinRequestQueueAction()).toEqual({ groups: [], error: "Not signed in" });
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("notificationHref", () => {
  it("sends join requests to the owner's review queue", () => {
    expect(notificationHref({ type: "join_request", post_id: null, actor_id: REQUESTER })).toBe("/communities/requests");
  });

  it("keeps post, follow and fallback routes", () => {
    expect(notificationHref({ type: "comment", post_id: "post-1", actor_id: REQUESTER })).toBe("/communities/post-1");
    expect(notificationHref({ type: "follow", post_id: null, actor_id: REQUESTER })).toBe(`/communities/profile/${REQUESTER}`);
    expect(notificationHref({ type: "follow", post_id: null, actor_id: null })).toBe("/communities");
    expect(notificationHref({ type: "request_approved", post_id: null, actor_id: OWNER })).toBe("/communities");
  });
});
