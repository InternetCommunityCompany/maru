import { defineProxy } from "comctx";
import type { SwapEvent } from "@/template-engine/types";
import { CHANNEL_NAMESPACE } from "./namespace";

class EventChannel {
  constructor(private handler: (event: SwapEvent) => void = () => {}) {}
  async emit(event: SwapEvent): Promise<void> {
    this.handler(event);
  }
}

/**
 * The comctx provider/injector pair for the maru event channel.
 *
 * - `provideEventChannel(adapter, handler)` is called once on the consuming
 *   side (typically the background) and runs `handler` for every event sent
 *   by injectors. Returns the underlying `EventChannel` instance.
 * - `injectEventChannel(adapter)` is called on each producer side (typically
 *   the MAIN-world content script) and returns a proxy whose `emit(event)`
 *   ferries events back to the provider.
 *
 * Heartbeat is disabled — emissions are fire-and-forget and we don't want
 * every tab pinging the service worker every 300 ms. Callers must drop
 * returned promises to keep the dapp non-blocked
 * (`void channel.emit(e).catch(() => {})`).
 */
export const [provideEventChannel, injectEventChannel] = defineProxy(
  (handler: (event: SwapEvent) => void = () => {}) =>
    new EventChannel(handler),
  { namespace: CHANNEL_NAMESPACE, heartbeatCheck: false },
);
