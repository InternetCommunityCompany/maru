import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterceptedEvent } from "@/interceptors/types";
import type { SwapEvent } from "@/template-engine/types";
import { createArbiter } from "./arbiter";
import { CONFIDENCE, type QuoteUpdate } from "./types";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const baseSwap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: USDC,
  tokenOut: WETH,
  amountIn: "1000000",
  amountOut: "500000000000000000",
  transport: {
    source: "fetch",
    url: "https://api.example.com/quote",
    method: "POST",
  },
  ...overrides,
});

const raw = (overrides: Partial<InterceptedEvent> = {}): InterceptedEvent =>
  ({
    source: "fetch",
    phase: "response",
    id: "evt-1",
    url: "https://api.example.com/quote",
    method: "POST",
    status: 200,
    ok: true,
    ...overrides,
  }) as InterceptedEvent;

describe("arbiter: first-candidate emission", () => {
  it("emits immediately on the first candidate at the template tier", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit });
    arbiter.ingest(baseSwap(), raw());
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![0].confidence).toBe(CONFIDENCE.template);
    expect(emit.mock.calls[0]![0].sequence).toBe(1);
  });

  it("emits at the heuristic tier when the first candidate is heuristic-sourced", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit });
    arbiter.ingest(baseSwap({ templateId: "heuristic" }), raw());
    expect(emit.mock.calls[0]![0].confidence).toBe(CONFIDENCE.heuristic);
  });

  it("carries the session key on the emission", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit });
    const swap = baseSwap();
    arbiter.ingest(swap, raw());
    const update = emit.mock.calls[0]![0];
    expect(update.sessionKey).toBeDefined();
    expect(arbiter.sessionFor(swap)?.key).toBe(update.sessionKey);
  });
});

describe("arbiter: debounce and outscore replacement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not re-emit synchronously when a lower-scoring candidate arrives", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit, debounceMs: 300 });
    // Template emits first; the heuristic that follows should not replace it
    // because heuristic provenance scores below template.
    arbiter.ingest(baseSwap({ templateId: "uniswap" }), raw({ id: "a" }));
    arbiter.ingest(
      baseSwap({ templateId: "heuristic" }),
      raw({ id: "b" }),
    );
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("replaces the emission after the debounce when a higher-scoring candidate arrives", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit, debounceMs: 300 });
    // Heuristic emits first at the heuristic tier. A template candidate
    // outscores it and should replace the emission after the debounce.
    arbiter.ingest(baseSwap({ templateId: "heuristic" }), raw({ id: "a" }));
    arbiter.ingest(baseSwap({ templateId: "uniswap" }), raw({ id: "b" }));
    expect(emit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[1]![0].confidence).toBe(CONFIDENCE.template);
    expect(emit.mock.calls[1]![0].sequence).toBe(2);
  });

  it("collapses a burst of outscoring candidates into a single late emission", () => {
    // Three parallel quote backends respond inside the debounce window;
    // the arbiter must emit exactly once for the best.
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit, debounceMs: 300 });
    arbiter.ingest(
      baseSwap({ templateId: "heuristic", amountOut: "1" }),
      raw({ id: "a" }),
    );
    arbiter.ingest(
      baseSwap({ templateId: "uniswap", amountOut: "100" }),
      raw({ id: "b" }),
    );
    arbiter.ingest(
      baseSwap({ templateId: "1inch", amountOut: "1000" }),
      raw({ id: "c" }),
    );
    arbiter.ingest(
      baseSwap({ templateId: "0x", amountOut: "10000" }),
      raw({ id: "d" }),
    );
    expect(emit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(300);
    // One open-emission + at most one debounced emission. We don't insist on
    // exactly two because the scorer could plateau across the burst — but
    // we do insist that the total fan-in collapses well below the four
    // ingests.
    expect(emit.mock.calls.length).toBeLessThanOrEqual(2);
    const last = emit.mock.calls[emit.mock.calls.length - 1]![0];
    expect(last.swap.amountOut).toBe("10000");
  });
});

describe("arbiter: session eviction on new amount", () => {
  it("opens a new session when amountIn changes for the same trade pair", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit });
    const a = baseSwap({ amountIn: "1000000" });
    const b = baseSwap({ amountIn: "2000000" });
    arbiter.ingest(a, raw({ id: "evt-a" }));
    expect(arbiter.sessionFor(a)).toBeDefined();
    arbiter.ingest(b, raw({ id: "evt-b" }));
    expect(arbiter.sessionFor(a)).toBeUndefined();
    expect(arbiter.sessionFor(b)).toBeDefined();
    // Both emissions are first-in-session emissions, so sequence == 1 on each.
    expect(emit.mock.calls[0]![0].sequence).toBe(1);
    expect(emit.mock.calls[1]![0].sequence).toBe(1);
  });
});

describe("arbiter: no-grounding fallback", () => {
  it("still emits when the grounding provider returns an empty map", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit });
    arbiter.setGroundingProvider(() => new Map());
    arbiter.ingest(baseSwap(), raw());
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0]![0].confidence).toBe(CONFIDENCE.template);
  });

  it("emits at the grounded tier when the provider returns a non-zero boost for the best candidate", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit });
    arbiter.setGroundingProvider((candidates) => {
      const map = new Map<string, number>();
      for (const c of candidates) map.set(c.id, 0.5);
      return map;
    });
    arbiter.ingest(baseSwap({ templateId: "heuristic" }), raw());
    expect(emit.mock.calls[0]![0].confidence).toBe(CONFIDENCE.grounded);
  });
});

describe("arbiter: grounding-seam plugability", () => {
  it("can swap providers mid-stream without touching arbiter internals", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit });
    // First session emits at the no-grounding tier.
    arbiter.ingest(baseSwap({ amountIn: "1" }), raw({ id: "a" }));
    expect(emit.mock.calls[0]![0].confidence).toBe(CONFIDENCE.template);

    // Swap in a grounding provider; next session reflects it.
    arbiter.setGroundingProvider((candidates) => {
      const map = new Map<string, number>();
      for (const c of candidates) map.set(c.id, 1);
      return map;
    });
    arbiter.ingest(baseSwap({ amountIn: "2" }), raw({ id: "b" }));
    expect(emit.mock.calls[1]![0].confidence).toBe(CONFIDENCE.grounded);
  });
});

describe("arbiter: sequence monotonicity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("increments sequence on every emission within a session", () => {
    const emit = vi.fn<(u: QuoteUpdate) => void>();
    const arbiter = createArbiter({ emit, debounceMs: 100 });
    arbiter.ingest(baseSwap({ templateId: "heuristic" }), raw({ id: "a" }));
    arbiter.ingest(baseSwap({ templateId: "uniswap" }), raw({ id: "b" }));
    vi.advanceTimersByTime(100);
    expect(emit.mock.calls.map((c) => c[0].sequence)).toEqual([1, 2]);
  });
});
