import { defineProxy } from "comctx";
import type { ComparisonSnapshot } from "@/comparison/types";
import { COMPARISON_CHANNEL_NAMESPACE } from "./namespace";

class ComparisonChannel {
  constructor(
    private handler: (snapshot: ComparisonSnapshot) => void = () => {},
  ) {}
  async emit(snapshot: ComparisonSnapshot): Promise<void> {
    this.handler(snapshot);
  }
}

/**
 * The comctx provider/injector pair for the maru comparison channel.
 *
 * Mirrors `provideQuoteChannel` / `injectQuoteChannel` but carries
 * `ComparisonSnapshot` from the background orchestrator to any consumer
 * (overlay, dev console, …). The producer is the orchestrator
 * (`createComparisonOrchestrator`); consumers wire their own
 * `provideComparisonChannel(adapter, handler)` calls in their own surface.
 *
 * - `provideComparisonChannel(adapter, handler)` is called on each consumer
 *   side and runs `handler` for every `ComparisonSnapshot` emitted by the
 *   orchestrator. Returns the underlying `ComparisonChannel` instance.
 * - `injectComparisonChannel(adapter)` is called on the producer side
 *   (background) and returns a proxy whose `emit(snapshot)` ferries snapshots
 *   to consumers.
 *
 * Heartbeat is enabled — over a long-lived `runtime.Port`, the heartbeat is
 * the canonical signal that the consumer is still alive. If the overlay
 * content script unloads mid-emit, the heartbeat fails and the pending RPC
 * rejects within `heartbeatTimeout` instead of hanging the orchestrator's
 * snapshot fanout. Callers still drop the returned promise
 * (`void channel.emit(s).catch(() => {})`) so a slow consumer doesn't stall
 * the producer.
 */
export const [provideComparisonChannel, injectComparisonChannel] = defineProxy(
  (handler: (snapshot: ComparisonSnapshot) => void = () => {}) =>
    new ComparisonChannel(handler),
  { namespace: COMPARISON_CHANNEL_NAMESPACE, heartbeatCheck: true },
);
