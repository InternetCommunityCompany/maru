/**
 * The six discrete animation states the Maru mascot can render. Each maps 1:1
 * to a webp sprite in {@link MARU_STATE_SOURCES}.
 *
 * @remarks
 * - `idle`          — calm breathing, gentle bounce
 * - `searching`     — head swivels, looking for something
 * - `thumbs-up`     — approval ("good rate!")
 * - `yawning`       — sleepy / waiting / paused
 * - `finding-money` — signature "aha!" moment when a better rate is found
 * - `dancing`       — celebration / success
 */
export type MaruState =
  | "idle"
  | "searching"
  | "thumbs-up"
  | "yawning"
  | "finding-money"
  | "dancing";

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
