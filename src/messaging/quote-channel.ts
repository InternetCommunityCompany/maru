import type { QuoteUpdate } from "@/arbiter/types";

const ENVELOPE_TAG = "quote" as const;

/**
 * Port name the ISOLATED content-script relay opens to the background to
 * forward MAIN-world `QuoteUpdate`s. Matched in the background's
 * `runtime.onConnect` listener.
 */
export const QUOTE_PORT_NAME = "maru:quote";

/**
 * Window envelope used between the MAIN-world script and the ISOLATED-world
 * relay. The `window` event loop is shared with foreign scripts (the dapp
 * and other extensions in MAIN), so a tag is required to filter our own
 * traffic. Port traffic past the relay is private and carries the raw
 * {@link QuoteUpdate}.
 */
export type QuoteEnvelope = {
  readonly __maru: typeof ENVELOPE_TAG;
  readonly update: QuoteUpdate;
};

/** Type guard for {@link QuoteEnvelope}. */
export const isQuoteEnvelope = (data: unknown): data is QuoteEnvelope =>
  typeof data === "object" &&
  data !== null &&
  (data as { __maru?: unknown }).__maru === ENVELOPE_TAG;

/**
 * Emit a {@link QuoteUpdate} from the MAIN-world content script. The message
 * is delivered via `window.postMessage` with the document's origin so it
 * reaches the ISOLATED-world relay and is not visible to embedders.
 *
 * Fire-and-forget — if the relay hasn't (re-)wired its port yet, the message
 * is dropped. The arbiter emits often enough that the next update lands once
 * the port is back.
 */
export const emitQuote = (update: QuoteUpdate): void => {
  const envelope: QuoteEnvelope = { __maru: ENVELOPE_TAG, update };
  window.postMessage(envelope, window.location.origin);
};

/**
 * Subscribe `handler` to {@link QuoteUpdate}s arriving on a background-side
 * `runtime.Port`. The port carries raw updates — the relay strips the window
 * envelope before forwarding — so the cast is sound. The listener dies with
 * the port; the caller does not need to detach manually.
 */
export const onQuote = (
  port: Browser.runtime.Port,
  handler: (update: QuoteUpdate) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    handler(raw as QuoteUpdate);
  });
};
