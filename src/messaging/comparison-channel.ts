import type { ComparisonSnapshot } from "@/comparison/types";

export const COMPARISON_PORT_NAME = "maru:comparison";

/**
 * Post a `ComparisonSnapshot` to an overlay port. Swallows `postMessage`
 * failures — if the port dropped between the last `onDisconnect` check and
 * this call, the disconnect listener will tear the subscription down.
 */
export const emitComparison = (
  port: Browser.runtime.Port,
  snapshot: ComparisonSnapshot,
): void => {
  try {
    port.postMessage(snapshot);
  } catch {
    /* port broken; onDisconnect will clean up */
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
