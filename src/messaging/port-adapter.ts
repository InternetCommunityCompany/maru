import type { Adapter, Message, OnMessage, SendMessage } from "comctx";
import { isChannelMessage } from "./is-channel-message";

/**
 * comctx adapter that wraps a single long-lived `browser.runtime.Port`.
 *
 * One adapter, one port. The port is implicitly tab-scoped (the sender's tab
 * is reachable via `port.sender.tab` on the background side), so we don't
 * thread a `tabId` through `meta` like the old `BackgroundAdapter` did —
 * routing is whichever port the caller wired the channel onto.
 *
 * Send failures (port disconnected mid-call) are swallowed: there is no
 * retry here, since reconnection lives in the content-side wrapper that owns
 * the port's lifecycle. Inbound messages that don't match a maru channel
 * namespace are dropped by `isChannelMessage` before reaching comctx.
 */
export class PortAdapter implements Adapter {
  constructor(private readonly port: Browser.runtime.Port) {}
  sendMessage: SendMessage = (message) => {
    try {
      this.port.postMessage(message);
    } catch {
      // Port disconnected — drop silently. The owning wrapper will reconnect
      // (content side) or release this adapter on `onDisconnect` (background).
    }
  };
  onMessage: OnMessage = (callback) => {
    const handler = (raw: unknown) => {
      if (!isChannelMessage(raw)) return;
      callback(raw as Message);
    };
    this.port.onMessage.addListener(handler);
    return () => this.port.onMessage.removeListener(handler);
  };
}
