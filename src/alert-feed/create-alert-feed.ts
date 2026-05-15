import type { QuoteUpdate, SessionKey } from "@/arbiter/types";
import { createQuoteReducer } from "@/quote-reducer/quote-reducer";
import type { QuoteReducer, QuoteReducerChange, QuoteReducerOptions } from "@/quote-reducer/types";
import { toAlertView } from "./to-alert-view";
import {
  createAlertFeedChangeMessage,
  type AlertFeedChange,
  type AlertFeedChangeMessage,
  type AlertFeedSubscribeResponse,
  type AlertViewModel,
} from "./types";

export type SendAlertFeedMessage = (
  tabId: number,
  message: AlertFeedChangeMessage,
) => void | Promise<void>;

export type AlertFeed = {
  ingest(tabId: number, update: QuoteUpdate): void;
  subscribe(tabId: number, subscriptionId: string): AlertFeedSubscribeResponse;
  unsubscribe(subscriptionId: string): void;
  disposeTab(tabId: number): void;
  dispose(): void;
};

export type AlertFeedOptions = {
  reducerOptions?: QuoteReducerOptions;
  sendToTab: SendAlertFeedMessage;
  now?: () => number;
};

type TabState = {
  reducer: QuoteReducer;
  touchedAt: Map<SessionKey, number>;
  unsubscribeReducer: () => void;
};

export function createAlertFeed({
  reducerOptions,
  sendToTab,
  now = () => Date.now(),
}: AlertFeedOptions): AlertFeed {
  const tabs = new Map<number, TabState>();
  const subscriptions = new Map<string, number>();
  let lastTouchedAt = 0;

  const getTab = (tabId: number): TabState => {
    const existing = tabs.get(tabId);
    if (existing) return existing;

    const reducer = createQuoteReducer(reducerOptions);
    const state: TabState = {
      reducer,
      touchedAt: new Map(),
      unsubscribeReducer: () => {},
    };
    state.unsubscribeReducer = reducer.subscribe((change) => {
      handleReducerChange(tabId, state, change);
    });
    tabs.set(tabId, state);
    return state;
  };

  const handleReducerChange = (
    tabId: number,
    state: TabState,
    change: QuoteReducerChange,
  ) => {
    if (change.type === "evicted") {
      state.touchedAt.delete(change.sessionKey);
    } else {
      state.touchedAt.set(change.sessionKey, nextTouchedAt());
    }

    const alertChange: AlertFeedChange = {
      type: change.type,
      sessionKey: change.sessionKey,
      view: currentView(state),
    };
    emit(tabId, alertChange);
    maybeDisposeTab(tabId, state);
  };

  const nextTouchedAt = () => {
    lastTouchedAt = Math.max(lastTouchedAt + 1, now());
    return lastTouchedAt;
  };

  const emit = (tabId: number, change: AlertFeedChange) => {
    for (const [subscriptionId, subscribedTabId] of subscriptions) {
      if (subscribedTabId !== tabId) continue;
      const message = createAlertFeedChangeMessage(subscriptionId, change);
      Promise.resolve(sendToTab(tabId, message)).catch(() => {
        subscriptions.delete(subscriptionId);
        const state = tabs.get(tabId);
        if (state) maybeDisposeTab(tabId, state);
      });
    }
  };

  const maybeDisposeTab = (tabId: number, state: TabState) => {
    if (state.reducer.snapshot().size > 0) return;
    for (const subscribedTabId of subscriptions.values()) {
      if (subscribedTabId === tabId) return;
    }
    state.unsubscribeReducer();
    state.reducer.dispose();
    tabs.delete(tabId);
  };

  return {
    ingest(tabId, update) {
      getTab(tabId).reducer.ingest(update);
    },

    subscribe(tabId, subscriptionId) {
      const state = getTab(tabId);
      subscriptions.set(subscriptionId, tabId);
      return { view: currentView(state) };
    },

    unsubscribe(subscriptionId) {
      const tabId = subscriptions.get(subscriptionId);
      subscriptions.delete(subscriptionId);
      if (tabId === undefined) return;
      const state = tabs.get(tabId);
      if (state) maybeDisposeTab(tabId, state);
    },

    disposeTab(tabId) {
      const state = tabs.get(tabId);
      if (!state) return;
      for (const [subscriptionId, subscribedTabId] of subscriptions) {
        if (subscribedTabId === tabId) subscriptions.delete(subscriptionId);
      }
      state.unsubscribeReducer();
      state.reducer.dispose();
      tabs.delete(tabId);
    },

    dispose() {
      for (const state of tabs.values()) {
        state.unsubscribeReducer();
        state.reducer.dispose();
      }
      tabs.clear();
      subscriptions.clear();
    },
  };
}

function currentView(state: TabState): AlertViewModel | null {
  let latestSessionKey: SessionKey | null = null;
  let latestTouchedAt = -Infinity;

  for (const [sessionKey, touchedAt] of state.touchedAt) {
    if (touchedAt >= latestTouchedAt) {
      latestSessionKey = sessionKey;
      latestTouchedAt = touchedAt;
    }
  }

  if (latestSessionKey === null) return null;
  const update = state.reducer.get(latestSessionKey);
  return update ? toAlertView(update) : null;
}
