import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteUpdate } from "@/arbiter/types";
import type { SwapEvent } from "@/template-engine/types";
import { createAlertFeed } from "./create-alert-feed";
import type { AlertFeedChangeMessage } from "./types";

const swap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: "USDC",
  tokenOut: "ETH",
  amountIn: "100",
  amountOut: "0.03174",
  transport: {
    source: "fetch",
    url: "https://api.example.com/quote",
    method: "POST",
  },
  ...overrides,
});

const update = (overrides: Partial<QuoteUpdate> = {}): QuoteUpdate => ({
  swap: swap(),
  sessionKey: "session-a",
  sequence: 1,
  confidence: 0.6,
  candidateId: "cand-1",
  ...overrides,
});

describe("createAlertFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current tab snapshot when an overlay subscribes", () => {
    const sent: SentMessage[] = [];
    const feed = createAlertFeed({
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.ingest(1, update());
    const response = feed.subscribe(1, "sub-1");

    expect(response.view?.state).toBe("better");
    expect(sent).toHaveLength(0);
    feed.dispose();
  });

  it("does not leak quote updates across tabs", () => {
    const sent: SentMessage[] = [];
    const feed = createAlertFeed({
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.subscribe(1, "sub-1");
    feed.ingest(2, update({ sessionKey: "other-tab" }));

    expect(sent).toHaveLength(0);

    feed.ingest(1, update());
    expect(sent).toHaveLength(1);
    expect(sent[0]!.tabId).toBe(1);
    expect(sent[0]!.message.subscriptionId).toBe("sub-1");
    expect(sent[0]!.message.change.view?.state).toBe("better");
    feed.dispose();
  });

  it("emits only accepted monotonic replacements", () => {
    const sent: SentMessage[] = [];
    const feed = createAlertFeed({
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.subscribe(1, "sub-1");
    feed.ingest(1, update({ sequence: 2, candidateId: "newer" }));
    feed.ingest(1, update({ sequence: 1, candidateId: "older" }));

    expect(sent).toHaveLength(1);
    const view = sent[0]!.message.change.view;
    expect(view?.state).toBe("better");
    if (!view || view.state !== "better") throw new Error("expected better view");
    expect(view.card.sequence).toBe(2);
    expect(view.card.candidateId).toBe("newer");
    feed.dispose();
  });

  it("emits scanning before rendering a backend-backed better quote", async () => {
    const sent: SentMessage[] = [];
    const feed = createAlertFeed({
      quoteClient: async () => ({ provider: "maru-router", amountOut: "110" }),
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.subscribe(1, "sub-1");
    feed.ingest(1, update({ swap: swap({ amountOut: "100" }) }));

    expect(sent).toHaveLength(1);
    expect(sent[0]!.message.change.view).toEqual({
      state: "scanning",
      sourceCount: 1,
    });

    await flushPromises();

    expect(sent).toHaveLength(2);
    const view = sent[1]!.message.change.view;
    expect(view?.state).toBe("better");
    if (!view || view.state !== "better") throw new Error("expected better view");
    expect(view.card.route).toBe("Maru Router");
    expect(view.card.destination.amount).toBe("110");
    expect(view.card.savingsPercent).toBe("10");
    feed.dispose();
  });

  it("hides the alert when the backend quote is not better", async () => {
    const sent: SentMessage[] = [];
    const feed = createAlertFeed({
      quoteClient: async () => ({ provider: "maru-router", amountOut: "100" }),
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.subscribe(1, "sub-1");
    feed.ingest(1, update({ swap: swap({ amountOut: "100" }) }));
    await flushPromises();

    expect(sent).toHaveLength(2);
    expect(sent[1]!.message.change.view).toBeNull();
    feed.dispose();
  });

  it("ignores stale backend quote responses", async () => {
    const sent: SentMessage[] = [];
    const pending = new Map<number, DeferredQuote>();
    const feed = createAlertFeed({
      quoteClient: (quoteUpdate) =>
        new Promise((resolve) => {
          pending.set(quoteUpdate.sequence, { resolve });
        }),
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.subscribe(1, "sub-1");
    feed.ingest(
      1,
      update({
        sequence: 1,
        candidateId: "old",
        swap: swap({ amountOut: "100" }),
      }),
    );
    feed.ingest(
      1,
      update({
        sequence: 2,
        candidateId: "new",
        swap: swap({ amountOut: "100" }),
      }),
    );

    expect(sent).toHaveLength(2);
    pending.get(1)?.resolve({ provider: "old-router", amountOut: "200" });
    await flushPromises();
    expect(sent).toHaveLength(2);

    pending.get(2)?.resolve({ provider: "new-router", amountOut: "120" });
    await flushPromises();

    expect(sent).toHaveLength(3);
    const view = sent[2]!.message.change.view;
    expect(view?.state).toBe("better");
    if (!view || view.state !== "better") throw new Error("expected better view");
    expect(view.card.sequence).toBe(2);
    expect(view.card.route).toBe("New Router");
    feed.dispose();
  });

  it("emits an eviction reset for the current tab view", () => {
    const sent: SentMessage[] = [];
    const feed = createAlertFeed({
      reducerOptions: { ttlMs: 1000 },
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.subscribe(1, "sub-1");
    feed.ingest(1, update());
    vi.advanceTimersByTime(1000);

    expect(sent.map((entry) => entry.message.change.type)).toEqual(["added", "evicted"]);
    expect(sent[1]!.message.change.view).toBeNull();
    feed.dispose();
  });

  it("stops sending after an overlay unsubscribes", () => {
    const sent: SentMessage[] = [];
    const feed = createAlertFeed({
      sendToTab: (tabId, message) => {
        sent.push({ tabId, message });
      },
      now: () => Date.now(),
    });

    feed.subscribe(1, "sub-1");
    feed.unsubscribe("sub-1");
    feed.ingest(1, update());

    expect(sent).toHaveLength(0);
    feed.dispose();
  });
});

type SentMessage = {
  tabId: number;
  message: AlertFeedChangeMessage;
};

type DeferredQuote = {
  resolve: (quote: { provider: string; amountOut: string } | null) => void;
};

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
