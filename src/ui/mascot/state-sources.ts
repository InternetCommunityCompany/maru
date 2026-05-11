import type { MaruState } from "./types";

/**
 * Map of mascot state → fully-resolved sprite URL.
 *
 * @remarks
 * Sprites live in `public/maru/` so they're emitted at fixed
 * `chrome-extension://<id>/maru/*.webp` paths and never bundled
 * into a JS chunk. `browser.runtime.getURL()` produces the absolute
 * URL — required because content-script `<img>` tags resolve relative
 * URLs against the host page origin, not the extension.
 */
export const MARU_STATE_SOURCES: Record<MaruState, string> = {
  idle: browser.runtime.getURL("/maru/idle.webp"),
  searching: browser.runtime.getURL("/maru/searching.webp"),
  "thumbs-up": browser.runtime.getURL("/maru/thumbs-up.webp"),
  yawning: browser.runtime.getURL("/maru/yawning.webp"),
  "finding-money": browser.runtime.getURL("/maru/finding-money.webp"),
  dancing: browser.runtime.getURL("/maru/dancing.webp"),
};
