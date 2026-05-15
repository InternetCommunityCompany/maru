import type { Adapter, Message, OnMessage, SendMessage } from "comctx";
import { isChannelMessage } from "./is-channel-message";

/**
 * comctx adapter for an ISOLATED-world content script.
 *
 * Mirrors {@link BackgroundAdapter} on the content-script side: messages are
 * sent to the background via `browser.runtime.sendMessage` and received from
 * the background via `browser.runtime.onMessage`. Used by the overlay
 * content script to subscribe to channels whose producer lives in the
 * background service worker (e.g. `ComparisonChannel`).
 *
 * Send failures (no listening receiver — typically the SW is asleep, not yet
 * booted, or the message landed on a runtime instance that doesn't care) are
 * swallowed, since channel emissions are fire-and-forget.
 */
export class ContentAdapter implements Adapter {
  sendMessage: SendMessage = (message) => {
    browser.runtime.sendMessage(message).catch(() => {
      // background may be asleep or there's no listener — drop silently
    });
  };
  onMessage: OnMessage = (callback) => {
    const handler = (rawMessage: unknown) => {
      if (!isChannelMessage(rawMessage)) return;
      callback(rawMessage as Message);
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  };
}
