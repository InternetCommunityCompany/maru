import type { DebugEvent } from "@/debug/debug-event";

const ENVELOPE_TAG = "debug" as const;

export const DEBUG_PORT_NAME = "maru:debug";

/**
 * Window envelope between the MAIN-world dev relay and the ISOLATED relay.
 * Mirrors {@link QuoteEnvelope} so foreign `postMessage` traffic (dapp,
 * other extensions) is filtered out. Once past the relay, the port carries
 * the raw {@link DebugEvent}.
 */
export type DebugEnvelope = {
  readonly __maru: typeof ENVELOPE_TAG;
  readonly event: DebugEvent;
};

export const isDebugEnvelope = (data: unknown): data is DebugEnvelope =>
  typeof data === "object" &&
  data !== null &&
  (data as { __maru?: unknown }).__maru === ENVELOPE_TAG;

/**
 * Post a `DebugEvent` from the MAIN-world dev relay. Fire-and-forget — if the
 * relay hasn't wired its port yet, the message is dropped and the next event
 * retries.
 */
export const emitDebug = (event: DebugEvent): void => {
  const envelope: DebugEnvelope = { __maru: ENVELOPE_TAG, event };
  window.postMessage(envelope, window.location.origin);
};

/** Background-side handler. The relay strips the envelope before forwarding. */
export const onDebug = (
  port: Browser.runtime.Port,
  handler: (event: DebugEvent) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    handler(raw as DebugEvent);
  });
};
