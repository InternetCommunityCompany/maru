import type { ComparisonSnapshot } from "@/comparison/types";

export const COMPARISON_PORT_NAME = "maru:comparison";

/**
 * Post a `ComparisonSnapshot` to an overlay port. A throw here usually means
 * the port dropped between the last `onDisconnect` check and this call —
 * `onDisconnect` will tear the subscription down. We log so non-port errors
 * (e.g. an unserializable payload silently breaking the wire) aren't invisible.
 */
export const emitComparison = (
  port: Browser.runtime.Port,
  snapshot: ComparisonSnapshot,
): void => {
  try {
    port.postMessage(snapshot);
  } catch (err) {
    console.warn("[maru] emitComparison failed", err);
  }
};

/** Port is private to the extension, so the cast is sound. */
export const onComparison = (
  port: Browser.runtime.Port,
  handler: (snapshot: ComparisonSnapshot) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    handler(raw as ComparisonSnapshot);
  });
};
