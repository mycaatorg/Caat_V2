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
  hidden: new Set<string>(),
  timeline: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: state.getUser, signOut: state.signOut },
    rpc: state.rpc,
    storage: {
      from: (bucket: string) => ({
        // Honours limit/offset like storage-js, so missing pagination shows up.
        list: async (folder: string, opts: { limit?: number; offset?: number } = {}) => {
          if (state.listError) return { data: null, error: state.listError };
          const all = state.objects[bucket]?.[folder] ?? [];
          const offset = opts.offset ?? 0;
          return { data: all.slice(offset, offset + (opts.limit ?? 100)), error: null };
        },
        // Removes what RLS allows; hidden paths report no error but stay, as
        // storage-js does for objects a policy hides.
        remove: async (paths: string[]) => {
          state.timeline.push(`remove:${bucket}`);
          if (state.removeError) return { data: null, error: state.removeError };
          const gone = paths.filter((p) => !state.hidden.has(p));
          state.removed.push({ bucket, paths: gone });
          for (const p of gone) {
            const folder = p.slice(0, p.lastIndexOf("/"));
            const name = p.slice(p.lastIndexOf("/") + 1);
            const entries = state.objects[bucket]?.[folder];
            if (entries) state.objects[bucket][folder] = entries.filter((e) => e.name !== name);
          }
          return { data: gone.map((name) => ({ name })), error: null };
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
  state.hidden = new Set();
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
      error: "Your uploaded files were removed, but your account could not be deleted. Please try again.",
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
      error: "Could not delete all of your uploaded files, so your account has not been deleted. Some files may already be gone. Please try again.",
    });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("does not delete the account when the file listing fails", async () => {
    state.listError = { message: "list failed" };
    await expect(deleteMyAccount()).resolves.toMatchObject({ ok: false });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("pages through folders with more than 1,000 entries", async () => {
    const many = Array.from({ length: 1205 }, (_, i) => ({ name: `f${i}.pdf`, id: String(i) }));
    state.objects = { "user-documents": { "user-1": many } };
    await expect(deleteMyAccount()).resolves.toEqual({ ok: true });
    expect(state.removed.flatMap((r) => r.paths)).toHaveLength(1205);
    expect(state.rpc).toHaveBeenCalledOnce();
  });

  it("does not delete the account when a removal silently leaves files behind", async () => {
    state.objects = { "user-documents": { "user-1": [{ name: "a.pdf", id: "1" }, { name: "b.pdf", id: "2" }] } };
    state.hidden = new Set(["user-1/b.pdf"]);
    await expect(deleteMyAccount()).resolves.toMatchObject({ ok: false });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("says the files are gone when only the account deletion fails", async () => {
    state.objects = { "user-documents": { "user-1": [{ name: "a.pdf", id: "1" }] } };
    state.rpcResult = { error: { message: "rpc failed" } };
    await expect(deleteMyAccount()).resolves.toEqual({
      ok: false,
      error: "Your uploaded files were removed, but your account could not be deleted. Please try again.",
    });
  });
});
