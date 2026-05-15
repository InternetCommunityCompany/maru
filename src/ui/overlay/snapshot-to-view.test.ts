import { beforeEach, describe, expect, it } from "vitest";
import type { QuoteUpdate } from "@/arbiter/types";
import type { ComparisonSnapshot } from "@/comparison/types";
import { hydrateTokenIndex } from "@/metadata/token-info/token-index";
import type { TokenList } from "@/metadata/token-info/token-index";
import type { SwapEvent } from "@/template-engine/build-swap-event";
import { snapshotToView } from "./snapshot-to-view";

const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_MAINNET = "0xc02aaa39b223FE8D0a0e5c4F27EaD9083C756Cc2";
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

const tokenList: TokenList = {
  tokens: [
    {
      chainId: 1,
      address: USDC_MAINNET,
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
      logoURI: "https://example.test/usdc.png",
    },
    {
      chainId: 1,
      address: WETH_MAINNET,
      decimals: 18,
      symbol: "WETH",
      name: "Wrapped Ether",
    },
    {
      chainId: 42161,
      address: USDC_ARBITRUM,
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin (Arbitrum)",
    },
  ],
};

const swap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.uniswap.org",
  chainIn: 1,
  chainOut: 1,
  tokenIn: USDC_MAINNET,
  tokenOut: WETH_MAINNET,
  amountIn: "100000000", // 100 USDC (6 decimals)
  amountOut: "30000000000000000", // 0.03 WETH (18 decimals)
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

describe("snapshotToView", () => {
  beforeEach(() => {
    hydrateTokenIndex(tokenList);
  });

  it("returns null for a null snapshot (overlay hidden)", () => {
    expect(snapshotToView(null)).toBeNull();
  });

  it("pending → scanning pill", () => {
    const snap: ComparisonSnapshot = { status: "pending", update: update() };
    expect(snapshotToView(snap)).toEqual({ kind: "pill", variant: "scanning" });
  });

  it("no_opinion → null (hidden)", () => {
    const snap: ComparisonSnapshot = { status: "no_opinion", update: update() };
    expect(snapshotToView(snap)).toBeNull();
  });

  it("failed → null (hidden)", () => {
    const snap: ComparisonSnapshot = { status: "failed", update: update() };
    expect(snapshotToView(snap)).toBeNull();
  });

  it("result with positive delta → better-rate card with resolved tokens", () => {
    const snap: ComparisonSnapshot = {
      status: "ok",
      update: update(),
      comparison: {
        delta: 1_000_000_000_000_000n,
        percentage: 3.33,
        provider: "1inch",
        routing: "1inch via Uniswap V3",
      },
    };
    const view = snapshotToView(snap);
    expect(view).not.toBeNull();
    if (view?.kind !== "better-rate") throw new Error("expected better-rate");
    expect(view.percentage).toBe(3.33);
    expect(view.route).toBe("1inch via Uniswap V3");
    expect(view.src.chainId).toBe(1);
    expect(view.src.token?.symbol).toBe("USDC");
    expect(view.src.amount).toBe("100");
    expect(view.dst.chainId).toBe(1);
    expect(view.dst.token?.symbol).toBe("WETH");
    expect(view.dst.amount).toBe("0.03");
  });

  it("result with zero delta → all-good pill", () => {
    const snap: ComparisonSnapshot = {
      status: "ok",
      update: update(),
      comparison: {
        delta: 0n,
        percentage: 0,
        provider: "1inch",
      },
    };
    expect(snapshotToView(snap)).toEqual({ kind: "pill", variant: "all-good" });
  });

  it("result with negative delta → all-good pill (dapp's quote is better)", () => {
    const snap: ComparisonSnapshot = {
      status: "ok",
      update: update(),
      comparison: {
        delta: -100n,
        percentage: -0.1,
        provider: "1inch",
      },
    };
    expect(snapshotToView(snap)).toEqual({ kind: "pill", variant: "all-good" });
  });

  it("falls back to provider when routing is absent", () => {
    const snap: ComparisonSnapshot = {
      status: "ok",
      update: update(),
      comparison: {
        delta: 1n,
        percentage: 1,
        provider: "cowswap",
      },
    };
    const view = snapshotToView(snap);
    if (view?.kind !== "better-rate") throw new Error("expected better-rate");
    expect(view.route).toBe("cowswap");
  });

  it("preserves null token info when the address is not in the index", () => {
    const snap: ComparisonSnapshot = {
      status: "ok",
      update: update({
        swap: swap({
          tokenIn: "0x0000000000000000000000000000000000000099",
        }),
      }),
      comparison: { delta: 1n, percentage: 0.1, provider: "1inch" },
    };
    const view = snapshotToView(snap);
    if (view?.kind !== "better-rate") throw new Error("expected better-rate");
    expect(view.src.token).toBeNull();
    // Without decimals we fall back to 18 → formatted amount changes shape but stays a string.
    expect(typeof view.src.amount).toBe("string");
  });

  it("cross-chain swap is rendered uniformly with same-chain (only chainIds differ)", () => {
    const snap: ComparisonSnapshot = {
      status: "ok",
      update: update({
        swap: swap({
          chainIn: 1,
          chainOut: 42161,
          tokenIn: USDC_MAINNET,
          tokenOut: USDC_ARBITRUM,
          amountIn: "100000000",
          amountOut: "99500000",
          type: "bridge",
        }),
      }),
      comparison: {
        delta: 500_000n,
        percentage: 0.5,
        provider: "stargate",
        routing: "Stargate",
      },
    };
    const view = snapshotToView(snap);
    if (view?.kind !== "better-rate") throw new Error("expected better-rate");
    expect(view.src.chainId).toBe(1);
    expect(view.dst.chainId).toBe(42161);
    expect(view.src.token?.symbol).toBe("USDC");
    expect(view.dst.token?.symbol).toBe("USDC");
    expect(view.src.amount).toBe("100");
    expect(view.dst.amount).toBe("99.5");
  });

  it("propagates null percentage when the dapp's amountOut was zero", () => {
    const snap: ComparisonSnapshot = {
      status: "ok",
      update: update({ swap: swap({ amountOut: "0" }) }),
      comparison: {
        delta: 1_000_000n,
        percentage: null,
        provider: "1inch",
      },
    };
    const view = snapshotToView(snap);
    if (view?.kind !== "better-rate") throw new Error("expected better-rate");
    expect(view.percentage).toBeNull();
  });
});
