// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "@/hooks/use-mobile";

let width: number;
let container: HTMLDivElement;
let root: Root | undefined;
const listeners = new Set<() => void>();
const subscribe = vi.fn((_type: string, listener: () => void) => listeners.add(listener));
const unsubscribe = vi.fn((_type: string, listener: () => void) => listeners.delete(listener));
// jsdom has no media-query layout engine. Evaluate the query supplied by the
// hook, so a max-width: 767px regression cannot hide behind a fixed breakpoint.
function mediaForQuery(query: string) {
  const range = /^\(width\s*<\s*(\d+(?:\.\d+)?)px\)$/.exec(query);
  const maximum = /^\(max-width:\s*(\d+(?:\.\d+)?)px\)$/.exec(query);
  if (!range && !maximum) throw new Error(`Unsupported test media query: ${query}`);
  return {
    get matches() {
      return range ? width < Number(range[1]) : width <= Number(maximum![1]);
    },
    addEventListener: subscribe,
    removeEventListener: unsubscribe,
  };
}
const matchMedia = vi.fn(mediaForQuery);
function Probe({ onRender }: { onRender?: (mobile: boolean) => void }) {
  const mobile = useIsMobile();
  onRender?.(mobile);
  return <output>{mobile ? "mobile" : "desktop"}</output>;
}
async function resize(next: number) {
  width = next;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: next });
  await act(async () => { for (const listener of listeners) listener(); });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", matchMedia);
  width = 390;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  listeners.clear();
  vi.clearAllMocks();
  matchMedia.mockReset().mockImplementation(mediaForQuery);
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
});

describe("mobile viewport state", () => {
  it("uses the phone viewport on the first client-only render", async () => {
    const renders: boolean[] = [];
    root = createRoot(container);
    await act(async () => root!.render(<Probe onRender={value => renders.push(value)} />));
    expect(renders[0]).toBe(true);
    expect(container.textContent).toBe("mobile");
  });
  it("tracks the 768px boundary in both directions, including fractional widths", async () => {
    await resize(768);
    root = createRoot(container);
    await act(async () => root!.render(<Probe />));
    expect(container.textContent).toBe("desktop");
    await resize(767);
    expect(container.textContent).toBe("mobile");
    await resize(767.5);
    expect(container.textContent).toBe("mobile");
    await resize(1024);
    expect(container.textContent).toBe("desktop");
    await resize(390);
    expect(container.textContent).toBe("mobile");
  });
  it("keeps a stable subscription on rerender and removes it on unmount", async () => {
    root = createRoot(container);
    await act(async () => root!.render(<Probe />));
    expect(listeners.size).toBe(1);
    await act(async () => root!.render(<Probe />));
    expect(subscribe).toHaveBeenCalledTimes(1);
    await act(async () => root!.unmount());
    root = undefined;
    expect(listeners.size).toBe(0);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it("renders a stable server fallback without consulting browser media", () => {
    matchMedia.mockImplementationOnce(() => { throw new Error("Browser API during SSR"); });
    expect(renderToString(<Probe />)).toBe("<output>desktop</output>");
    expect(matchMedia).not.toHaveBeenCalled();
    matchMedia.mockReset().mockImplementation(mediaForQuery);
  });
  it("hydrates the server fallback before adopting the mobile viewport", async () => {
    container.innerHTML = renderToString(<Probe />);
    const errors: unknown[] = [];
    const renders: boolean[] = [];
    await act(async () => {
      root = hydrateRoot(container, <Probe onRender={value => renders.push(value)} />, {
        onRecoverableError: error => errors.push(error),
      });
    });
    expect(renders[0]).toBe(false);
    expect(container.textContent).toBe("mobile");
    expect(errors).toEqual([]);
  });
});
