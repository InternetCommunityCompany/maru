import { connectWithReconnect, type Reconnector } from "./connect-with-reconnect";
import { isChannelMessage } from "./is-channel-message";

/**
 * Wire namespace of the port the ISOLATED-world relay opens to the background.
 *
 * Background-side `runtime.onConnect` matches on this name to wire
 * `QuoteChannel` for the connecting tab. Exported so the background
 * entrypoint can refer to the same constant.
 */
export const QUOTE_RELAY_PORT_NAME = "maru:quote";

/**
 * Bridges window-postMessage traffic (MAIN-world) and a long-lived
 * `runtime.Port` (background) inside the ISOLATED content script.
 *
 * This is the second hop of the comctx connection: the channel logically
 * spans MAIN ↔ BACKGROUND, with this function blindly forwarding messages
 * (filtered by `isChannelMessage`) in both directions. It does not parse or
 * inspect payloads.
 *
 * The port is reconnected automatically when the service worker restarts,
 * via {@link connectWithReconnect}. The window-message listener is attached
 * once at startup and forwards through whichever port is currently active.
 *
 * Idempotent for our purposes — call once from `content.ts` at
 * `document_start`. Multiple calls would attach duplicate listeners and
 * double-deliver messages. Returns a {@link Reconnector} so callers can stop
 * the loop on `ctx.onInvalidated`.
 */
export function startContentRelay(): Reconnector {
  let activePort: Browser.runtime.Port | null = null;

  const reconnector = connectWithReconnect(QUOTE_RELAY_PORT_NAME, (port) => {
    activePort = port;
    port.onMessage.addListener((message: unknown) => {
      if (!isChannelMessage(message)) return;
      window.postMessage(message, window.location.origin);
    });
    port.onDisconnect.addListener(() => {
      if (activePort === port) activePort = null;
    });
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!isChannelMessage(event.data)) return;
    const port = activePort;
    if (port === null) return; // dropped while reconnecting — caller retries
    try {
      port.postMessage(event.data);
    } catch {
      // Port broken between the null check and postMessage —
      // onDisconnect will fire and reconnect.
    }
  });

  return reconnector;
}
