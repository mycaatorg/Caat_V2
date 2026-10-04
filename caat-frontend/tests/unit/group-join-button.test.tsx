// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GroupJoinButton } from "@/components/communities/GroupJoinButton";

const actions = vi.hoisted(() => ({
  join: vi.fn(),
  leave: vi.fn(),
  request: vi.fn(),
  errorToast: vi.fn(),
  successToast: vi.fn(),
}));

vi.mock("@/app/(main)/communities/actions", () => ({
  joinGroupAction: actions.join,
  leaveGroupAction: actions.leave,
  requestJoinGroupAction: actions.request,
}));
vi.mock("sonner", () => ({ toast: { error: actions.errorToast, success: actions.successToast } }));

const roots: Root[] = [];

function buttonNamed(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}. Buttons: ${[...document.querySelectorAll("button")].map((item) => item.textContent).join(" | ")}`);
  return button;
}

function buttonAt(index: number): HTMLButtonElement {
  const button = document.querySelectorAll<HTMLButtonElement>("button")[index];
  if (!button) throw new Error(`Button not found at index ${index}`);
  return button;
}

function confirmationButton(prompt: "Join?" | "Send request?"): HTMLButtonElement {
  const text = [...document.querySelectorAll("span")].find((item) => item.textContent?.trim() === prompt);
  const button = text?.parentElement?.querySelector("button");
  if (!button) throw new Error(`Confirmation button not found for ${prompt}`);
  return button;
}

function buttonWithLabel(label: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

async function mountGroup(props: React.ComponentProps<typeof GroupJoinButton>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<GroupJoinButton {...props} />));
  return root;
}

async function settleEffects() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("GroupJoinButton membership transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.join.mockResolvedValue({ error: null });
    actions.leave.mockResolvedValue({ error: null });
    actions.request.mockResolvedValue({ error: null });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterEach(() => {
    act(() => { for (const root of roots.splice(0)) root.unmount(); });
    document.body.innerHTML = "";
  });

  it("requires confirmation and cancelling leaves membership unchanged", async () => {
    await mountGroup({ groupId: "group-1", initialIsMember: false, isOwner: false });

    await act(async () => buttonNamed("Join").click());
    expect(document.body.textContent).toContain("Join?");
    await act(async () => buttonAt(1).click());

    expect(buttonNamed("Join")).toBeDefined();
    expect(actions.join).not.toHaveBeenCalled();
  });

  it("restores the original join state when the server rejects membership", async () => {
    const response = deferred<{ error: string }>();
    actions.join.mockReturnValue(response.promise);
    await mountGroup({ groupId: "group-7", initialIsMember: false, isOwner: false });

    await act(async () => buttonNamed("Join").click());
    await act(async () => confirmationButton("Join?").click());
    await settleEffects();

    expect(actions.join).toHaveBeenCalledWith("group-7");
    await act(async () => response.resolve({ error: "Membership could not be saved" }));
    await settleEffects();

    expect(buttonNamed("Join")).toBeDefined();
    expect(actions.errorToast).toHaveBeenCalledWith("Membership could not be saved");
  });

  it("keeps membership after a successful join action", async () => {
    const persistedMemberships = new Set<string>();
    actions.join.mockImplementation(async (groupId: string) => {
      persistedMemberships.add(groupId);
      return { error: null };
    });
    await mountGroup({ groupId: "group-9", initialIsMember: false, isOwner: false });

    await act(async () => buttonNamed("Join").click());
    await act(async () => confirmationButton("Join?").click());
    await settleEffects();

    expect(buttonNamed("Joined")).toBeDefined();
    expect(persistedMemberships.has("group-9")).toBe(true);
  });

  it("restores membership after a failed leave request", async () => {
    const response = deferred<{ error: string }>();
    actions.leave.mockReturnValue(response.promise);
    await mountGroup({ groupId: "group-3", initialIsMember: true, isOwner: false });

    await act(async () => buttonNamed("Joined").click());
    expect(document.body.textContent).toContain("Leave?");
    await act(async () => buttonWithLabel("Confirm leave community").click());
    await settleEffects();

    expect(actions.leave).toHaveBeenCalledWith("group-3");
    await act(async () => response.resolve({ error: "Could not leave community" }));

    expect(buttonNamed("Joined")).toBeDefined();
    expect(actions.errorToast).toHaveBeenCalledWith("Could not leave community");
  });

  it("moves a private community to Requested after its request is accepted", async () => {
    const persistedRequests = new Set<string>();
    actions.request.mockImplementation(async (groupId: string) => {
      persistedRequests.add(groupId);
      return { error: null };
    });
    await mountGroup({ groupId: "private-4", initialIsMember: false, isOwner: false, isPrivate: true });

    await act(async () => buttonNamed("Request to Join").click());
    await act(async () => confirmationButton("Send request?").click());
    await settleEffects();

    expect(buttonNamed("Requested").disabled).toBe(true);
    expect(persistedRequests.has("private-4")).toBe(true);
    expect(actions.successToast).toHaveBeenCalledWith("Join request sent to community owner");
  });
});
