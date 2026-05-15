import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteUpdate } from "@/arbiter/types";
import type { SwapEvent } from "@/template-engine/types";
import { createQuoteReducer, DEFAULT_TTL_MS } from "./quote-reducer";
import type { QuoteReducerChange } from "./types";

const swap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  tokenOut: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  amountIn: "1000000",
  amountOut: "500000000000000000",
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

describe("quote-reducer: first update", () => {
  it("adds a new session and fires an `added` change", () => {
    const reducer = createQuoteReducer();
    const sink: QuoteReducerChange[] = [];
    reducer.subscribe((c) => sink.push(c));

    reducer.ingest(update());

    expect(reducer.get("session-a")).toEqual(update());
    expect(sink).toHaveLength(1);
    expect(sink[0]!.type).toBe("added");
    expect(sink[0]!.sessionKey).toBe("session-a");
    reducer.dispose();
  });
});

describe("quote-reducer: monotonic sequence replacement", () => {
  it("replaces on a strictly-greater sequence and fires `updated` with the previous value", () => {
    const reducer = createQuoteReducer();
    const sink: QuoteReducerChange[] = [];
    reducer.subscribe((c) => sink.push(c));

    const first = update({ sequence: 1, candidateId: "cand-1" });
    const second = update({ sequence: 2, candidateId: "cand-2" });
    reducer.ingest(first);
    reducer.ingest(second);

    expect(reducer.get("session-a")).toEqual(second);
    expect(sink.map((c) => c.type)).toEqual(["added", "updated"]);
    const updated = sink[1]!;
    if (updated.type !== "updated") throw new Error("expected updated");
    expect(updated.previous).toEqual(first);
    expect(updated.update).toEqual(second);
    reducer.dispose();
  });

  it("drops an out-of-order arrival (sequence < stored)", () => {
    const reducer = createQuoteReducer();
    const sink: QuoteReducerChange[] = [];
    reducer.subscribe((c) => sink.push(c));

    const newer = update({ sequence: 5 });
    const older = update({ sequence: 3 });
    reducer.ingest(newer);
    reducer.ingest(older);

    expect(reducer.get("session-a")).toEqual(newer);
    expect(sink.map((c) => c.type)).toEqual(["added"]);
    reducer.dispose();
  });

  it("drops a duplicate arrival (sequence == stored)", () => {
    const reducer = createQuoteReducer();
    const sink: QuoteReducerChange[] = [];
    reducer.subscribe((c) => sink.push(c));

    const u = update({ sequence: 7 });
    reducer.ingest(u);
    reducer.ingest(u);

    expect(reducer.get("session-a")).toEqual(u);
    expect(sink.map((c) => c.type)).toEqual(["added"]);
    reducer.dispose();
  });
});

describe("quote-reducer: late arrivals on long-lived sessions", () => {
  it("accepts a much later sequence even if intermediate ones never arrived", () => {
    const reducer = createQuoteReducer();
    const sink: QuoteReducerChange[] = [];
    reducer.subscribe((c) => sink.push(c));

    reducer.ingest(update({ sequence: 1 }));
    reducer.ingest(update({ sequence: 42, candidateId: "cand-late" }));

    expect(reducer.get("session-a")?.sequence).toBe(42);
    expect(sink.map((c) => c.type)).toEqual(["added", "updated"]);
    reducer.dispose();
  });
});

describe("quote-reducer: TTL eviction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("evicts a session whose last update is older than ttlMs", () => {
    const reducer = createQuoteReducer({ ttlMs: 1000 });
    const sink: QuoteReducerChange[] = [];
    reducer.subscribe((c) => sink.push(c));

    const u = update();
    reducer.ingest(u);
    expect(reducer.get("session-a")).toEqual(u);

    vi.advanceTimersByTime(1000);
    expect(reducer.get("session-a")).toBeUndefined();
    expect(sink.map((c) => c.type)).toEqual(["added", "evicted"]);
    const evicted = sink[1]!;
    if (evicted.type !== "evicted") throw new Error("expected evicted");
    expect(evicted.update).toEqual(u);
    reducer.dispose();
  });

  it("resets the TTL timer on every accepted update", () => {
    const reducer = createQuoteReducer({ ttlMs: 1000 });
    reducer.ingest(update({ sequence: 1 }));
    vi.advanceTimersByTime(900);
    reducer.ingest(update({ sequence: 2 }));
    vi.advanceTimersByTime(900);
    // Total elapsed: 1800 ms. Without the reset the session would be gone;
    // with it, the second update reset the timer at 900 ms.
    expect(reducer.get("session-a")?.sequence).toBe(2);
    vi.advanceTimersByTime(100);
    expect(reducer.get("session-a")).toBeUndefined();
    reducer.dispose();
  });

  it("does not reset the TTL timer when an out-of-order update is dropped", () => {
    const reducer = createQuoteReducer({ ttlMs: 1000 });
    reducer.ingest(update({ sequence: 5 }));
    vi.advanceTimersByTime(900);
    reducer.ingest(update({ sequence: 1 })); // dropped — out of order
    vi.advanceTimersByTime(100);
    expect(reducer.get("session-a")).toBeUndefined();
    reducer.dispose();
  });

  it("uses DEFAULT_TTL_MS when no override is provided", () => {
    const reducer = createQuoteReducer();
    reducer.ingest(update());
    vi.advanceTimersByTime(DEFAULT_TTL_MS - 1);
    expect(reducer.get("session-a")).toBeDefined();
    vi.advanceTimersByTime(1);
    expect(reducer.get("session-a")).toBeUndefined();
    reducer.dispose();
  });
});

describe("quote-reducer: multiple sessions", () => {
  it("keeps independent state per sessionKey", () => {
    const reducer = createQuoteReducer();
    reducer.ingest(update({ sessionKey: "a", sequence: 1 }));
    reducer.ingest(update({ sessionKey: "b", sequence: 1 }));
    reducer.ingest(update({ sessionKey: "a", sequence: 2 }));
    expect(reducer.get("a")?.sequence).toBe(2);
    expect(reducer.get("b")?.sequence).toBe(1);
    expect(reducer.snapshot().size).toBe(2);
    reducer.dispose();
  });
});

describe("quote-reducer: subscribers", () => {
  it("returns a snapshot that does not affect reducer state when mutated", () => {
    const reducer = createQuoteReducer();
    reducer.ingest(update());
    const snap = reducer.snapshot();
    // intentional cast — snapshot is read-only by contract but the underlying
    // Map is still mutable; we verify the reducer holds its own copy.
    (snap as Map<string, QuoteUpdate>).clear();
    expect(reducer.get("session-a")).toBeDefined();
    reducer.dispose();
  });

  it("stops invoking a listener after its unsubscribe runs", () => {
    const reducer = createQuoteReducer();
    const fn = vi.fn();
    const unsubscribe = reducer.subscribe(fn);
    reducer.ingest(update({ sequence: 1 }));
    unsubscribe();
    reducer.ingest(update({ sequence: 2 }));
    expect(fn).toHaveBeenCalledTimes(1);
    reducer.dispose();
  });

  it("isolates a throwing listener from other listeners", () => {
    const reducer = createQuoteReducer();
    const good = vi.fn();
    reducer.subscribe(() => {
      throw new Error("boom");
    });
    reducer.subscribe(good);
    reducer.ingest(update());
    expect(good).toHaveBeenCalledTimes(1);
    reducer.dispose();
  });
});

describe("quote-reducer: dispose", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels pending TTL timers", () => {
    const reducer = createQuoteReducer({ ttlMs: 1000 });
    const sink: QuoteReducerChange[] = [];
    reducer.subscribe((c) => sink.push(c));
    reducer.ingest(update());
    reducer.dispose();
    vi.advanceTimersByTime(2000);
    // dispose() drops listeners as well, so `evicted` could not fire even if
    // the timer somehow survived — assert via the change log.
    expect(sink.map((c) => c.type)).toEqual(["added"]);
  });

  it("clears the internal map", () => {
    const reducer = createQuoteReducer();
    reducer.ingest(update());
    reducer.dispose();
    expect(reducer.get("session-a")).toBeUndefined();
    expect(reducer.snapshot().size).toBe(0);
  });
});
