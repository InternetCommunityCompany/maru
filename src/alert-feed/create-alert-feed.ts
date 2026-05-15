import type { QuoteUpdate, SessionKey } from "@/arbiter/types";
import type { BackendQuote, BackendQuoteClient } from "@/backend/quote-client";
import { createQuoteReducer } from "@/quote-reducer/quote-reducer";
import type { QuoteReducer, QuoteReducerChange, QuoteReducerOptions } from "@/quote-reducer/types";
import { toAlertView } from "./to-alert-view";
import {
  ALERT_FEED_CHANGE_MESSAGE_TYPE,
  type AlertFeedChange,
  type AlertFeedChangeMessage,
  type AlertFeedSubscribeResponse,
  type AlertViewModel,
} from "./types";

type SendAlertFeedMessage = (
  tabId: number,
  message: AlertFeedChangeMessage,
) => void | Promise<void>;

type AlertFeed = {
  ingest(tabId: number, update: QuoteUpdate): void;
  subscribe(tabId: number, subscriptionId: string): AlertFeedSubscribeResponse;
  unsubscribe(subscriptionId: string): void;
  disposeTab(tabId: number): void;
  dispose(): void;
};

type AlertFeedOptions = {
  reducerOptions?: QuoteReducerOptions;
  sendToTab: SendAlertFeedMessage;
  quoteClient?: BackendQuoteClient;
  now?: () => number;
};

type TabState = {
  reducer: QuoteReducer;
  touchedAt: Map<SessionKey, number>;
  views: Map<SessionKey, AlertViewModel | null>;
  pendingQuotes: Map<SessionKey, number>;
  unsubscribeReducer: () => void;
};

export function createAlertFeed({
  reducerOptions,
  sendToTab,
  quoteClient,
  now = () => Date.now(),
}: AlertFeedOptions): AlertFeed {
  const tabs = new Map<number, TabState>();
  const subscriptions = new Map<string, number>();
  let lastTouchedAt = 0;
  let nextQuoteRequestId = 0;

  const getTab = (tabId: number): TabState => {
    const existing = tabs.get(tabId);
    if (existing) return existing;

    const reducer = createQuoteReducer(reducerOptions);
    const state: TabState = {
      reducer,
      touchedAt: new Map(),
      views: new Map(),
      pendingQuotes: new Map(),
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
      state.views.delete(change.sessionKey);
      state.pendingQuotes.delete(change.sessionKey);
    } else {
      state.touchedAt.set(change.sessionKey, nextTouchedAt());
      if (quoteClient) {
        state.views.set(change.sessionKey, { state: "scanning", sourceCount: 1 });
        requestBackendQuote(tabId, state, change.update);
      } else {
        state.views.set(change.sessionKey, toAlertView(change.update));
      }
    }

    const alertChange: AlertFeedChange = {
      type: change.type,
      sessionKey: change.sessionKey,
      view: currentView(state),
    };
    emit(tabId, alertChange);
    maybeDisposeTab(tabId, state);
  };

  const requestBackendQuote = (
    tabId: number,
    state: TabState,
    update: QuoteUpdate,
  ) => {
    if (!quoteClient) return;

    const requestId = (nextQuoteRequestId += 1);
    state.pendingQuotes.set(update.sessionKey, requestId);

    Promise.resolve(quoteClient(update))
      .catch(() => null)
      .then((quote) => {
        if (tabs.get(tabId) !== state) return;
        if (state.pendingQuotes.get(update.sessionKey) !== requestId) return;

        const current = state.reducer.get(update.sessionKey);
        if (!isSameUpdate(current, update)) return;

        state.pendingQuotes.delete(update.sessionKey);
        state.views.set(update.sessionKey, toBetterAlertView(update, quote));
        emit(tabId, {
          type: "updated",
          sessionKey: update.sessionKey,
          view: currentView(state),
        });
      });
  };

  const nextTouchedAt = () => {
    lastTouchedAt = Math.max(lastTouchedAt + 1, now());
    return lastTouchedAt;
  };

  const emit = (tabId: number, change: AlertFeedChange) => {
    for (const [subscriptionId, subscribedTabId] of subscriptions) {
      if (subscribedTabId !== tabId) continue;
      const message: AlertFeedChangeMessage = {
        type: ALERT_FEED_CHANGE_MESSAGE_TYPE,
        subscriptionId,
        change,
      };
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
  return state.views.get(latestSessionKey) ?? null;
}

function toBetterAlertView(
  update: QuoteUpdate,
  quote: BackendQuote | null,
): AlertViewModel | null {
  if (quote === null) return null;

  const backendAmountOut = toBigInt(quote.amountOut);
  const dappAmountOut = toBigInt(update.swap.amountOut);
  if (
    backendAmountOut === null ||
    dappAmountOut === null ||
    backendAmountOut <= dappAmountOut
  ) {
    return null;
  }

  return toAlertView(update, {
    provider: quote.provider,
    amountOut: quote.amountOut,
    savingsPercent: formatSavingsPercent(backendAmountOut, dappAmountOut),
  });
}

function isSameUpdate(
  current: QuoteUpdate | undefined,
  update: QuoteUpdate,
): current is QuoteUpdate {
  return (
    current !== undefined &&
    current.sequence === update.sequence &&
    current.candidateId === update.candidateId
  );
}

function toBigInt(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function formatSavingsPercent(
  backendAmountOut: bigint,
  dappAmountOut: bigint,
): string | undefined {
  if (dappAmountOut <= 0n) return undefined;
  const bps = ((backendAmountOut - dappAmountOut) * 10_000n) / dappAmountOut;
  if (bps <= 0n) return undefined;

  const whole = bps / 100n;
  const fraction = (bps % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
