// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/app/(main)/settings/actions", () => ({ deleteMyAccount: mocks.deleteAccount }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { DataAccountSection } from "@/app/(main)/settings/client";

const roots: Root[] = [];

async function mountAccountSettings() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<DataAccountSection />));
  return root;
}

function buttonNamed(label: string, index = 0): HTMLButtonElement {
  const matching = [...document.querySelectorAll("button")].filter((button) => button.textContent?.trim() === label);
  const button = matching[index];
  if (!button) throw new Error(`Button not found: ${label} (index ${index})`);
  return button;
}

function typeConfirmation(value: string) {
  const input = document.querySelector<HTMLInputElement>("#confirm-delete");
  if (!input) throw new Error("Confirmation input not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  });
}

async function settleEffects() {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
}

describe("DataAccountSection confirmation and recovery", () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    mocks.deleteAccount.mockReset().mockResolvedValue({ ok: false, error: "Could not delete your account. Please try again." });
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.success.mockReset();
    mocks.error.mockReset();
  });

  afterEach(() => {
    act(() => { for (const root of roots.splice(0)) root.unmount(); });
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("requires the exact confirmation word before calling the deletion action", async () => {
    await mountAccountSettings();

    await act(async () => buttonNamed("Delete my account").click());
    expect(document.body.textContent).toContain("Type DELETE to confirm");
    expect(buttonNamed("Delete my account", 1).disabled).toBe(true);
    await act(async () => buttonNamed("Delete my account", 1).click());
    expect(mocks.deleteAccount).not.toHaveBeenCalled();

    typeConfirmation("delete");
    expect(buttonNamed("Delete my account", 1).disabled).toBe(true);
    typeConfirmation("DELETE");
    expect(buttonNamed("Delete my account", 1).disabled).toBe(false);
  });

  it("keeps the confirmation dialog open and session intact when deletion fails", async () => {
    await mountAccountSettings();

    await act(async () => buttonNamed("Delete my account").click());
    typeConfirmation("DELETE");
    await act(async () => buttonNamed("Delete my account", 1).click());
    await settleEffects();

    expect(mocks.deleteAccount).toHaveBeenCalledOnce();
    expect(mocks.error).toHaveBeenCalledWith("Could not delete your account. Please try again.");
    expect(document.body.textContent).toContain("Delete your account?");
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("closes the dialog and redirects only after the deletion action succeeds", async () => {
    mocks.deleteAccount.mockResolvedValue({ ok: true });
    await mountAccountSettings();

    await act(async () => buttonNamed("Delete my account").click());
    typeConfirmation("DELETE");
    await act(async () => buttonNamed("Delete my account", 1).click());
    await settleEffects();

    expect(mocks.success).toHaveBeenCalledWith("Your account has been deleted.");
    expect(mocks.replace).toHaveBeenCalledWith("/");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain("Delete your account?");
  });

  it("recovers the export button and reports fetch failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    await mountAccountSettings();

    await act(async () => buttonNamed("Export my data").click());
    await settleEffects();

    expect(fetchMock).toHaveBeenCalledWith("/settings/export");
    expect(mocks.error).toHaveBeenCalledWith("Could not export your data. Please try again.");
    expect(buttonNamed("Export my data").disabled).toBe(false);
  });
});
