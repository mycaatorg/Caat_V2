import { beforeEach, describe, expect, it, vi } from "vitest";

// PROD-102: likes and follows must not report success when the write fails.
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
import { toggleCommentLikeAction } from "@/app/(main)/communities/actions/comments";
import { followUserAction, unfollowUserAction } from "@/app/(main)/communities/actions/follows";

const ME = "student-1";
const AUTHOR = "author-1";
const POST = "550e8400-e29b-41d4-a716-446655440000";
const COMMENT = "550e8400-e29b-41d4-a716-446655440001";
const REFUSED = { message: "new row violates row-level security policy", code: "42501" };
const DUPLICATE = { message: "duplicate key value violates unique constraint", code: "23505" };

type Result = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };

function setDb(resolver: (ctx: QueryContext) => Result) {
  const db = createMockSupabase({ user: { id: ME }, resolver });
  mocks.client = db;
  return db;
}

const writes = (db: ReturnType<typeof createMockSupabase>, table: string, op: QueryContext["op"]) =>
  db.queries.filter((q) => q.table === table && q.op === op);

/** Reads succeed (nothing liked or followed yet, no blocks); writes use `write`. */
function reads(existing: unknown, write: (ctx: QueryContext) => Result) {
  return (ctx: QueryContext): Result => {
    if (ctx.op !== "select") return write(ctx);
    if (ctx.table === "community_likes" || ctx.table === "community_comment_likes") return { data: existing, error: null };
    if (ctx.table === "community_posts") return { data: { user_id: AUTHOR }, error: null };
    if (ctx.table === "community_comments") return { data: { user_id: AUTHOR, post_id: POST }, error: null };
    if (ctx.table === "community_follows") return { data: null, error: null, count: 0 };
    return { data: [], error: null };
  };
}

describe("community likes and follows report failed writes", () => {
  beforeEach(() => {
    mocks.client = null;
  });

  it("reports a refused post like instead of claiming it is liked", async () => {
    setDb(reads(null, (ctx) => (ctx.table === "community_likes" ? { data: null, error: REFUSED } : { data: null, error: null })));
    const result = await toggleLikeAction(POST);
    expect(result.error).toBeTruthy();
    expect(result.liked).toBe(false);
  });

  it("reports a failed unlike and keeps the post liked", async () => {
    setDb(reads({ post_id: POST }, (ctx) => (ctx.table === "community_likes" ? { data: null, error: REFUSED } : { data: null, error: null })));
    const result = await toggleLikeAction(POST);
    expect(result.error).toBeTruthy();
    expect(result.liked).toBe(true);
  });

  it("stops when it cannot tell whether the post is already liked", async () => {
    const db = setDb((ctx) =>
      ctx.table === "community_likes" && ctx.op === "select" ? { data: null, error: { message: "network down" } } : reads(null, () => ({ data: null, error: null }))(ctx),
    );
    const result = await toggleLikeAction(POST);
    expect(result.error).toBeTruthy();
    expect(writes(db, "community_likes", "insert")).toHaveLength(0);
    expect(writes(db, "community_likes", "delete")).toHaveLength(0);
  });

  it("treats a like that already exists as liked", async () => {
    setDb(reads(null, (ctx) => (ctx.table === "community_likes" ? { data: null, error: DUPLICATE } : { data: null, error: null })));
    expect(await toggleLikeAction(POST)).toEqual({ liked: true, error: null });
  });

  it("reports a refused comment like and a failed comment unlike", async () => {
    setDb(reads(null, (ctx) => (ctx.table === "community_comment_likes" ? { data: null, error: REFUSED } : { data: null, error: null })));
    const liked = await toggleCommentLikeAction(COMMENT);
    expect(liked.error).toBeTruthy();
    expect(liked.liked).toBe(false);

    setDb(reads({ comment_id: COMMENT }, (ctx) => (ctx.table === "community_comment_likes" ? { data: null, error: REFUSED } : { data: null, error: null })));
    const unliked = await toggleCommentLikeAction(COMMENT);
    expect(unliked.error).toBeTruthy();
    expect(unliked.liked).toBe(true);
  });

  it("reports a refused follow, but treats an existing follow as followed", async () => {
    setDb(reads(null, (ctx) => (ctx.table === "community_follows" ? { data: null, error: REFUSED } : { data: null, error: null })));
    expect((await followUserAction(AUTHOR)).error).toBeTruthy();

    setDb(reads(null, (ctx) => (ctx.table === "community_follows" ? { data: null, error: DUPLICATE } : { data: null, error: null })));
    expect(await followUserAction(AUTHOR)).toEqual({ error: null });
  });

  it("reports a failed unfollow", async () => {
    setDb(reads(null, (ctx) => (ctx.table === "community_follows" ? { data: null, error: REFUSED } : { data: null, error: null })));
    expect((await unfollowUserAction(AUTHOR)).error).toBeTruthy();
  });

  it("still succeeds when every write succeeds", async () => {
    setDb(reads(null, () => ({ data: null, error: null })));
    expect(await toggleLikeAction(POST)).toEqual({ liked: true, error: null });
    expect(await toggleCommentLikeAction(COMMENT)).toEqual({ liked: true, error: null });
    expect(await followUserAction(AUTHOR)).toEqual({ error: null });
    expect(await unfollowUserAction(AUTHOR)).toEqual({ error: null });
  });
});
