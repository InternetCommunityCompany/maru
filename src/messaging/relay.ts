import { connectWithReconnect, type Reconnector } from "./connect-with-reconnect";
import { QUOTE_PORT_NAME, isQuoteEnvelope } from "./quote-channel";

/**
 * Bridges window-postMessage traffic (MAIN-world) to a long-lived
 * `runtime.Port` to the background inside the ISOLATED content script.
 *
 * The quote channel is strictly one-way MAIN → background, so this relay
 * only forwards window → port. Page scripts and other extensions
 * `postMessage`-ing on the same window are filtered out by
 * {@link isQuoteEnvelope}; the envelope is stripped before the message is
 * forwarded onto the port so background-side consumers see a raw
 * `QuoteUpdate`.
 *
 * The port is reconnected automatically when the service worker restarts via
 * {@link connectWithReconnect}. The window-message listener is attached once
 * at startup and posts through whichever port is currently active.
 *
 * Call once from `content.ts` at `document_start`; multiple calls would
 * double-deliver. Returns a {@link Reconnector} so callers can stop the loop
 * on `ctx.onInvalidated`.
 */
export function startContentRelay(): Reconnector {
  let activePort: Browser.runtime.Port | null = null;

  const reconnector = connectWithReconnect(QUOTE_PORT_NAME, (port) => {
    activePort = port;
    port.onDisconnect.addListener(() => {
      if (activePort === port) activePort = null;
    });
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!isQuoteEnvelope(event.data)) return;
    const port = activePort;
    if (port === null) return; // dropped while reconnecting — next emission retries
    try {
      port.postMessage(event.data.update);
    } catch {
      // Port broke between the null check and postMessage —
      // onDisconnect will fire and the reconnect loop will re-establish.
    }
  });

  return reconnector;
}
