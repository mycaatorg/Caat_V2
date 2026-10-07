/** Shared phone-layout helpers for the mobile Playwright projects. */
import type { Page } from "@playwright/test";

/** Elements that push the page wider than the screen (empty when it fits). */
export async function sidewaysOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth + 1) return [];
    return [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1 && el.offsetParent !== null)
      .filter((el, _, all) => !all.some((other) => other !== el && other.contains(el)))
      .slice(0, 5)
      .map((el) => {
        const classes = [...el.classList].slice(0, 4).join(".");
        return `${el.tagName.toLowerCase()}${classes ? `.${classes}` : ""} (${Math.round(el.getBoundingClientRect().right)}px of ${doc.clientWidth}px)`;
      });
  });
}
