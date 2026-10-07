import { beforeEach, describe, expect, it, vi } from "vitest";

// PROD-100: notifications are written by database triggers from the row that
// caused them. Server actions perform only the caller's own write and never
// touch the notifications table, so there is one delivery path and no client
// input can choose a recipient or actor.

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
import { toggleLikeAction } from "@/app/(main)/communities/actions/posts";
import { addCommentAction, toggleCommentLikeAction } from "@/app/(main)/communities/actions/comments";
import { followUserAction } from "@/app/(main)/communities/actions/follows";

const AUTHOR = "author-1";
const MEMBER = "member-1";
const POST = "550e8400-e29b-41d4-a716-446655440000";
const COMMENT = "550e8400-e29b-41d4-a716-446655440001";

type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };

function setDb(resolver: (ctx: QueryContext) => Result) {
  const db = createMockSupabase({ user: { id: MEMBER }, resolver });
  mocks.client = db;
  return db;
}

function writes(db: ReturnType<typeof createMockSupabase>, table: string) {
  return db.queries.filter((q) => q.table === table && q.op === "insert");
}

function insertedRow(ctx: QueryContext | undefined) {
  return ctx?.calls.find((call) => call.method === "insert")?.args[0];
}

function touchesNotifications(db: ReturnType<typeof createMockSupabase>) {
  return db.queries.some((q) => q.table === "notifications");
}

const isHeadCount = (ctx: QueryContext) =>
  ctx.calls.some((call) => call.method === "select" && !!(call.args[1] as { head?: boolean } | undefined)?.head);

describe("community activity leaves notifications to the database", () => {
  beforeEach(() => { mocks.client = null; });

  it("stores only the caller's post like", async () => {
    const db = setDb((ctx) => {
      if (ctx.table === "community_posts") return { data: { user_id: AUTHOR } };
      if (ctx.table === "community_blocks") return { data: [] };
      return { data: null };
    });

    const result = await toggleLikeAction(POST);

    expect(result).toEqual({ liked: true, error: null });
    expect(writes(db, "community_likes")).toHaveLength(1);
    expect(insertedRow(writes(db, "community_likes")[0])).toEqual({ post_id: POST, user_id: MEMBER });
    expect(touchesNotifications(db)).toBe(false);
  });

  it("does not notify on unlike either", async () => {
    const db = setDb((ctx) =>
      ctx.table === "community_likes" && ctx.op === "select" ? { data: { post_id: POST } } : { data: null },
    );

    const result = await toggleLikeAction(POST);

    expect(result).toEqual({ liked: false, error: null });
    expect(db.queries.some((q) => q.table === "community_likes" && q.op === "delete")).toBe(true);
    expect(touchesNotifications(db)).toBe(false);
  });

  it.each([
    ["a top-level comment", undefined],
    ["a reply", COMMENT],
  ])("stores only the caller's row for %s", async (_label, parentId) => {
    const db = setDb((ctx) => {
      if (ctx.table === "community_posts") return { data: { id: POST, user_id: AUTHOR, group_id: null, is_hidden: false } };
      if (ctx.table === "community_blocks") return { data: [] };
      if (ctx.table === "community_comments" && ctx.op === "insert")
        return { data: { id: "new-comment", post_id: POST, parent_comment_id: parentId ?? null, user_id: MEMBER, content: "Hi" } };
      if (ctx.table === "community_comments" && isHeadCount(ctx)) return { data: null, count: 0 };
      if (ctx.table === "community_comments") return { data: { post_id: POST, user_id: AUTHOR } };
      if (ctx.table === "profiles") return { data: { id: MEMBER, first_name: "E2E", last_name: "Member", avatar_url: null } };
      return { data: null };
    });

    const result = await addCommentAction(POST, "Hi", parentId);

    expect(result.error).toBeNull();
    expect(result.comment?.id).toBe("new-comment");
    expect(writes(db, "community_comments")).toHaveLength(1);
    expect(insertedRow(writes(db, "community_comments")[0])).toMatchObject({
      post_id: POST, user_id: MEMBER, parent_comment_id: parentId ?? null,
    });
    expect(touchesNotifications(db)).toBe(false);
  });

  it("stores only the caller's comment like", async () => {
    const db = setDb((ctx) => {
      if (ctx.table === "community_comments") return { data: { user_id: AUTHOR, post_id: POST } };
      if (ctx.table === "community_blocks") return { data: [] };
      return { data: null };
    });

    const result = await toggleCommentLikeAction(COMMENT);

    expect(result).toEqual({ liked: true, error: null });
    expect(insertedRow(writes(db, "community_comment_likes")[0])).toEqual({ comment_id: COMMENT, user_id: MEMBER });
    expect(touchesNotifications(db)).toBe(false);
  });

  it("stores only the caller's follow", async () => {
    const db = setDb((ctx) =>
      ctx.table === "community_follows" && ctx.op === "select" ? { data: null, count: 0 } : { data: null },
    );

    const result = await followUserAction(AUTHOR);

    expect(result.error).toBeNull();
    expect(insertedRow(writes(db, "community_follows")[0])).toEqual({ follower_id: MEMBER, followee_id: AUTHOR });
    expect(touchesNotifications(db)).toBe(false);
  });

  it("writes nothing for a blocked like, comment like or self-follow", async () => {
    const db = setDb((ctx) => {
      if (ctx.table === "community_posts") return { data: { user_id: AUTHOR } };
      if (ctx.table === "community_comments") return { data: { user_id: AUTHOR, post_id: POST } };
      if (ctx.table === "community_blocks") return { data: [{ blocker_id: AUTHOR }] };
      return { data: null };
    });

    expect((await toggleLikeAction(POST)).error).not.toBeNull();
    expect((await toggleCommentLikeAction(COMMENT)).error).not.toBeNull();
    expect((await followUserAction(MEMBER)).error).toBe("Cannot follow yourself");
    expect(db.queries.some((q) => q.op === "insert")).toBe(false);
  });
});
