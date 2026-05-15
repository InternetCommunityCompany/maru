import { describe, expect, it } from "vitest";
import type { Candidate } from "@/arbiter/types";
import type { SwapEvent } from "@/template-engine/types";
import { matchAmounts } from "./match-amounts";
import type { TextNodeSnapshot, TokenMetaResolver } from "./types";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const META: TokenMetaResolver = (_chain, address) => {
  const a = address.toLowerCase();
  if (a === USDC) return { decimals: 6, symbol: "USDC" };
  if (a === WETH) return { decimals: 18, symbol: "WETH" };
  return null;
};

const baseSwap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: USDC,
  tokenOut: WETH,
  amountIn: "1000000000", // 1000 USDC
  amountOut: "500000000000000000", // 0.5 WETH
  transport: {
    source: "fetch",
    url: "https://api.example.com/quote",
    method: "POST",
  },
  ...overrides,
});

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: "c1",
  swap: baseSwap(),
  interceptedId: "i1",
  phase: "response",
  source: "fetch",
  url: "https://api.example.com/quote",
  ingestedAt: 0,
  ...overrides,
});

const tn = (
  text: string,
  overrides: Partial<TextNodeSnapshot> = {},
): TextNodeSnapshot => ({
  text,
  contextText: overrides.contextText ?? text,
  ariaSelected: false,
  ariaChecked: false,
  ...overrides,
});

describe("matchAmounts: tier hierarchy", () => {
  it("scores a selected-row hit above a bare hit on the same variant", () => {
    const c = candidate();
    const selectedHit = matchAmounts(
      [c],
      [tn("0.5", { ariaSelected: true, contextText: "Route A 0.5" })],
      META,
    );
    const bareHit = matchAmounts([{ ...c, id: "c2" }], [tn("0.5")], META);
    expect(selectedHit.get("c1")!.boost).toBeGreaterThan(
      bareHit.get("c2")!.boost,
    );
  });

  it("scores a labelled hit above a bare hit on the same variant", () => {
    const c = candidate();
    const labelledHit = matchAmounts(
      [c],
      [tn("0.5", { contextText: "You receive 0.5 WETH" })],
      META,
    );
    const bareHit = matchAmounts([{ ...c, id: "c2" }], [tn("0.5")], META);
    expect(labelledHit.get("c1")!.boost).toBeGreaterThan(
      bareHit.get("c2")!.boost,
    );
  });

  it("scores a proximity hit above a bare hit when the other side's symbol shares the container", () => {
    const c = candidate();
    const proximityHit = matchAmounts(
      [c],
      [
        tn("0.5", {
          // No label phrase, but the other-side symbol (USDC since 0.5 is the
          // amountOut/WETH side, the other side is USDC/in) appears nearby.
          contextText: "Trade 1000 USDC for 0.5",
        }),
      ],
      META,
    );
    const bareHit = matchAmounts([{ ...c, id: "c2" }], [tn("0.5")], META);
    expect(proximityHit.get("c1")!.boost).toBeGreaterThan(
      bareHit.get("c2")!.boost,
    );
  });
});

describe("matchAmounts: significant-digit weighting", () => {
  it("scores a 6-digit hit higher than a 2-digit hit at the same tier", () => {
    // Use distinct candidates with different amountOut so the variant sets
    // differ. WETH 18 decimals: amountOut "123456000000000000" -> "0.123456".
    const cHigh = candidate({
      id: "high",
      swap: baseSwap({ amountOut: "123456000000000000" }),
    });
    const cLow = candidate({
      id: "low",
      swap: baseSwap({ amountOut: "120000000000000000" }), // 0.12
    });
    const high = matchAmounts(
      [cHigh],
      [tn("0.123456", { contextText: "You receive 0.123456 WETH" })],
      META,
    );
    const low = matchAmounts(
      [cLow],
      [tn("0.12", { contextText: "You receive 0.12 WETH" })],
      META,
    );
    expect(high.get("high")!.boost).toBeGreaterThan(low.get("low")!.boost);
  });
});

describe("matchAmounts: routing amountOut vs amountOutMin", () => {
  it("routes a min-labelled hit to the amountOutMin side", () => {
    const c = candidate({
      swap: baseSwap({
        amountOut: "500000000000000000", // 0.5
        amountOutMin: "495000000000000000", // 0.495
      }),
    });
    const r = matchAmounts(
      [c],
      [tn("0.495", { contextText: "Min received: 0.495 WETH" })],
      META,
    );
    expect(r.get("c1")!.boost).toBeGreaterThan(0);
    expect(r.get("c1")!.evidence[0]!.side).toBe("amountOutMin");
  });
});

describe("matchAmounts: approximation prefix", () => {
  it("matches a variant when the rendered text has a ~ prefix", () => {
    const c = candidate();
    const r = matchAmounts(
      [c],
      [tn("~0.5", { contextText: "You receive ~0.5 WETH" })],
      META,
    );
    expect(r.get("c1")!.boost).toBeGreaterThan(0);
  });

  it("matches a variant when the rendered text has a ≈ prefix", () => {
    const c = candidate();
    const r = matchAmounts(
      [c],
      [tn("≈0.5", { contextText: "≈0.5 WETH" })],
      META,
    );
    expect(r.get("c1")!.boost).toBeGreaterThan(0);
  });
});

describe("matchAmounts: collision rejection", () => {
  it("does not match a 0.5 variant inside an unrelated 10.5 number", () => {
    const c = candidate();
    const r = matchAmounts(
      [c],
      [tn("Route fee 10.5%", { contextText: "Route fee 10.5%" })],
      META,
    );
    expect(r.has("c1")).toBe(false);
  });

  it("rejects sub-2-digit hits even on a bare-tier match", () => {
    const c = candidate({
      swap: baseSwap({ amountOut: "5000000000000000000" }), // 5 WETH
    });
    // The variant "5" exists but is too low entropy.
    const r = matchAmounts(
      [c],
      [tn("Route 5", { contextText: "Route 5" })],
      META,
    );
    expect(r.has("c1")).toBe(false);
  });
});

describe("matchAmounts: gross-vs-net surfacing", () => {
  it("surfaces both labels when two amountOut hits land under different labels", () => {
    const c = candidate({
      swap: baseSwap({
        amountOut: "500000000000000000", // 0.5
      }),
    });
    const r = matchAmounts(
      [c],
      [
        tn("0.5", { contextText: "You receive (gross) 0.5 WETH" }),
        tn("0.5", { contextText: "Receive (incl. fees) 0.5 WETH" }),
      ],
      META,
    );
    const ev = r.get("c1")!.evidence;
    expect(ev.length).toBeGreaterThanOrEqual(2);
    const labels = ev.map((e) => e.label);
    // Both label phrases should be represented.
    expect(new Set(labels).size).toBeGreaterThan(1);
  });
});

describe("matchAmounts: unknown decimals fallback", () => {
  it("skips a candidate whose tokens are not resolvable", () => {
    const unknown: TokenMetaResolver = () => null;
    const c = candidate();
    const r = matchAmounts([c], [tn("0.5")], unknown);
    expect(r.has("c1")).toBe(false);
  });
});

describe("matchAmounts: empty inputs", () => {
  it("returns an empty map on an empty snapshot", () => {
    const c = candidate();
    expect(matchAmounts([c], [], META).size).toBe(0);
  });

  it("returns an empty map on an empty candidate list", () => {
    expect(matchAmounts([], [tn("0.5")], META).size).toBe(0);
  });
});

describe("matchAmounts: multiple candidates", () => {
  it("boosts each candidate at its own exact rendered value", () => {
    const a = candidate({
      id: "a",
      swap: baseSwap({ amountOut: "500000000000000000" }), // 0.5
    });
    const b = candidate({
      id: "b",
      swap: baseSwap({ amountOut: "490000000000000000" }), // 0.49
    });
    const r = matchAmounts(
      [a, b],
      [
        tn("0.5", { contextText: "Route 1: 0.5 WETH" }),
        tn("0.49", { contextText: "Route 2: 0.49 WETH" }),
      ],
      META,
    );
    // `b`'s higher precision (3 sig digits) outscores `a`'s shorter hit.
    expect(r.has("a")).toBe(true);
    expect(r.has("b")).toBe(true);
    expect(r.get("b")!.boost).toBeGreaterThan(r.get("a")!.boost);
  });

  it("uses the selected-row signal to disambiguate even when precision favours the unselected candidate", () => {
    const a = candidate({
      id: "a",
      swap: baseSwap({ amountOut: "500000000000000000" }), // 0.5 — selected
    });
    const b = candidate({
      id: "b",
      swap: baseSwap({ amountOut: "490000000000000000" }), // 0.49
    });
    const r = matchAmounts(
      [a, b],
      [
        tn("0.5", { ariaSelected: true, contextText: "Route 1: 0.5 WETH" }),
        tn("0.49", { contextText: "Route 2: 0.49 WETH" }),
      ],
      META,
    );
    expect(r.get("a")!.boost).toBeGreaterThan(r.get("b")!.boost);
  });
});
