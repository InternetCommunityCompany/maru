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
 * When the background *initiates* a message (e.g. `ComparisonChannel.emit`
 * from the comparison orchestrator), there is no originating tab — `meta`
 * carries no `tabId`. The adapter falls back to broadcasting via
 * `browser.tabs.query({})` so every tab with our content script in it
 * receives the message; tabs without a listener silently fail.
 *
 * Send failures (tab closed/navigated, no receiver) are swallowed — there's
 * no retry.
 */
export class BackgroundAdapter implements Adapter<BackgroundMeta> {
  sendMessage: SendMessage<BackgroundMeta> = async (message) => {
    const tabId = message.meta?.tabId;
    if (tabId != null) {
      browser.tabs.sendMessage(tabId, message).catch(() => {
        // tab may have closed or navigated — drop silently
      });
      return;
    }
    // Background-initiated send — broadcast to every tab. The runtime
    // routes the message to any content script with a matching listener;
    // tabs without one (or that have navigated away) error silently.
    const tabs = await browser.tabs.query({}).catch(() => []);
    for (const tab of tabs) {
      if (tab.id == null) continue;
      browser.tabs.sendMessage(tab.id, message).catch(() => {
        // no listener / tab gone — drop silently
      });
    }
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
