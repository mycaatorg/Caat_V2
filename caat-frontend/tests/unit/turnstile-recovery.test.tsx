// @vitest-environment jsdom
import React, { act, useEffect, useImperativeHandle } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnstileProps } from "@marsidev/react-turnstile";

const provider = vi.hoisted(() => ({
  props: {} as TurnstileProps,
  reset: vi.fn(),
  preflight: vi.fn(),
  signIn: vi.fn(),
  push: vi.fn(),
}));

// The external challenge is controlled; CAAT's widget and actual login form stay real.
vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: React.forwardRef(function Challenge(props: TurnstileProps, ref) {
    useEffect(() => { provider.props = props; });
    useImperativeHandle(ref, () => ({ reset: provider.reset }));
    return <div aria-label="Security challenge" />;
  }),
}));
vi.mock("@/lib/supabase/client", () => ({ supabase: { auth: { signInWithPassword: provider.signIn } } }));
vi.mock("@/app/auth-actions", () => ({ preflightAuthAction: provider.preflight }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: provider.push, refresh: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));

// Site key is read at module evaluation by the real login form.
vi.hoisted(() => { process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key"; });
import { LoginForm } from "@/components/login-form";
import { TurnstileWidget } from "@/components/TurnstileWidget";

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  provider.reset.mockReset();
  provider.preflight.mockReset().mockResolvedValue({ ok: true });
  provider.signIn.mockReset().mockResolvedValue({ error: null });
  provider.push.mockReset();
});
const roots: Root[] = [];
function render(element: React.ReactElement) {
  const container = document.createElement("div"); document.body.appendChild(container);
  const root = createRoot(container); roots.push(root);
  act(() => root.render(element));
  return { container };
}
function button(name: string) {
  const found = [...document.querySelectorAll("button")].find(b => b.textContent?.trim().startsWith(name));
  if (!found) throw new Error(`Missing button: ${name}`);
  return found;
}
function field(name: string) { return document.querySelector<HTMLInputElement>(`#${name}`)!; }
function click(name: string) { act(() => button(name).click()); }
function notice(role: string) { return document.querySelector(`[role="${role}"]`); }
function fill(name: string, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field(name), value);
    field(name).dispatchEvent(new Event("input", { bubbles: true }));
  });
}
afterEach(() => {
  act(() => roots.splice(0).forEach(root => root.unmount()));
  document.body.innerHTML = ""; vi.useRealTimers(); vi.unstubAllEnvs();
});

function login() {
  render(<LoginForm />);
  fill("email", "student@example.com");
  fill("password", "private-password");
}
function verify(token = "fresh-token") { act(() => provider.props.onSuccess?.(token)); }

// Missing failure handlers must invalidate an already issued token, not leave submit enabled.
describe("security-check recovery", () => {
  it("explains loading, blocks submission, and removes the notice once verified", () => {
    login();
    expect(notice("status")?.textContent).toMatch(/checking/i);
    expect(button("Sign in").disabled).toBe(true);
    verify();
    expect(button("Sign in").disabled).toBe(false);
    expect(notice("status")).toBeNull();
  });

  it.each(["onError", "onTimeout", "onExpire"] as const)("%s invalidates the token, preserves fields, and retries without submitting", async (event) => {
    login();
    act(() => provider.props.onWidgetLoad?.("widget-1"));
    verify("old-token");
    act(() => provider.props[event]?.("300030"));
    expect(button("Sign in").disabled).toBe(true);
    expect(notice("alert")?.textContent).toMatch(/security check/i);
    expect(notice("alert")?.textContent).not.toContain("300030");
    click("Retry security check");
    expect(provider.reset).toHaveBeenCalledOnce();
    expect(provider.preflight).not.toHaveBeenCalled();
    expect(field("email").value).toBe("student@example.com");
    expect(field("password").value).toBe("private-password");
    expect(button("Sign in").disabled).toBe(true);
    verify();
    await act(async () => button("Sign in").click());
    expect(provider.preflight).toHaveBeenCalledWith({ turnstileToken: "fresh-token", intent: "login" });
    expect(provider.signIn).toHaveBeenCalledWith({ email: "student@example.com", password: "private-password", options: { captchaToken: "fresh-token" } });
    expect(provider.push).toHaveBeenCalledWith("/today");
  });

  it("offers reload when the provider script fails before the widget exists", () => {
    login();
    act(() => provider.props.scriptOptions?.onError?.());
    expect(notice("alert")?.textContent).toMatch(/could not load/i);
    expect([...document.querySelectorAll("a")].find(a => a.textContent === "Reload page")?.getAttribute("href")).toBe("");
    expect(button("Sign in").disabled).toBe(true);
  });

  it("offers recovery when a blocked script never calls back", () => {
    vi.useFakeTimers();
    login();
    act(() => vi.advanceTimersByTime(30_000));
    expect(notice("alert")?.textContent).toMatch(/longer than expected/i);
    expect([...document.querySelectorAll("a")].some(a => a.textContent === "Reload page")).toBe(true);
    expect(button("Sign in").disabled).toBe(true);
  });

  it("explains unsupported browsers and keeps authentication blocked", () => {
    login(); verify();
    act(() => provider.props.onUnsupported?.());
    expect(notice("alert")?.textContent).toMatch(/another browser|update.*browser/i);
    expect(button("Sign in").disabled).toBe(true);
  });

  it("restores loading feedback after auth rejects a consumed token", async () => {
    provider.preflight.mockResolvedValueOnce({ ok: false, error: "Please try again shortly." });
    login(); act(() => provider.props.onWidgetLoad?.("widget-1")); verify();
    await act(async () => button("Sign in").click());
    expect(notice("status")?.textContent).toMatch(/checking/i);
    expect(button("Sign in").disabled).toBe(true);
    expect(provider.signIn).not.toHaveBeenCalled();
    verify("replacement-token");
    expect(button("Sign in").disabled).toBe(false);
  });

  it("does not show a challenge or recovery notices when no site key is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    const view = render(<TurnstileWidget onVerify={vi.fn()} onExpire={vi.fn()} />);
    expect(view.container.innerHTML).toBe("");
    vi.unstubAllEnvs();
  });
});
