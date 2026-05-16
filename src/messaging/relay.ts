import { connectWithReconnect, type Reconnector } from "./connect-with-reconnect";
import { QUOTE_PORT_NAME, isQuoteEnvelope } from "./quote-channel";

/**
 * One-way MAIN → background bridge inside the ISOLATED content script.
 * Filters window traffic by {@link isQuoteEnvelope}, strips the envelope,
 * and forwards onto a reconnecting port. Call once at `document_start` —
 * multiple calls double-deliver.
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
