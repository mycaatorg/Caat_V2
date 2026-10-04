// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalInfoCard } from "@/components/profile/PersonalInfoCard";

const initialInfo = {
  firstName: "Ada",
  lastName: "Lovelace",
  birthDate: "1815-12-10",
  nationality: "British",
  currentLocation: "London",
  phone: "+44 20 0000 0000",
  linkedin: "linkedin.com/in/ada",
  github: "github.com/ada",
};
const roots: Root[] = [];

function ProfileHarness({ persist }: { persist: (next: typeof initialInfo) => Promise<void> }) {
  const [data, setData] = useState(initialInfo);
  return (
    <PersonalInfoCard
      data={data}
      onSave={async (next) => {
        await persist(next);
        setData(next);
      }}
    />
  );
}

async function mountProfile(persist: (next: typeof initialInfo) => Promise<void>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<ProfileHarness persist={persist} />));
  return root;
}

function buttonNamed(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim().includes(label));
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function iconButton(index: number): HTMLButtonElement {
  const button = document.querySelectorAll<HTMLButtonElement>("button")[index];
  if (!button) throw new Error(`Icon button not found at index ${index}`);
  return button;
}

function firstNameInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[data-slot="input"]');
  if (!input) throw new Error("First name input not found");
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  });
}

async function settleEffects() {
  await act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
}

describe("PersonalInfoCard editing", () => {
  beforeEach(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }));
  afterEach(() => {
    act(() => { for (const root of roots.splice(0)) root.unmount(); });
    document.body.innerHTML = "";
  });

  it("discards unsaved edits when the user cancels", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    await mountProfile(persist);

    await act(async () => buttonNamed("Edit").click());
    setInputValue(firstNameInput(), "Grace");
    expect(firstNameInput().value).toBe("Grace");
    await act(async () => iconButton(1).click());

    expect(document.body.textContent).toContain("Ada Lovelace");
    expect(document.body.textContent).not.toContain("Save");
    expect(persist).not.toHaveBeenCalled();
  });

  it("persists the edited record, waits for completion, then renders the saved profile", async () => {
    let finishSave!: () => void;
    const persistence = vi.fn(
      (next: typeof initialInfo) => new Promise<void>((resolve) => {
        void next;
        finishSave = () => resolve();
      }),
    );
    await mountProfile(persistence);

    await act(async () => buttonNamed("Edit").click());
    setInputValue(firstNameInput(), "Grace");
    await act(async () => buttonNamed("Save").click());
    await settleEffects();

    expect(persistence).toHaveBeenCalledTimes(1);
    expect(persistence.mock.calls[0][0]).toEqual({ ...initialInfo, firstName: "Grace" });
    expect(buttonNamed("Saving…").disabled).toBe(true);
    expect(document.body.textContent).not.toContain("Grace Lovelace");

    await act(async () => finishSave());

    expect(document.body.textContent).toContain("Grace Lovelace");
    expect(buttonNamed("Edit")).toBeDefined();
  });

  it("starts a later edit from the last saved record and cancel keeps that record", async () => {
    const persisted: Array<typeof initialInfo> = [];
    await mountProfile(async (next) => { persisted.push(next); });

    await act(async () => buttonNamed("Edit").click());
    setInputValue(firstNameInput(), "Grace");
    await act(async () => buttonNamed("Save").click());
    await settleEffects();
    expect(document.body.textContent).toContain("Grace Lovelace");

    await act(async () => buttonNamed("Edit").click());
    expect(firstNameInput().value).toBe("Grace");
    setInputValue(firstNameInput(), "Augusta");
    await act(async () => iconButton(1).click());

    expect(document.body.textContent).toContain("Grace Lovelace");
    expect(persisted).toHaveLength(1);
    expect(persisted[0].firstName).toBe("Grace");
  });
});
