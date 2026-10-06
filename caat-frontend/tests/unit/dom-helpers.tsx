// Minimal DOM helpers for component tests that mount with react-dom directly
// (the repo intentionally has no @testing-library/dom peer installed).
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const roots: Root[] = [];

export async function mountComponent(element: React.ReactElement) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(element));
  return container;
}

export function unmountAll() {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
}

export async function flush() {
  await act(async () => {});
}

const label = (el: Element) => (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
const matches = (text: string, name: string | RegExp) => (typeof name === "string" ? text === name : name.test(text));

export function queryAll(selector: string, name: string | RegExp, scope: ParentNode = document): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(selector)].filter((el) => matches(label(el), name));
}
export function query(selector: string, name: string | RegExp, scope: ParentNode = document): HTMLElement | null {
  return queryAll(selector, name, scope)[0] ?? null;
}
export function get<T extends HTMLElement = HTMLElement>(selector: string, name: string | RegExp, scope: ParentNode = document): T {
  const el = query(selector, name, scope);
  if (!el) throw new Error(`Missing ${selector} named ${String(name)}`);
  return el as T;
}
export const button = (name: string | RegExp, scope?: ParentNode) => get<HTMLButtonElement>("button", name, scope);
export const queryButton = (name: string | RegExp, scope?: ParentNode) => query("button", name, scope) as HTMLButtonElement | null;
export const link = (name: string | RegExp, scope?: ParentNode) => get<HTMLAnchorElement>("a", name, scope);
export const queryLink = (name: string | RegExp, scope?: ParentNode) => query("a", name, scope) as HTMLAnchorElement | null;
export function hasText(text: string | RegExp, scope: ParentNode = document): boolean {
  return [...scope.querySelectorAll("*")].some((el) => el.children.length === 0 && matches(label(el), text));
}

export async function click(el: HTMLElement) {
  await act(async () => el.click());
}

/** Set a controlled field's value the way a user edit does, so React sees it. */
export async function change(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
  await act(async () => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
