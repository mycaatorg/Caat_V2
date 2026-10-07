import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  getUserError: null as { message: string } | null,
  rpcResult: { error: null as null | { message: string } },
  getUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  // Storage: bucket -> folder -> entries; folders have id null.
  objects: {} as Record<string, Record<string, { name: string; id: string | null }[]>>,
  removed: [] as { bucket: string; paths: string[] }[],
  removeError: null as null | { message: string },
  listError: null as null | { message: string },
  timeline: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: state.getUser, signOut: state.signOut },
    rpc: state.rpc,
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string) =>
          state.listError ? { data: null, error: state.listError } : { data: state.objects[bucket]?.[folder] ?? [], error: null },
        remove: async (paths: string[]) => {
          state.timeline.push(`remove:${bucket}`);
          if (state.removeError) return { data: null, error: state.removeError };
          state.removed.push({ bucket, paths });
          return { data: paths.map((name) => ({ name })), error: null };
        },
      }),
    },
  }),
}));

import { deleteMyAccount } from "@/app/(main)/settings/actions";

beforeEach(() => {
  state.user = { id: "user-1" };
  state.getUserError = null;
  state.rpcResult = { error: null };
  state.getUser.mockReset().mockImplementation(async () => ({ data: { user: state.user }, error: state.getUserError }));
  state.rpc.mockReset().mockImplementation(async () => state.rpcResult);
  state.signOut.mockReset().mockResolvedValue({ error: null });
  state.objects = {};
  state.removed = [];
  state.removeError = null;
  state.listError = null;
  state.timeline = [];
  state.rpc.mockImplementation(async () => {
    state.timeline.push("rpc");
    return state.rpcResult;
  });
});

describe("deleteMyAccount server action", () => {
  it("denies account deletion without an authenticated user", async () => {
    state.user = null;

    await expect(deleteMyAccount()).resolves.toEqual({ ok: false, error: "You are not signed in." });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("calls the authenticated account-deletion RPC and signs out after success", async () => {
    await expect(deleteMyAccount()).resolves.toEqual({ ok: true });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("delete_own_account");
    expect(state.signOut).toHaveBeenCalledOnce();
  });

  it("keeps the session when the deletion RPC fails so the user can retry", async () => {
    state.rpcResult = { error: { message: "rpc failed" } };

    await expect(deleteMyAccount()).resolves.toEqual({
      ok: false,
      error: "Could not delete your account. Please try again.",
    });
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith("delete_own_account");
    expect(state.signOut).not.toHaveBeenCalled();
  });
});

describe("deleteMyAccount uploaded files", () => {
  it("removes the student's uploaded documents and avatar before deleting the account", async () => {
    state.objects = {
      "user-documents": {
        "user-1": [{ name: "transcripts", id: null }, { name: "identity", id: null }],
        "user-1/transcripts": [{ name: "a.pdf", id: "1" }, { name: "b.pdf", id: "2" }],
        "user-1/identity": [{ name: "passport.jpg", id: "3" }],
      },
      "profile-avatars": { "user-1": [{ name: "avatar.png", id: "4" }] },
    };
    await expect(deleteMyAccount()).resolves.toEqual({ ok: true });
    const removed = Object.fromEntries(state.removed.map((r) => [r.bucket, r.paths.sort()]));
    expect(removed).toEqual({
      "user-documents": ["user-1/identity/passport.jpg", "user-1/transcripts/a.pdf", "user-1/transcripts/b.pdf"],
      "profile-avatars": ["user-1/avatar.png"],
    });
    expect(state.timeline.at(-1)).toBe("rpc");
    expect(state.timeline.indexOf("rpc")).toBeGreaterThan(state.timeline.lastIndexOf("remove:user-documents"));
  });

  it("keeps the account intact when files cannot be removed, so the student can retry", async () => {
    state.objects = { "user-documents": { "user-1": [{ name: "a.pdf", id: "1" }] } };
    state.removeError = { message: "storage unavailable" };
    await expect(deleteMyAccount()).resolves.toEqual({
      ok: false,
      error: "Could not delete your uploaded files. Your account has not been deleted. Please try again.",
    });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("does not delete the account when the file listing fails", async () => {
    state.listError = { message: "list failed" };
    await expect(deleteMyAccount()).resolves.toMatchObject({ ok: false });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("only touches the signed-in student's own folders", async () => {
    state.objects = { "user-documents": { "user-1": [{ name: "a.pdf", id: "1" }], "user-2": [{ name: "x.pdf", id: "9" }] } };
    await deleteMyAccount();
    expect(state.removed.flatMap((r) => r.paths).every((p) => p.startsWith("user-1/"))).toBe(true);
  });
});
