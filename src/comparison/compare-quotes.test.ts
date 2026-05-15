import { describe, expect, it } from "vitest";
import type { SwapEvent } from "@/template-engine/build-swap-event";
import { compareQuotes } from "./compare-quotes";
import type { BestQuote } from "./types";

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

const best = (overrides: Partial<BestQuote> = {}): BestQuote => ({
  provider: "uniswap",
  amountOut: "510000000000000000",
  fetchedAt: 1700000000000,
  raw: null,
  ...overrides,
});

describe("compareQuotes", () => {
  it("backend better: positive delta and percentage", () => {
    const result = compareQuotes(swap(), best());
    // dapp = 0.5 ETH, backend = 0.51 ETH → +0.01 ETH, +2%
    expect(result.delta).toBe(10_000_000_000_000_000n);
    expect(result.percentage).toBeCloseTo(2, 5);
    expect(result.provider).toBe("uniswap");
  });

  it("dapp better: negative delta and negative percentage", () => {
    const result = compareQuotes(swap(), best({ amountOut: "490000000000000000" }));
    expect(result.delta).toBe(-10_000_000_000_000_000n);
    expect(result.percentage).toBeCloseTo(-2, 5);
  });

  it("parity: zero delta and zero percentage", () => {
    const result = compareQuotes(swap(), best({ amountOut: "500000000000000000" }));
    expect(result.delta).toBe(0n);
    expect(result.percentage).toBe(0);
  });

  it("zero dapp amount: delta well-defined, percentage null", () => {
    const result = compareQuotes(swap({ amountOut: "0" }), best());
    expect(result.delta).toBe(510_000_000_000_000_000n);
    expect(result.percentage).toBeNull();
  });

  it("forwards routing when present", () => {
    const result = compareQuotes(swap(), best({ routing: "USDC → WETH" }));
    expect(result.routing).toBe("USDC → WETH");
  });

  it("omits routing when absent", () => {
    const result = compareQuotes(swap(), best());
    expect(result.routing).toBeUndefined();
  });

  it("handles uint256-scale amounts without losing precision", () => {
    const huge = "999999999999999999999999999999"; // 30 digits, > 2^53
    const result = compareQuotes(swap({ amountOut: huge }), best({ amountOut: huge }));
    expect(result.delta).toBe(0n);
  });

  it("defends against unparseable amounts by treating them as zero", () => {
    const result = compareQuotes(swap({ amountOut: "garbage" }), best());
    // dapp parses as 0 → percentage null, delta = backend
    expect(result.delta).toBe(510_000_000_000_000_000n);
    expect(result.percentage).toBeNull();
  });
});
