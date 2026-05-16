import type { QuoteUpdate } from "@/arbiter/types";

const ENVELOPE_TAG = "quote" as const;

export const QUOTE_PORT_NAME = "maru:quote";

/**
 * Window envelope between the MAIN-world script and the ISOLATED relay. The
 * tag filters out foreign `postMessage` traffic (dapp, other extensions).
 * Once past the relay, the port carries the raw {@link QuoteUpdate}.
 */
export type QuoteEnvelope = {
  readonly __maru: typeof ENVELOPE_TAG;
  readonly update: QuoteUpdate;
};

export const isQuoteEnvelope = (data: unknown): data is QuoteEnvelope =>
  typeof data === "object" &&
  data !== null &&
  (data as { __maru?: unknown }).__maru === ENVELOPE_TAG;

/**
 * Post a `QuoteUpdate` from the MAIN-world content script. Fire-and-forget —
 * if the relay hasn't wired its port yet, the message is dropped and the
 * next arbiter emission retries.
 */
export const emitQuote = (update: QuoteUpdate): void => {
  const envelope: QuoteEnvelope = { __maru: ENVELOPE_TAG, update };
  window.postMessage(envelope, window.location.origin);
};

/** Background-side handler. The relay strips the envelope before forwarding. */
export const onQuote = (
  port: Browser.runtime.Port,
  handler: (update: QuoteUpdate) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    handler(raw as QuoteUpdate);
  });
};
