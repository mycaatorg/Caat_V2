// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  preflight: vi.fn(),
  routerPush: vi.fn(),
  captchaReset: vi.fn(),
  captchaSerial: 0,
  authCallback: null as null | ((event: string) => void),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      getUser: mocks.getUser,
      updateUser: mocks.updateUser,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
}));
vi.mock("@/app/auth-actions", () => ({ preflightAuthAction: mocks.preflight }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.routerPush }) }));
vi.mock("next/image", () => ({ default: (props: { src?: string | object }) => <span data-image={String(props.src ?? "")} /> }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/components/TurnstileWidget", async () => {
  const ReactModule = await import("react");
  const TurnstileWidget = ReactModule.forwardRef<
    { reset: () => void },
    { onVerify: (token: string) => void }
  >(({ onVerify }, ref) => {
    ReactModule.useImperativeHandle(ref, () => ({ reset: mocks.captchaReset }), []);
    return <button type="button" onClick={() => onVerify(`captcha-${++mocks.captchaSerial}`)}>Verify challenge</button>;
  });
  return { TurnstileWidget, captchaEnabled: true };
});

import ForgotPasswordPage from "@/app/forgot-password/page";
import ResetPasswordPage from "@/app/reset-password/page";

const roots: Root[] = [];

async function mount(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(element));
  return root;
}

function input(id: string): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(`#${id}`);
  if (!found) throw new Error(`Input not found: ${id}`);
  return found;
}

function fill(id: string, value: string) {
  const field = input(id);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(field, value);
    field.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  });
}

function buttonNamed(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim().startsWith(label));
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

async function submitForm() {
  const form = document.querySelector("form");
  if (!form) throw new Error("Recovery form not found");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

async function settleEffects() {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
  mocks.onAuthStateChange.mockReset().mockImplementation((callback: (event: string) => void) => {
    mocks.authCallback = callback;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  });
  mocks.unsubscribe.mockReset();
  mocks.preflight.mockReset().mockResolvedValue({ ok: true });
  mocks.routerPush.mockReset();
  mocks.captchaReset.mockReset();
  mocks.captchaSerial = 0;
  mocks.authCallback = null;
});

afterEach(() => {
  act(() => { for (const root of roots.splice(0)) root.unmount(); });
  document.body.innerHTML = "";
});

describe("forgot password recovery", () => {
  it("waits for CAPTCHA, blocks reset mail on preflight failure, then allows retry with a fresh token", async () => {
    mocks.preflight
      .mockResolvedValueOnce({ ok: false, error: "Please try again." })
      .mockResolvedValueOnce({ ok: true });
    await mount(<ForgotPasswordPage />);
    fill("email", "student@example.com");

    expect(buttonNamed("Send reset link").disabled).toBe(true);
    await act(async () => buttonNamed("Verify challenge").click());
    expect(buttonNamed("Send reset link").disabled).toBe(false);
    await submitForm();

    expect(mocks.preflight).toHaveBeenNthCalledWith(1, { turnstileToken: "captcha-1", intent: "forgot-password" });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(mocks.captchaReset).toHaveBeenCalledOnce();
    expect(document.body.textContent).toContain("Please try again.");
    expect(buttonNamed("Send reset link").disabled).toBe(true);

    await act(async () => buttonNamed("Verify challenge").click());
    await submitForm();
    expect(mocks.preflight).toHaveBeenNthCalledWith(2, { turnstileToken: "captcha-2", intent: "forgot-password" });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith("student@example.com", {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: "captcha-2",
    });
    expect(document.body.textContent).toContain("Check your email");
  });

  it("keeps the send action disabled during preflight and sends only once", async () => {
    const pending = deferred<{ ok: true }>();
    mocks.preflight.mockReturnValue(pending.promise);
    await mount(<ForgotPasswordPage />);
    fill("email", "student@example.com");
    await act(async () => buttonNamed("Verify challenge").click());

    await act(async () => buttonNamed("Send reset link").click());
    expect(buttonNamed("Sending…").disabled).toBe(true);
    await act(async () => buttonNamed("Sending…").click());
    expect(mocks.preflight).toHaveBeenCalledOnce();
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();

    await act(async () => pending.resolve({ ok: true }));
    await settleEffects();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledOnce();
  });

  it("resets a consumed CAPTCHA and preserves the email when Supabase cannot send the link", async () => {
    mocks.resetPasswordForEmail
      .mockResolvedValueOnce({ error: new Error("Email service unavailable") })
      .mockResolvedValueOnce({ error: null });
    await mount(<ForgotPasswordPage />);
    fill("email", "student@example.com");
    await act(async () => buttonNamed("Verify challenge").click());
    await submitForm();

    expect(document.body.textContent).toContain("Email service unavailable");
    expect(input("email").value).toBe("student@example.com");
    expect(mocks.captchaReset).toHaveBeenCalledOnce();
    expect(buttonNamed("Send reset link").disabled).toBe(true);

    await act(async () => buttonNamed("Verify challenge").click());
    await submitForm();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("Check your email");
  });
});

describe("reset password recovery", () => {
  it("shows the expired-link state only after current-user validation completes", async () => {
    const pending = deferred<{ data: { user: null }; error: { name: string; message: string } }>();
    mocks.getUser.mockReturnValue(pending.promise);
    await mount(<ResetPasswordPage />);

    expect(document.body.textContent).toContain("Verifying link…");
    await act(async () => pending.resolve({
      data: { user: null },
      error: { name: "AuthSessionMissingError", message: "Auth session missing!" },
    }));
    await settleEffects();

    expect(document.body.textContent).toContain("Link expired");
    expect(document.body.textContent).not.toContain("Set new password");
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce();
  });

  it("treats a non-retryable Auth API error as an invalid reset link", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 400, message: "Invalid JWT" },
    });
    await mount(<ResetPasswordPage />);
    await settleEffects();

    expect(document.body.textContent).toContain("Link expired");
    expect(document.body.textContent).not.toContain("Could not verify your reset link");
  });

  it("keeps verification pending through ordinary auth events, then offers retry for transient Auth errors", async () => {
    const pending = deferred<{ data: { user: null }; error: { name: string; message: string } }>();
    mocks.getUser.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    await mount(<ResetPasswordPage />);

    await act(async () => mocks.authCallback?.("INITIAL_SESSION"));
    expect(document.body.textContent).toContain("Verifying link…");
    expect(document.body.textContent).not.toContain("Link expired");

    await act(async () => pending.resolve({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "Auth server unavailable" },
    }));
    await settleEffects();
    expect(document.body.textContent).toContain("Could not verify your reset link");
    expect(document.body.textContent).not.toContain("Link expired");

    await act(async () => buttonNamed("Try again").click());
    await settleEffects();
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("Set new password");
  });

  it("offers retry when getUser rejects while the page is mounted", async () => {
    mocks.getUser
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    await mount(<ResetPasswordPage />);
    await settleEffects();

    expect(document.body.textContent).toContain("Could not verify your reset link");
    await act(async () => buttonNamed("Try again").click());
    await settleEffects();

    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("Set new password");
  });

  it("offers retry after Auth returns a rate-limit error", async () => {
    mocks.getUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: "AuthApiError", status: 429, message: "Too many requests" },
      })
      .mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    await mount(<ResetPasswordPage />);
    await settleEffects();

    expect(document.body.textContent).toContain("Could not verify your reset link");
    await act(async () => buttonNamed("Try again").click());
    await settleEffects();

    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).toContain("Set new password");
  });

  it("keeps PASSWORD_RECOVERY authorization when an older getUser request later fails", async () => {
    const pending = deferred<{
      data: { user: null };
      error: { name: string; message: string };
    }>();
    mocks.getUser.mockReturnValue(pending.promise);
    await mount(<ResetPasswordPage />);
    expect(document.body.textContent).toContain("Verifying link…");

    await act(async () => mocks.authCallback?.("PASSWORD_RECOVERY"));
    expect(document.body.textContent).toContain("Set new password");

    await act(async () => pending.resolve({
      data: { user: null },
      error: { name: "AuthRetryableFetchError", message: "Auth server unavailable" },
    }));
    await settleEffects();

    expect(document.body.textContent).toContain("Set new password");
    expect(document.body.textContent).not.toContain("Could not verify your reset link");
  });

  it("unlocks reset after a PASSWORD_RECOVERY event and unsubscribes on unmount", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const root = await mount(<ResetPasswordPage />);
    await settleEffects();
    expect(document.body.textContent).toContain("Link expired");

    await act(async () => mocks.authCallback?.("PASSWORD_RECOVERY"));
    expect(document.body.textContent).toContain("Set new password");

    await act(async () => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it("ignores a rejected verification request that settles after unmount", async () => {
    const pending = deferred<{ data: { user: null }; error: null }>();
    mocks.getUser.mockReturnValue(pending.promise);
    const root = await mount(<ResetPasswordPage />);

    await act(async () => root.unmount());
    roots.splice(roots.indexOf(root), 1);
    await act(async () => pending.reject(new Error("network unavailable")));
    await settleEffects();

    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });

  it("validates matching passwords and the eight-character minimum before updating", async () => {
    await mount(<ResetPasswordPage />);
    await settleEffects();

    fill("password", "long-enough");
    fill("confirm", "different");
    await submitForm();
    expect(document.body.textContent).toContain("Passwords do not match.");
    expect(mocks.updateUser).not.toHaveBeenCalled();

    fill("password", "short");
    fill("confirm", "short");
    await submitForm();
    expect(document.body.textContent).toContain("Password must be at least 8 characters.");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("keeps the form available after an update failure and navigates after a successful retry", async () => {
    mocks.updateUser
      .mockResolvedValueOnce({ error: new Error("Could not update password") })
      .mockResolvedValueOnce({ error: null });
    await mount(<ResetPasswordPage />);
    await settleEffects();
    fill("password", "new-password");
    fill("confirm", "new-password");

    await submitForm();
    expect(document.body.textContent).toContain("Could not update password");
    expect(document.body.textContent).toContain("Set new password");
    expect(mocks.routerPush).not.toHaveBeenCalled();

    await submitForm();
    expect(mocks.updateUser).toHaveBeenNthCalledWith(1, { password: "new-password" });
    expect(mocks.updateUser).toHaveBeenCalledTimes(2);
    expect(mocks.routerPush).toHaveBeenCalledExactlyOnceWith("/today");
  });

  it("disables repeated password updates while the request is pending", async () => {
    const pending = deferred<{ error: null }>();
    mocks.updateUser.mockReturnValue(pending.promise);
    await mount(<ResetPasswordPage />);
    await settleEffects();
    fill("password", "new-password");
    fill("confirm", "new-password");

    await act(async () => buttonNamed("Update password").click());
    expect(buttonNamed("Updating…").disabled).toBe(true);
    await act(async () => buttonNamed("Updating…").click());
    expect(mocks.updateUser).toHaveBeenCalledOnce();
    await act(async () => pending.resolve({ error: null }));
    await settleEffects();
    expect(mocks.routerPush).toHaveBeenCalledExactlyOnceWith("/today");
  });
});
