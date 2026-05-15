import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteUpdate } from "@/arbiter/types";
import type { SwapEvent } from "@/template-engine/types";
import {
  createComparisonOrchestrator,
  DEFAULT_SESSION_TTL_MS,
  type FetchBestQuote,
} from "./comparison-orchestrator";
import type { FetchBestQuoteOutcome } from "./fetch-best-quote";
import type { BestQuote, ComparisonSnapshot } from "./types";

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
  transport: { source: "fetch", url: "https://x", method: "POST" },
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

const ok: BestQuote = {
  provider: "uniswap",
  amountOut: "510000000000000000",
  fetchedAt: 1_700_000_000_000,
  raw: null,
};

// Resolvable fetch double: tests control when each call resolves.
type Pending = {
  outcome: FetchBestQuoteOutcome;
  resolve: () => void;
  signal?: AbortSignal;
};
const controllableFetch = () => {
  const pending: Pending[] = [];
  const fetchImpl: FetchBestQuote = (_req, options) =>
    new Promise<FetchBestQuoteOutcome>((resolve) => {
      const entry: Pending = {
        outcome: { status: "ok", quote: ok },
        signal: options?.signal,
        resolve: () => resolve(entry.outcome),
      };
      pending.push(entry);
      options?.signal?.addEventListener("abort", () => {
        entry.outcome = { status: "aborted" };
        resolve(entry.outcome);
      });
    });
  return { fetchImpl, pending };
};

describe("comparison-orchestrator: first ingest", () => {
  it("emits a pending snapshot synchronously and kicks off the fetch", () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update());

    expect(sink).toHaveLength(1);
    expect(sink[0]).toEqual({ status: "pending", update: update() });
    expect(pending).toHaveLength(1);
  });

  it("emits a result snapshot when the fetch resolves with ok", async () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update());
    pending[0]!.outcome = { status: "ok", quote: ok };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sink).toHaveLength(2);
    expect(sink[1]!.status).toBe("result");
    if (sink[1]!.status !== "result") throw new Error("expected result");
    expect(sink[1]!.comparison.provider).toBe("uniswap");
    expect(sink[1]!.comparison.delta).toBe(10_000_000_000_000_000n);
  });

  it("emits a no_opinion snapshot when the fetch resolves with 204", async () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update());
    pending[0]!.outcome = { status: "no_opinion" };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sink.map((s) => s.status)).toEqual(["pending", "no_opinion"]);
  });

  it("emits a failed snapshot when the fetch resolves with failed", async () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update());
    pending[0]!.outcome = { status: "failed", reason: "http_500" };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sink.map((s) => s.status)).toEqual(["pending", "failed"]);
  });
});

describe("comparison-orchestrator: subsequent ingest on a known session", () => {
  it("synchronously emits a fresh result snapshot without refetching", async () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update({ sequence: 1, swap: swap({ amountOut: "500000000000000000" }) }));
    pending[0]!.outcome = { status: "ok", quote: ok };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    sink.length = 0;
    orchestrator.ingest(update({ sequence: 2, swap: swap({ amountOut: "505000000000000000" }) }));

    // No new fetch.
    expect(pending).toHaveLength(1);
    expect(sink).toHaveLength(1);
    expect(sink[0]!.status).toBe("result");
    if (sink[0]!.status !== "result") throw new Error("expected result");
    // dapp now 505, backend 510 → +5
    expect(sink[0]!.comparison.delta).toBe(5_000_000_000_000_000n);
  });

  it("re-emits the pending status while a fetch is still in flight", () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update({ sequence: 1 }));
    sink.length = 0;
    orchestrator.ingest(update({ sequence: 2 }));

    expect(sink).toHaveLength(1);
    expect(sink[0]!.status).toBe("pending");
  });

  it("drops an out-of-order arrival (sequence < stored)", () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update({ sequence: 5 }));
    sink.length = 0;
    orchestrator.ingest(update({ sequence: 3 }));

    expect(sink).toHaveLength(0);
  });

  it("drops a duplicate arrival (sequence == stored)", () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update({ sequence: 7 }));
    sink.length = 0;
    orchestrator.ingest(update({ sequence: 7 }));

    expect(sink).toHaveLength(0);
  });
});

describe("comparison-orchestrator: TTL eviction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts the in-flight fetch and emits no trailing snapshot", async () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      fetchBestQuote: fetchImpl,
      ttlMs: 100,
    });
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update());
    expect(pending[0]!.signal?.aborted).toBe(false);

    vi.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();

    expect(pending[0]!.signal?.aborted).toBe(true);
    expect(sink.map((s) => s.status)).toEqual(["pending"]);
  });

  it("resets the TTL timer on every accepted update", () => {
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      fetchBestQuote: fetchImpl,
      ttlMs: 1000,
    });
    const sink: ComparisonSnapshot[] = [];
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update({ sequence: 1 }));
    vi.advanceTimersByTime(900);
    orchestrator.ingest(update({ sequence: 2 }));
    vi.advanceTimersByTime(900);
    // Total elapsed: 1800ms. Without the reset the session would be gone; the
    // reset means we're still live, so a new (higher-seq) update emits.
    sink.length = 0;
    orchestrator.ingest(update({ sequence: 3 }));
    expect(sink).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    // Now evicted — a re-ingest at the same sequence opens a fresh session.
    sink.length = 0;
    orchestrator.ingest(update({ sequence: 3 }));
    expect(sink).toHaveLength(1);
    expect(sink[0]!.status).toBe("pending");
  });

  it("does not reset the TTL timer when an out-of-order update is dropped", () => {
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      fetchBestQuote: fetchImpl,
      ttlMs: 1000,
    });
    const sink: ComparisonSnapshot[] = [];
    orchestrator.subscribe((s) => sink.push(s));

    orchestrator.ingest(update({ sequence: 5 }));
    vi.advanceTimersByTime(900);
    orchestrator.ingest(update({ sequence: 1 })); // dropped — out of order
    vi.advanceTimersByTime(100);

    // Session evicted by now; a fresh ingest at seq 6 reopens, emits pending.
    sink.length = 0;
    orchestrator.ingest(update({ sequence: 6 }));
    expect(sink[0]!.status).toBe("pending");
  });

  it("uses DEFAULT_SESSION_TTL_MS when no override is provided", () => {
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.ingest(update());

    vi.advanceTimersByTime(DEFAULT_SESSION_TTL_MS - 1);
    const sink: ComparisonSnapshot[] = [];
    orchestrator.subscribe((s) => sink.push(s));
    orchestrator.ingest(update({ sequence: 2 }));
    expect(sink).toHaveLength(1); // session still live, emit happened

    vi.advanceTimersByTime(DEFAULT_SESSION_TTL_MS);
    sink.length = 0;
    orchestrator.ingest(update({ sequence: 3 }));
    expect(sink[0]!.status).toBe("pending"); // evicted, fresh session
  });
});

describe("comparison-orchestrator: multi-session independence", () => {
  it("keeps independent state per sessionKey", () => {
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    orchestrator.ingest(update({ sessionKey: "a", sequence: 1 }));
    orchestrator.ingest(update({ sessionKey: "b", sequence: 1 }));
    orchestrator.ingest(update({ sessionKey: "a", sequence: 2 }));

    // Two fetches kicked off (one per session), no third for a's update.
    expect(pending).toHaveLength(2);
  });
});

describe("comparison-orchestrator: subscribers", () => {
  it("stops invoking a listener after its unsubscribe runs", () => {
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });
    const fn = vi.fn();
    const unsubscribe = orchestrator.subscribe(fn);
    orchestrator.ingest(update({ sequence: 1 }));
    unsubscribe();
    orchestrator.ingest(update({ sequence: 2 }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("comparison-orchestrator: aborted fetch", () => {
  it("does not emit `failed` for an aborted fetch", async () => {
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      fetchBestQuote: fetchImpl,
      ttlMs: 50,
    });
    orchestrator.subscribe((s) => sink.push(s));

    vi.useFakeTimers();
    try {
      orchestrator.ingest(update());
      sink.length = 0;
      vi.advanceTimersByTime(50); // evict → abort
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      vi.useRealTimers();
    }

    // The aborted resolution shouldn't emit anything.
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(sink).toHaveLength(0);
  });
});

describe("comparison-orchestrator: request shape", () => {
  it("derives QuoteRequest fields from the swap and uses lowercase token addresses", async () => {
    const calls: unknown[] = [];
    const fetchImpl: FetchBestQuote = async (req) => {
      calls.push(req);
      return { status: "ok", quote: ok };
    };
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });

    orchestrator.ingest(
      update({
        swap: swap({
          tokenIn: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          tokenOut: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          amountIn: "12345",
          chainIn: 10,
          chainOut: 8453,
        }),
      }),
    );
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      chainIn: 10,
      chainOut: 8453,
      tokenIn: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      tokenOut: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      amount: "12345",
      kind: "exact_in",
    });
  });

  it("fires exactly one fetch per session even with many higher-sequence updates", async () => {
    const fetchImpl = vi.fn<FetchBestQuote>(async () => ({
      status: "ok",
      quote: ok,
    }));
    const orchestrator = createComparisonOrchestrator({ fetchBestQuote: fetchImpl });

    for (let i = 1; i <= 5; i++) {
      orchestrator.ingest(update({ sequence: i, swap: swap({ amountOut: `${i}0` }) }));
      await Promise.resolve();
    }
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
