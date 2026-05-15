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
