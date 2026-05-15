import type { QuoteUpdate } from "@/arbiter/types";

const TAG = "quote" as const;

/**
 * Port name the ISOLATED content-script relay opens to the background to
 * forward MAIN-world `QuoteUpdate`s. Matched in the background's
 * `runtime.onConnect` listener.
 */
export const QUOTE_PORT_NAME = "maru:quote";

/**
 * Wire envelope on the quote channel. Tagged so the relay and background can
 * cheaply filter foreign traffic (other extensions, page scripts) without
 * pulling in an RPC framework.
 */
export type QuoteMessage = {
  readonly __maru: typeof TAG;
  readonly update: QuoteUpdate;
};

/** Type guard for {@link QuoteMessage}. */
export const isQuoteMessage = (data: unknown): data is QuoteMessage =>
  typeof data === "object" &&
  data !== null &&
  (data as { __maru?: unknown }).__maru === TAG;

/**
 * Post a {@link QuoteUpdate} from the MAIN-world content script. The message
 * is delivered via `window.postMessage` with the document's origin so it
 * reaches the ISOLATED-world relay and is not visible to embedders.
 *
 * Fire-and-forget — if the relay hasn't (re-)wired its port yet, the message
 * is dropped. The arbiter emits often enough that the next update lands once
 * the port is back.
 */
export const emitQuote = (update: QuoteUpdate): void => {
  const message: QuoteMessage = { __maru: TAG, update };
  window.postMessage(message, window.location.origin);
};

/**
 * Subscribe `handler` to {@link QuoteUpdate}s arriving on a background-side
 * `runtime.Port`. Non-quote traffic on the port is dropped silently. The
 * listener dies with the port; the caller does not need to detach manually.
 */
export const onQuote = (
  port: Browser.runtime.Port,
  handler: (update: QuoteUpdate) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    if (isQuoteMessage(raw)) handler(raw.update);
  });
};
