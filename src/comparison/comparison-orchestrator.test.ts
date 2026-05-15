import { describe, expect, it, vi } from "vitest";
import type { QuoteUpdate } from "@/arbiter/types";
import { createQuoteReducer } from "@/quote-reducer/quote-reducer";
import type { SwapEvent } from "@/template-engine/types";
import {
  createComparisonOrchestrator,
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

describe("comparison-orchestrator: added", () => {
  it("emits a pending snapshot synchronously and kicks off the fetch", () => {
    const reducer = createQuoteReducer();
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    reducer.ingest(update());

    expect(sink).toHaveLength(1);
    expect(sink[0]).toEqual({ status: "pending", update: update() });
    expect(pending).toHaveLength(1);

    orchestrator.dispose();
    reducer.dispose();
  });

  it("emits a result snapshot when the fetch resolves with ok", async () => {
    const reducer = createQuoteReducer();
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    reducer.ingest(update());
    pending[0]!.outcome = { status: "ok", quote: ok };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sink).toHaveLength(2);
    expect(sink[1]!.status).toBe("result");
    if (sink[1]!.status !== "result") throw new Error("expected result");
    expect(sink[1]!.comparison.provider).toBe("uniswap");
    expect(sink[1]!.comparison.delta).toBe(10_000_000_000_000_000n);

    orchestrator.dispose();
    reducer.dispose();
  });

  it("emits a no_opinion snapshot when the fetch resolves with 204", async () => {
    const reducer = createQuoteReducer();
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    reducer.ingest(update());
    pending[0]!.outcome = { status: "no_opinion" };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sink.map((s) => s.status)).toEqual(["pending", "no_opinion"]);
    orchestrator.dispose();
    reducer.dispose();
  });

  it("emits a failed snapshot when the fetch resolves with failed", async () => {
    const reducer = createQuoteReducer();
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    reducer.ingest(update());
    pending[0]!.outcome = { status: "failed", reason: "http_500" };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sink.map((s) => s.status)).toEqual(["pending", "failed"]);
    orchestrator.dispose();
    reducer.dispose();
  });
});

describe("comparison-orchestrator: updated", () => {
  it("synchronously emits a fresh result snapshot without refetching", async () => {
    const reducer = createQuoteReducer();
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    reducer.ingest(update({ sequence: 1, swap: swap({ amountOut: "500000000000000000" }) }));
    pending[0]!.outcome = { status: "ok", quote: ok };
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    sink.length = 0;
    reducer.ingest(update({ sequence: 2, swap: swap({ amountOut: "505000000000000000" }) }));

    // No new fetch.
    expect(pending).toHaveLength(1);
    expect(sink).toHaveLength(1);
    expect(sink[0]!.status).toBe("result");
    if (sink[0]!.status !== "result") throw new Error("expected result");
    // dapp now 505, backend 510 → +5
    expect(sink[0]!.comparison.delta).toBe(5_000_000_000_000_000n);

    orchestrator.dispose();
    reducer.dispose();
  });

  it("re-emits the pending status while a fetch is still in flight", () => {
    const reducer = createQuoteReducer();
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    reducer.ingest(update({ sequence: 1 }));
    sink.length = 0;
    reducer.ingest(update({ sequence: 2 }));

    expect(sink).toHaveLength(1);
    expect(sink[0]!.status).toBe("pending");
    orchestrator.dispose();
    reducer.dispose();
  });
});

describe("comparison-orchestrator: evicted", () => {
  it("aborts the in-flight fetch and emits no trailing snapshot", async () => {
    const reducer = createQuoteReducer({ ttlMs: 100 });
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    vi.useFakeTimers();
    try {
      reducer.ingest(update());
      expect(pending[0]!.signal?.aborted).toBe(false);

      vi.advanceTimersByTime(100); // triggers eviction
      // microtasks
      await Promise.resolve();
      await Promise.resolve();

      expect(pending[0]!.signal?.aborted).toBe(true);
      // sink: only the initial pending snapshot — eviction emits nothing,
      // aborted fetch resolution emits nothing.
      expect(sink.map((s) => s.status)).toEqual(["pending"]);
    } finally {
      vi.useRealTimers();
    }

    orchestrator.dispose();
    reducer.dispose();
  });

  it("does not emit `failed` for an aborted fetch", async () => {
    const reducer = createQuoteReducer();
    const sink: ComparisonSnapshot[] = [];
    const { fetchImpl, pending } = controllableFetch();
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: (s) => sink.push(s),
    });

    reducer.ingest(update());
    sink.length = 0;
    orchestrator.dispose();
    pending[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(sink).toHaveLength(0);
    reducer.dispose();
  });
});

describe("comparison-orchestrator: request shape", () => {
  it("derives QuoteRequest fields from the swap and uses lowercase token addresses", async () => {
    const reducer = createQuoteReducer();
    const calls: unknown[] = [];
    const fetchImpl: FetchBestQuote = async (req) => {
      calls.push(req);
      return { status: "ok", quote: ok };
    };
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: () => {},
    });

    reducer.ingest(
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

    orchestrator.dispose();
    reducer.dispose();
  });

  it("fires exactly one fetch per session even with many `updated` events", async () => {
    const reducer = createQuoteReducer();
    const fetchImpl = vi.fn<FetchBestQuote>(async () => ({
      status: "ok",
      quote: ok,
    }));
    const orchestrator = createComparisonOrchestrator({
      reducer,
      fetchBestQuote: fetchImpl,
      emit: () => {},
    });

    for (let i = 1; i <= 5; i++) {
      reducer.ingest(update({ sequence: i, swap: swap({ amountOut: `${i}0` }) }));
      await Promise.resolve();
    }
    expect(fetchImpl).toHaveBeenCalledOnce();

    orchestrator.dispose();
    reducer.dispose();
  });
});
