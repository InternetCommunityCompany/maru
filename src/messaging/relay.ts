import { isChannelMessage } from "./is-channel-message";
import { isQuoteUpdateMessage } from "./quote-update-message";

/**
 * Bridges window-postMessage traffic (MAIN-world) and runtime messaging
 * (background) inside the ISOLATED content script.
 *
 * Quote updates are parsed here so the background can receive them through
 * `browser.runtime.onMessage` with `sender.tab.id`. The older comctx channel
 * bridge remains for any non-quote channel traffic.
 *
 * Idempotent for our purposes — call once from `content.ts` at
 * `document_start`. Multiple calls would attach duplicate listeners and
 * double-deliver messages.
 */
export function startContentRelay(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (isQuoteUpdateMessage(event.data)) {
      browser.runtime.sendMessage(event.data).catch(() => {
        // background may be unavailable — drop silently
      });
      return;
    }
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
