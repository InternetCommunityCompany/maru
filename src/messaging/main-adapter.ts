import type { Adapter, OnMessage, SendMessage } from "comctx";
import { isChannelMessage } from "./is-channel-message";

/**
 * comctx adapter for the MAIN-world content script.
 *
 * Sends via `window.postMessage` (received by the ISOLATED relay, which
 * forwards to the background) and listens to `window` messages filtered by
 * `isChannelMessage`. Target origin is locked to `window.location.origin` so
 * we don't leak messages to embedders.
 */
export class MainAdapter implements Adapter {
  sendMessage: SendMessage = (message) => {
    window.postMessage(message, window.location.origin);
  };
  onMessage: OnMessage = (callback) => {
    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (!isChannelMessage(event.data)) return;
      callback(event.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  };
}
