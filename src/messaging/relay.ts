import { isChannelMessage } from "./is-channel-message";

/**
 * Bridges window-postMessage traffic (MAIN-world) and runtime messaging
 * (background) inside the ISOLATED content script.
 *
 * This is the second hop of the comctx connection: the channel logically
 * spans MAIN ↔ BACKGROUND, with this function blindly forwarding messages
 * (filtered by `isChannelMessage`) in both directions. It does not parse or
 * inspect payloads.
 *
 * Idempotent for our purposes — call once from `content.ts` at
 * `document_start`. Multiple calls would attach duplicate listeners and
 * double-deliver messages.
 */
export function startContentRelay(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!isChannelMessage(event.data)) return;
    browser.runtime.sendMessage(event.data).catch(() => {
      // background may be unavailable — drop silently
    });
  });

  browser.runtime.onMessage.addListener((message) => {
    if (!isChannelMessage(message)) return;
    window.postMessage(message, window.location.origin);
  });
}
