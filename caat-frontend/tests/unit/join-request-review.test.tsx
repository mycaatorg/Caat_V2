// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JoinRequestReview } from "@/components/communities/JoinRequestReview";

const actions = vi.hoisted(() => ({
  approve: vi.fn(),
  reject: vi.fn(),
  errorToast: vi.fn(),
  successToast: vi.fn(),
}));

vi.mock("@/app/(main)/communities/actions", () => ({
  approveJoinRequestAction: actions.approve,
  rejectJoinRequestAction: actions.reject,
}));
vi.mock("sonner", () => ({ toast: { error: actions.errorToast, success: actions.successToast } }));

const roots: Root[] = [];
const GROUPS = [
  {
    id: "group-1", name: "Private Study", slug: "private-study",
    requests: [
      { user_id: "user-a", created_at: new Date().toISOString(), user: { id: "user-a", first_name: "Ada", last_name: "Lovelace", avatar_url: null } },
      { user_id: "user-b", created_at: new Date().toISOString(), user: null },
    ],
  },
];

async function mount(groups = GROUPS) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<JoinRequestReview groups={groups} />));
}

function row(name: string): HTMLElement {
  const item = [...document.querySelectorAll("li")].find((element) => element.textContent?.includes(name));
  if (!item) throw new Error(`Request row not found: ${name}`);
  return item;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((element) => element.textContent?.trim() === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("JoinRequestReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.approve.mockResolvedValue({ error: null });
    actions.reject.mockResolvedValue({ error: null });
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterEach(() => {
    act(() => { for (const root of roots.splice(0)) root.unmount(); });
    document.body.innerHTML = "";
  });

  it("lists each pending requester under the community they asked to join", async () => {
    await mount();

    expect(document.body.textContent).toContain("Private Study");
    expect(document.querySelector('a[href="/communities/c/private-study"]')).not.toBeNull();
    expect(row("Ada Lovelace")).toBeDefined();
    expect(row("Someone")).toBeDefined();
  });

  it("removes a request only after the owner approval succeeds", async () => {
    await mount();

    await act(async () => button(row("Ada Lovelace"), "Approve").click());
    await settle();

    expect(actions.approve).toHaveBeenCalledWith("group-1", "user-a");
    expect(actions.successToast).toHaveBeenCalledWith("Request approved.");
    expect(document.body.textContent).not.toContain("Ada Lovelace");
    expect(row("Someone")).toBeDefined();
  });

  it("keeps the request and shows the error when approval fails", async () => {
    actions.approve.mockResolvedValue({ error: "Could not approve this join request." });
    await mount();

    await act(async () => button(row("Ada Lovelace"), "Approve").click());
    await settle();

    expect(actions.errorToast).toHaveBeenCalledWith("Could not approve this join request.");
    expect(row("Ada Lovelace")).toBeDefined();
    expect(button(row("Ada Lovelace"), "Approve").disabled).toBe(false);
  });

  it("declines a request and shows the empty state once the queue is clear", async () => {
    await mount([{ ...GROUPS[0], requests: [GROUPS[0].requests[0]] }]);

    await act(async () => button(row("Ada Lovelace"), "Decline").click());
    await settle();

    expect(actions.reject).toHaveBeenCalledWith("group-1", "user-a");
    expect(actions.successToast).toHaveBeenCalledWith("Request declined.");
    expect(document.body.textContent).toContain("No pending join requests.");
  });

  it("keeps a declined request visible when the server refuses", async () => {
    actions.reject.mockResolvedValue({ error: "Not authorized" });
    await mount();

    await act(async () => button(row("Ada Lovelace"), "Decline").click());
    await settle();

    expect(actions.errorToast).toHaveBeenCalledWith("Not authorized");
    expect(row("Ada Lovelace")).toBeDefined();
  });

  it("shows the empty state when nothing is waiting", async () => {
    await mount([]);

    expect(document.body.textContent).toContain("No pending join requests.");
  });
});
