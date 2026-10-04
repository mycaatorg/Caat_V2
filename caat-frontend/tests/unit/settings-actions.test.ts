import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  getUserError: null as { message: string } | null,
  rpcResult: { error: null as null | { message: string } },
  getUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: state.getUser, signOut: state.signOut },
    rpc: state.rpc,
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
