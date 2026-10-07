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
  approveJoinRequestAction,
  createGroupAction,
  deleteGroupAction,
  fetchGroupPostsAction,
  joinGroupAction,
  leaveGroupAction,
  rejectJoinRequestAction,
  requestJoinGroupAction,
  updateGroupAction,
} from "@/app/(main)/communities/actions/groups";
import {
  addCommentAction,
  deleteCommentAction,
  updateCommentAction,
} from "@/app/(main)/communities/actions/comments";
import {
  createPostAction,
  deletePostAction,
  updatePostAction,
} from "@/app/(main)/communities/actions/posts";
import { fetchPostsAction } from "@/app/(main)/communities/actions/feed";

const OWNER = "owner-1";
const MEMBER = "member-1";
const STRANGER = "stranger-1";
const GROUP = "550e8400-e29b-41d4-a716-446655440003";
const POST = "550e8400-e29b-41d4-a716-446655440000";
const COMMENT = "550e8400-e29b-41d4-a716-446655440001";

function query(db: ReturnType<typeof createMockSupabase>, table: string, op: QueryContext["op"], index = 0) {
  return db.queries.filter((q) => q.table === table && q.op === op)[index];
}

function hasCall(ctx: QueryContext | undefined, method: string, ...args: unknown[]) {
  return ctx?.calls.some((call) => call.method === method &&
    args.every((arg, index) => JSON.stringify(call.args[index]) === JSON.stringify(arg))) ?? false;
}

function setDb(user: { id: string } | null, resolver: (ctx: QueryContext) => { data?: unknown; error?: { message: string } | null; count?: number | null }, rpc?: (name: string, args: Record<string, unknown>) => { data?: unknown; error?: { message: string } | null }) {
  const db = createMockSupabase({ user, resolver, rpc });
  mocks.client = db;
  return db;
}

describe("community server actions", () => {
  beforeEach(() => { mocks.client = null; });

  it("does not let a stranger update a group and scopes owner updates to that owner", async () => {
    const db = setDb({ id: STRANGER }, (ctx) =>
      ctx.table === "community_groups" && ctx.op === "select"
        ? { data: { creator_id: OWNER } }
        : { data: null },
    );

    const result = await updateGroupAction(GROUP, { name: "New name", is_private: true });

    expect(result.error).toBe("Not authorized");
    expect(query(db, "community_groups", "update")).toBeUndefined();
  });

  it("reports an atomic group insert failure without compensating writes", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: null };
      if (ctx.table === "community_groups" && ctx.op === "insert") return { data: null, error: { message: "owner trigger failed" } };
      return { data: null };
    });

    const result = await createGroupAction({ name: "Study Group", is_private: true });

    expect(result.group).toBeNull();
    expect(result.error).toMatch(/failed to create community/i);
    expect(query(db, "community_groups", "delete")).toBeUndefined();
    expect(query(db, "community_group_members", "insert")).toBeUndefined();
  });

  it("creates a community with the caller recorded as its owner", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "insert") return { data: { id: GROUP, name: "Study Group", slug: "study-group", creator_id: OWNER, is_private: true, created_at: "now" } };
      return { data: null };
    });

    const result = await createGroupAction({ name: "Study Group", is_private: true });

    expect(result.error).toBeNull();
    expect(result.group?.is_owner).toBe(true);
    expect(query(db, "community_group_members", "insert")).toBeUndefined();
  });

  it("reports a failed join request without sending a success notification", async () => {
    const db = setDb({ id: MEMBER }, () => ({ data: null }),
      () => ({ data: null, error: { message: "request denied" } }));

    const result = await requestJoinGroupAction(GROUP);

    expect(result.error).not.toBeNull();
    expect(db.rpc).toHaveBeenCalledWith("request_community_group_join", { p_group_id: GROUP });
    expect(query(db, "community_group_requests", "upsert")).toBeUndefined();
    expect(query(db, "notifications", "insert")).toBeUndefined();
  });

  it("stops approval when the atomic owner-only RPC fails", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { creator_id: OWNER, name: "Study Group" } };
      return { data: null };
    }, () => ({ data: null, error: { message: "pending request required" } }));

    const result = await approveJoinRequestAction(GROUP, MEMBER);

    expect(result.error).not.toBeNull();
    expect(db.rpc).toHaveBeenCalledWith("approve_group_join_request", { p_group_id: GROUP, p_requester_user_id: MEMBER });
    expect(query(db, "community_group_members", "upsert")).toBeUndefined();
    expect(query(db, "community_group_requests", "update")).toBeUndefined();
    expect(query(db, "notifications", "insert")).toBeUndefined();
  });

  it("surfaces request rejection update failures", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { creator_id: OWNER, name: "Study Group" } };
      return { data: null };
    }, () => ({ data: null, error: { message: "write failed" } }));

    const result = await rejectJoinRequestAction(GROUP, MEMBER);

    expect(result.error).not.toBeNull();
    expect(db.rpc).toHaveBeenCalledWith("reject_group_join_request", { p_group_id: GROUP, p_requester_user_id: MEMBER });
  });

  it("does not notify or write again for an idempotent approval", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { creator_id: OWNER, name: "Study Group" } };
      return { data: null };
    }, () => ({ data: false, error: null }));

    const result = await approveJoinRequestAction(GROUP, MEMBER);

    expect(result.error).toBeNull();
    expect(query(db, "community_group_members", "insert")).toBeUndefined();
    expect(query(db, "community_group_members", "upsert")).toBeUndefined();
    expect(query(db, "community_group_members", "delete")).toBeUndefined();
    expect(query(db, "notifications", "insert")).toBeUndefined();
  });

  it("sends one approval notification only after the atomic RPC reports a change", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select")
        return { data: { creator_id: OWNER, name: "Study Group" } };
      return { data: null };
    }, () => ({ data: true, error: null }));

    const result = await approveJoinRequestAction(GROUP, MEMBER);

    expect(result.error).toBeNull();
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("approve_group_join_request", { p_group_id: GROUP, p_requester_user_id: MEMBER });
    expect(query(db, "community_group_members", "insert")).toBeUndefined();
    expect(query(db, "community_group_members", "upsert")).toBeUndefined();
    const notifications = db.queries.filter((ctx) => ctx.table === "notifications" && ctx.op === "insert");
    expect(notifications).toHaveLength(1);
    expect(hasCall(notifications[0], "insert", {
      user_id: MEMBER, actor_id: OWNER, type: "request_approved", post_id: null,
      message: "Your request to join Study Group was approved",
    })).toBe(true);
  });

  it("does not let a reply attach a comment from another post", async () => {
    const db = setDb({ id: MEMBER }, (ctx) => {
      if (ctx.table === "community_posts" && ctx.op === "select") return { data: { id: POST, user_id: OWNER, group_id: null, is_hidden: false } };
      if (ctx.table === "community_comments" && ctx.op === "select") return { data: null, count: 0 };
      if (ctx.table === "community_comments" && ctx.op === "insert") return { data: { id: "new-comment", post_id: POST, parent_comment_id: COMMENT, user_id: MEMBER, content: "Reply" } };
      return { data: null };
    });

    const result = await addCommentAction(POST, "Reply", COMMENT);

    expect(result.comment).toBeNull();
    expect(result.error).toMatch(/parent comment/i);
    expect(query(db, "community_comments", "insert")).toBeUndefined();
  });

  it("allows a reply when its parent belongs to the same post", async () => {
    const db = setDb({ id: MEMBER }, (ctx) => {
      if (ctx.table === "community_posts" && ctx.op === "select") return { data: { id: POST, user_id: OWNER, group_id: null, is_hidden: false } };
      if (ctx.table === "community_comments" && ctx.op === "select") {
        const ids = ctx.calls.filter((call) => call.method === "eq").map((call) => call.args);
        return { data: ids.some((args) => args[0] === "id" && args[1] === COMMENT) ? { post_id: POST } : null, count: 0 };
      }
      if (ctx.table === "community_comments" && ctx.op === "insert") return { data: { id: "new-comment", post_id: POST, parent_comment_id: COMMENT, user_id: MEMBER, content: "Reply" } };
      return { data: null };
    });

    const result = await addCommentAction(POST, "Reply", COMMENT);

    expect(result.error).toBeNull();
    expect(result.comment?.parent_comment_id).toBe(COMMENT);
    expect(query(db, "community_comments", "insert")).toBeDefined();
  });

  it("denies creating a post in a private community before attempting the insert", async () => {
    const db = setDb({ id: STRANGER }, (ctx) => {
      if (ctx.table === "community_posts" && ctx.op === "select") return { data: null, count: 0 };
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { is_private: true, creator_id: OWNER } };
      return { data: null };
    });

    const result = await createPostAction({ content: "Hello", topic_tag: "ADVICE", group_id: GROUP });

    expect(result.post).toBeNull();
    expect(result.error).toMatch(/not authorized/i);
    expect(query(db, "community_posts", "insert")).toBeUndefined();
  });

  it("keeps private posts unavailable to strangers and readable by an active member", async () => {
    const privateGroupResolver = (member: boolean) => (ctx: QueryContext) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { is_private: true, creator_id: OWNER } };
      if (ctx.table === "community_group_members" && ctx.op === "select") return { data: member ? { user_id: MEMBER } : null };
      if (ctx.table === "community_posts" && ctx.op === "select") return { data: [] };
      if (ctx.table === "community_blocks") return { data: [] };
      return { data: null };
    };
    const outsiderDb = setDb(null, privateGroupResolver(false));
    const denied = await fetchGroupPostsAction(GROUP);
    expect(denied.posts).toEqual([]);
    expect(query(outsiderDb, "community_posts", "select")).toBeUndefined();

    const memberDb = setDb({ id: MEMBER }, privateGroupResolver(true));
    await fetchGroupPostsAction(GROUP);
    expect(query(memberDb, "community_posts", "select")).toBeDefined();
  });

  it("scopes the public feed query to posts without a group", async () => {
    const db = setDb(null, (ctx) => {
      if (ctx.table === "community_posts" && ctx.op === "select") return { data: [] };
      if (ctx.table === "community_blocks") return { data: [] };
      return { data: null };
    });

    await fetchPostsAction();

    expect(hasCall(query(db, "community_posts", "select"), "is", "group_id", null)).toBe(true);
  });

  it("returns mutation failures instead of claiming post and comment updates succeeded", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_posts" && ctx.op === "select") return { data: { user_id: OWNER, created_at: new Date().toISOString() } };
      if (ctx.table === "community_posts" && ctx.op === "update") return { data: null, error: { message: "write failed" } };
      if (ctx.table === "community_comments" && ctx.op === "select") return { data: { user_id: OWNER } };
      if (ctx.table === "community_comments" && ctx.op === "update") return { data: null, error: { message: "write failed" } };
      return { data: null };
    });

    expect((await updatePostAction(POST, "Updated post")).error).not.toBeNull();
    expect((await updateCommentAction(COMMENT, "Updated comment")).error).not.toBeNull();
    expect(query(db, "community_posts", "update")).toBeDefined();
    expect(query(db, "community_comments", "update")).toBeDefined();
  });

  it("treats a zero-row post delete as failure and scopes delete to its owner", async () => {
    const db = setDb({ id: OWNER }, (ctx) =>
      ctx.table === "community_posts" && ctx.op === "delete"
        ? { data: [] }
        : { data: null },
    );

    const result = await deletePostAction(POST);

    expect(result.error).not.toBeNull();
    const deletion = query(db, "community_posts", "delete");
    expect(hasCall(deletion, "eq", "id", POST)).toBe(true);
    expect(hasCall(deletion, "eq", "user_id", OWNER)).toBe(true);
  });

  it("requires a public group before a direct join and scopes membership to the caller", async () => {
    const db = setDb({ id: MEMBER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { is_private: false } };
      return { data: null };
    });

    const result = await joinGroupAction(GROUP);

    expect(result.error).toBeNull();
    const membership = query(db, "community_group_members", "upsert");
    expect(hasCall(membership, "upsert", { group_id: GROUP, user_id: MEMBER, role: "member" })).toBe(true);
  });

  it("reports a failed public-group membership write", async () => {
    const db = setDb({ id: MEMBER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { is_private: false } };
      if (ctx.table === "community_group_members" && ctx.op === "upsert") return { data: null, error: { message: "membership write denied" } };
      return { data: null };
    });

    const result = await joinGroupAction(GROUP);

    expect(result.error).not.toBeNull();
    expect(hasCall(query(db, "community_group_members", "upsert"), "upsert", { group_id: GROUP, user_id: MEMBER, role: "member" })).toBe(true);
  });

  it("rejects anonymous community mutations before reaching the database", async () => {
    const db = setDb(null, () => ({ data: null }));

    expect((await createGroupAction({ name: "Study Group", is_private: true })).error).toBe("Not signed in");
    expect((await updateGroupAction(GROUP, { name: "Study Group", is_private: true })).error).toBe("Not signed in");
    expect((await approveJoinRequestAction(GROUP, MEMBER)).error).toBe("Not signed in");
    expect((await rejectJoinRequestAction(GROUP, MEMBER)).error).toBe("Not signed in");
    expect((await joinGroupAction(GROUP)).error).toBe("Not signed in");
    expect((await createPostAction({ content: "Hello", topic_tag: "ADVICE" })).error).toBe("Not signed in");
    expect((await updatePostAction(POST, "Edited")).error).toBe("Not signed in");
    expect((await updateCommentAction(COMMENT, "Edited")).error).toBe("Not signed in");
    expect(db.queries).toEqual([]);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("reports zero-row group and post updates without claiming success", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { creator_id: OWNER } };
      if (ctx.table === "community_posts" && ctx.op === "select")
        return { data: { user_id: OWNER, created_at: new Date().toISOString() } };
      if (ctx.op === "update") return { data: [] };
      return { data: null };
    });

    expect((await updateGroupAction(GROUP, { name: "Changed", is_private: false })).error).not.toBeNull();
    const post = await updatePostAction(POST, "Changed");
    expect(post.error).not.toBeNull();
    expect(post.content).toBeUndefined();
    expect(hasCall(query(db, "community_groups", "update"), "select", "id")).toBe(true);
    expect(hasCall(query(db, "community_posts", "update"), "select", "id")).toBe(true);
  });

  it("reports zero-row group, comment, and membership deletes", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { creator_id: MEMBER } };
      if (ctx.table === "community_comments" && ctx.op === "select") {
        if (ctx.calls.some((call) => call.method === "select" && !!(call.args[1] as { head?: boolean } | undefined)?.head))
          return { data: null, count: 0 };
        return { data: { user_id: OWNER, post_id: POST } };
      }
      if (ctx.op === "delete") return { data: [] };
      return { data: null };
    });

    expect((await leaveGroupAction(GROUP)).error).not.toBeNull();
    const comment = await deleteCommentAction(COMMENT);
    expect(comment.error).not.toBeNull();
    expect(comment.mode).toBeNull();
    expect(query(db, "community_comment_likes", "delete")).toBeUndefined();
    // A creator can pass the first owner check yet lose the row before DELETE.
    const ownerDb = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_groups" && ctx.op === "select") return { data: { creator_id: OWNER } };
      if (ctx.table === "community_groups" && ctx.op === "delete") return { data: [] };
      return { data: null };
    });
    expect((await deleteGroupAction(GROUP)).error).not.toBeNull();
    expect(hasCall(query(ownerDb, "community_groups", "delete"), "select", "id")).toBe(true);
  });

  it("keeps a comment intact when reply lookup fails", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_comments" && ctx.op === "select") {
        if (ctx.calls.some((call) => call.method === "select" && !!(call.args[1] as { head?: boolean } | undefined)?.head))
          return { data: null, count: null, error: { message: "count failed" } };
        return { data: { user_id: OWNER, post_id: POST } };
      }
      return { data: null };
    });

    const result = await deleteCommentAction(COMMENT);
    expect(result.mode).toBeNull();
    expect(result.error).toMatch(/check comment replies/i);
    expect(query(db, "community_comments", "delete")).toBeUndefined();
    expect(query(db, "community_comments", "update")).toBeUndefined();
  });

  it("reports zero-row comment edits and soft deletes", async () => {
    const db = setDb({ id: OWNER }, (ctx) => {
      if (ctx.table === "community_comments" && ctx.op === "select") {
        if (ctx.calls.some((call) => call.method === "select" && !!(call.args[1] as { head?: boolean } | undefined)?.head))
          return { data: null, count: 1 };
        return { data: { user_id: OWNER, post_id: POST } };
      }
      if (ctx.table === "community_comments" && ctx.op === "update") return { data: [] };
      return { data: null };
    });

    expect((await updateCommentAction(COMMENT, "Edited")).error).not.toBeNull();
    const deleted = await deleteCommentAction(COMMENT);
    expect(deleted.mode).toBeNull();
    expect(deleted.error).not.toBeNull();
    expect(query(db, "community_comments", "delete")).toBeUndefined();
  });
});
