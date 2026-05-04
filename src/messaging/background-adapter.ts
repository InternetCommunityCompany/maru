import type { Adapter, Message, OnMessage, SendMessage } from "comctx";
import { isChannelMessage } from "./is-channel-message";

type BackgroundMeta = { tabId?: number };

/**
 * comctx adapter for the background service worker.
 *
 * Receives via `browser.runtime.onMessage` and tags each inbound message with
 * the originating `sender.tab.id` in `meta`. comctx echoes that meta back
 * onto the response, which `sendMessage` then uses to route via
 * `browser.tabs.sendMessage(tabId)` so replies reach the correct tab even
 * when many tabs are connected to the same channel concurrently.
 *
 * Send failures (tab closed/navigated) are swallowed — there's no retry.
 */
export class BackgroundAdapter implements Adapter<BackgroundMeta> {
  sendMessage: SendMessage<BackgroundMeta> = (message) => {
    const tabId = message.meta?.tabId;
    if (tabId == null) return;
    browser.tabs.sendMessage(tabId, message).catch(() => {
      // tab may have closed or navigated — drop silently
    });
  };
  onMessage: OnMessage<BackgroundMeta> = (callback) => {
    const handler = (
      rawMessage: unknown,
      sender: Browser.runtime.MessageSender,
    ) => {
      if (!isChannelMessage(rawMessage)) return;
      const message = rawMessage as Message<BackgroundMeta>;
      callback({
        ...message,
        meta: { ...message.meta, tabId: sender.tab?.id },
      });
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  };
}
