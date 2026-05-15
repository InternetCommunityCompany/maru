import { defineProxy } from "comctx";
import type { QuoteUpdate } from "@/arbiter/types";
import { CHANNEL_NAMESPACE } from "./namespace";

class EventChannel {
  constructor(private handler: (update: QuoteUpdate) => void = () => {}) {}
  async emit(update: QuoteUpdate): Promise<void> {
    this.handler(update);
  }
}

/**
 * The comctx provider/injector pair for the maru event channel.
 *
 * - `provideEventChannel(adapter, handler)` is called once on the consuming
 *   side (typically the background) and runs `handler` for every `QuoteUpdate`
 *   sent by injectors. Returns the underlying `EventChannel` instance.
 * - `injectEventChannel(adapter)` is called on each producer side (typically
 *   the MAIN-world content script) and returns a proxy whose `emit(update)`
 *   ferries updates back to the provider.
 *
 * The channel is a thin transport for the arbiter's `QuoteUpdate` — the union
 * is defined in `src/arbiter/types.ts` and imported here per the project rule
 * that cross-module unions live with the consumer that combines them; the
 * arbiter is the producer and union owner.
 *
 * Heartbeat is disabled — emissions are fire-and-forget and we don't want
 * every tab pinging the service worker every 300 ms. Callers must drop
 * returned promises to keep the dapp non-blocked
 * (`void channel.emit(u).catch(() => {})`).
 */
export const [provideEventChannel, injectEventChannel] = defineProxy(
  (handler: (update: QuoteUpdate) => void = () => {}) =>
    new EventChannel(handler),
  { namespace: CHANNEL_NAMESPACE, heartbeatCheck: false },
);
