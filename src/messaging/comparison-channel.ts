import type { ComparisonSnapshot } from "@/comparison/types";

/**
 * Port name the overlay content script opens to the background to receive
 * `ComparisonSnapshot`s. Matched in the background's `runtime.onConnect`
 * listener.
 */
export const COMPARISON_PORT_NAME = "maru:comparison";

/**
 * Post a {@link ComparisonSnapshot} from the background to an overlay port.
 *
 * The port is private to the extension — `runtime.connect` traffic doesn't
 * cross JS contexts beyond the connecting tab — so no envelope tag is needed
 * and the snapshot travels raw.
 *
 * Swallows `postMessage` failures: the port can disconnect between the last
 * `onDisconnect` check and this call. The owning subscription is torn down
 * by the disconnect listener, so there is nothing to surface here.
 */
export const emitComparison = (
  port: Browser.runtime.Port,
  snapshot: ComparisonSnapshot,
): void => {
  try {
    port.postMessage(snapshot);
  } catch {
    // Port disconnected mid-call — onDisconnect will run and unsubscribe.
  }
};

/**
 * Subscribe `handler` to {@link ComparisonSnapshot}s arriving on a
 * `runtime.Port` (overlay side). The port is private to the extension, so
 * the cast is sound. The listener dies with the port.
 */
export const onComparison = (
  port: Browser.runtime.Port,
  handler: (snapshot: ComparisonSnapshot) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    handler(raw as ComparisonSnapshot);
  });
};
