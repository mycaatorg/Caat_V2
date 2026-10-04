import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EssayDraft } from "@/components/essays/api";

type Query = { table: string; op: string; calls: { method: string; args: unknown[] }[] };
type Result = { data?: unknown; error?: { message: string } | null };

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  authError: null as { message: string } | null,
  queries: [] as Query[],
  resolve: null as unknown as (query: Query) => Result,
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  const client = {
    auth: {
      getUser: () => state.getUser(),
    },
    from: (table: string) => {
      const query: Query = { table, op: "select", calls: [] };
      state.queries.push(query);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "insert", "update", "delete"]) {
        builder[method] = (...args: unknown[]) => {
          query.calls.push({ method, args });
          if (["insert", "update", "delete"].includes(method)) query.op = method;
          return builder;
        };
      }
      builder.single = () => Promise.resolve(state.resolve(query));
      builder.maybeSingle = () => Promise.resolve(state.resolve(query));
      builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(state.resolve(query)).then(resolve, reject);
      return builder;
    },
  };
  return { supabase: client };
});

import {
  createDraft,
  deleteDraft,
  fetchDraftsForPrompt,
  setCurrentDraft,
  updateDraft,
} from "@/components/essays/api";

const existingDraft: EssayDraft = {
  id: "draft-1",
  user_id: "user-1",
  prompt_id: "prompt-1",
  prompt_slug: "prompt-1",
  label: "Draft 1",
  content: "Existing response",
  is_current: true,
  school_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  state.user = { id: "user-1" };
  state.authError = null;
  state.queries = [];
  state.resolve = () => ({ data: null, error: null });
  state.getUser.mockReset().mockImplementation(async () => ({
    data: { user: state.user },
    error: state.authError,
  }));
});

describe("essay draft persistence API", () => {
  it("lists only the caller's drafts for the requested prompt", async () => {
    state.resolve = () => ({ data: [existingDraft], error: null });

    await expect(fetchDraftsForPrompt("prompt-1")).resolves.toEqual([existingDraft]);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].calls).toEqual([
      { method: "select", args: ["*"] },
      { method: "eq", args: ["user_id", "user-1"] },
      { method: "eq", args: ["prompt_id", "prompt-1"] },
      { method: "order", args: ["updated_at", { ascending: false }] },
    ]);
  });

  it("rejects draft listing when there is no signed-in user", async () => {
    state.user = null;

    await expect(fetchDraftsForPrompt("prompt-1")).rejects.toThrow("Not signed in");
    expect(state.queries).toHaveLength(0);
  });

  it("propagates list query errors", async () => {
    state.resolve = () => ({ data: null, error: { message: "draft list failed" } });

    await expect(fetchDraftsForPrompt("prompt-1")).rejects.toThrow("draft list failed");
  });

  it("updates content and scopes the write to the caller and draft id", async () => {
    await expect(updateDraft("draft-1", { content: "Saved response" })).resolves.toBeUndefined();

    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].op).toBe("update");
    expect(state.queries[0].calls).toEqual([
      { method: "update", args: [{ content: "Saved response" }] },
      { method: "eq", args: ["id", "draft-1"] },
      { method: "eq", args: ["user_id", "user-1"] },
    ]);
  });

  it("rejects updates without a signed-in user before issuing a write", async () => {
    state.user = null;

    await expect(updateDraft("draft-1", { content: "Must not write" })).rejects.toThrow("Not signed in");
    expect(state.queries).toHaveLength(0);
  });

  it("propagates an update error so callers can retain retryable content", async () => {
    state.resolve = () => ({ data: null, error: { message: "save failed" } });

    await expect(updateDraft("draft-1", { content: "Retry me" })).rejects.toThrow("save failed");
  });

  it("creates a new current draft with the caller and prompt metadata", async () => {
    const created = { ...existingDraft, id: "draft-2", content: "", is_current: true };
    state.resolve = (query) => query.op === "insert" ? { data: created, error: null } : { data: null, error: null };

    await expect(createDraft({ promptId: "prompt-1", promptSlug: "prompt-1", label: "Draft 2" })).resolves.toEqual(created);
    expect(state.queries.map((query) => query.op)).toEqual(["update", "insert"]);
    expect(state.queries[0].calls.slice(-2)).toEqual([
      { method: "eq", args: ["user_id", "user-1"] },
      { method: "eq", args: ["prompt_id", "prompt-1"] },
    ]);
    expect(state.queries[1].calls[0]).toEqual({
      method: "insert",
      args: [{
        user_id: "user-1",
        prompt_id: "prompt-1",
        prompt_slug: "prompt-1",
        content: "",
        label: "Draft 2",
        is_current: true,
        school_id: null,
      }],
    });
  });

  it("rejects draft creation when its insert fails", async () => {
    state.resolve = (query) => query.op === "insert"
      ? { data: null, error: { message: "insert failed" } }
      : { data: null, error: null };
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createDraft({ promptId: "prompt-1", promptSlug: "prompt-1" })).rejects.toThrow("insert failed");
    expect(state.queries.map((query) => query.op)).toEqual(["update", "insert"]);
    logError.mockRestore();
  });

  it("rejects draft creation without a signed-in user before clearing current drafts", async () => {
    state.user = null;

    await expect(createDraft({ promptId: "prompt-1", promptSlug: "prompt-1" })).rejects.toThrow("Not signed in");
    expect(state.queries).toHaveLength(0);
  });

  it("deletes only the caller's selected draft", async () => {
    await expect(deleteDraft("draft-1")).resolves.toBeUndefined();

    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].op).toBe("delete");
    expect(state.queries[0].calls).toEqual([
      { method: "delete", args: [] },
      { method: "eq", args: ["id", "draft-1"] },
      { method: "eq", args: ["user_id", "user-1"] },
    ]);
  });

  it("propagates a draft deletion error", async () => {
    state.resolve = () => ({ data: null, error: { message: "delete failed" } });

    await expect(deleteDraft("draft-1")).rejects.toThrow("delete failed");
  });

  it("rejects draft deletion without a signed-in user before issuing a delete", async () => {
    state.user = null;

    await expect(deleteDraft("draft-1")).rejects.toThrow("Not signed in");
    expect(state.queries).toHaveLength(0);
  });

  it("clears and then selects a current draft with caller scoping on both writes", async () => {
    await expect(setCurrentDraft("draft-2", "prompt-1")).resolves.toBeUndefined();

    expect(state.queries).toHaveLength(2);
    expect(state.queries.map((query) => query.op)).toEqual(["update", "update"]);
    expect(state.queries[0].calls).toEqual([
      { method: "update", args: [{ is_current: false }] },
      { method: "eq", args: ["user_id", "user-1"] },
      { method: "eq", args: ["prompt_id", "prompt-1"] },
    ]);
    expect(state.queries[1].calls).toEqual([
      { method: "update", args: [{ is_current: true }] },
      { method: "eq", args: ["id", "draft-2"] },
      { method: "eq", args: ["user_id", "user-1"] },
    ]);
  });

  it("does not select a draft if clearing the previous current draft fails", async () => {
    state.resolve = (query) => query === state.queries[0]
      ? { data: null, error: { message: "reset failed" } }
      : { data: null, error: null };

    await expect(setCurrentDraft("draft-2", "prompt-1")).rejects.toThrow("reset failed");
    expect(state.queries).toHaveLength(1);
  });

  it("propagates a selection error after clearing the previous current draft", async () => {
    state.resolve = (query) => query === state.queries[1]
      ? { data: null, error: { message: "selection failed" } }
      : { data: null, error: null };

    await expect(setCurrentDraft("draft-2", "prompt-1")).rejects.toThrow("selection failed");
    expect(state.queries).toHaveLength(2);
  });

  it("does not insert a new draft if clearing the current draft fails", async () => {
    state.resolve = (query) => query === state.queries[0]
      ? { data: null, error: { message: "reset failed" } }
      : { data: { ...existingDraft, id: "draft-2", content: "" }, error: null };

    await expect(createDraft({ promptId: "prompt-1", promptSlug: "prompt-1" })).rejects.toThrow("reset failed");
    expect(state.queries).toHaveLength(1);
  });

  it("rejects selecting a current draft without a signed-in user before either write", async () => {
    state.user = null;

    await expect(setCurrentDraft("draft-2", "prompt-1")).rejects.toThrow("Not signed in");
    expect(state.queries).toHaveLength(0);
  });
});
