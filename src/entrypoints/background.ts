import { createAlertFeed } from "@/alert-feed/create-alert-feed";
import {
  isAlertFeedSubscribeMessage,
  isAlertFeedUnsubscribeMessage,
} from "@/alert-feed/types";
import { fetchBackendQuote } from "@/backend/quote-client";
import { isQuoteUpdateMessage } from "@/messaging/quote-update-message";

export default defineBackground(() => {
  const alertFeed = createAlertFeed({
    quoteClient: fetchBackendQuote,
    sendToTab: (tabId, message) => browser.tabs.sendMessage(tabId, message),
  });

  browser.runtime.onMessage.addListener((message, sender) => {
    if (isQuoteUpdateMessage(message)) {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return;
      alertFeed.ingest(tabId, message.update);
      return;
    }

    if (isAlertFeedSubscribeMessage(message)) {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return Promise.resolve({ view: null });
      return Promise.resolve(alertFeed.subscribe(tabId, message.subscriptionId));
    }

    if (isAlertFeedUnsubscribeMessage(message)) {
      alertFeed.unsubscribe(message.subscriptionId);
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    alertFeed.disposeTab(tabId);
  });
});
