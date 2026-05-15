import type { ComparisonSnapshot } from "@/comparison/types";

const TAG = "comparison" as const;

/**
 * Port name the overlay content script opens to the background to receive
 * `ComparisonSnapshot`s. Matched in the background's `runtime.onConnect`
 * listener.
 */
export const COMPARISON_PORT_NAME = "maru:comparison";

/**
 * Wire envelope on the comparison channel. Tagged so consumers can cheaply
 * filter foreign traffic on the port.
 */
export type ComparisonMessage = {
  readonly __maru: typeof TAG;
  readonly snapshot: ComparisonSnapshot;
};

/** Type guard for {@link ComparisonMessage}. */
export const isComparisonMessage = (data: unknown): data is ComparisonMessage =>
  typeof data === "object" &&
  data !== null &&
  (data as { __maru?: unknown }).__maru === TAG;

/**
 * Post a {@link ComparisonSnapshot} from the background to an overlay port.
 *
 * Swallows `postMessage` failures: the port can disconnect between the last
 * `onDisconnect` check and this call. The owning subscription is torn down
 * by the disconnect listener, so there is nothing to surface here.
 */
export const emitComparison = (
  port: Browser.runtime.Port,
  snapshot: ComparisonSnapshot,
): void => {
  const message: ComparisonMessage = { __maru: TAG, snapshot };
  try {
    port.postMessage(message);
  } catch {
    // Port disconnected mid-call — onDisconnect will run and unsubscribe.
  }
};

/**
 * Subscribe `handler` to {@link ComparisonSnapshot}s arriving on a
 * `runtime.Port` (overlay side). Non-comparison traffic is dropped silently.
 * The listener dies with the port.
 */
export const onComparison = (
  port: Browser.runtime.Port,
  handler: (snapshot: ComparisonSnapshot) => void,
): void => {
  port.onMessage.addListener((raw: unknown) => {
    if (isComparisonMessage(raw)) handler(raw.snapshot);
  });
};
