import { defineProxy } from "comctx";
import type { QuoteUpdate } from "@/arbiter/types";
import { QUOTE_CHANNEL_NAMESPACE } from "./namespace";

class QuoteChannel {
  constructor(private handler: (update: QuoteUpdate) => void = () => {}) {}
  async emit(update: QuoteUpdate): Promise<void> {
    this.handler(update);
  }
}

/**
 * The comctx provider/injector pair for the maru quote channel.
 *
 * - `provideQuoteChannel(adapter, handler)` is called once on the consuming
 *   side (typically the background) and runs `handler` for every `QuoteUpdate`
 *   sent by injectors. Returns the underlying `QuoteChannel` instance.
 * - `injectQuoteChannel(adapter)` is called on each producer side (typically
 *   the MAIN-world content script) and returns a proxy whose `emit(update)`
 *   ferries updates back to the provider.
 *
 * The channel is a thin transport for the arbiter's `QuoteUpdate` — the union
 * is defined in `src/arbiter/types.ts` and imported here per the project rule
 * that cross-module unions live with the consumer that combines them; the
 * arbiter is the producer and union owner.
 *
 * Heartbeat is enabled — over a long-lived `runtime.Port`, the heartbeat is
 * the canonical signal that the service worker is still alive. If the SW
 * gets evicted while a quote `emit` is in flight, the heartbeat fails and
 * the pending RPC rejects within `heartbeatTimeout` instead of hanging
 * forever. Callers still drop returned promises so a dead transport doesn't
 * block the dapp (`void channel.emit(u).catch(() => {})`).
 */
export const [provideQuoteChannel, injectQuoteChannel] = defineProxy(
  (handler: (update: QuoteUpdate) => void = () => {}) =>
    new QuoteChannel(handler),
  { namespace: QUOTE_CHANNEL_NAMESPACE, heartbeatCheck: true },
);
