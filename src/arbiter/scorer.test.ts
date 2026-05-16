import { describe, expect, it } from "vitest";
import type { SwapEvent } from "@/template-engine/build-swap-event";
import { score } from "./scorer";
import type { Candidate } from "./types";

const baseSwap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: "0xaaaa000000000000000000000000000000000000",
  tokenOut: "0xbbbb000000000000000000000000000000000000",
  amountIn: "1000000",
  amountOut: "500000000000000000",
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

describe("score (provenance)", () => {
  it("ranks template candidates above heuristic candidates, holding rest equal", () => {
    const template = candidate({ swap: baseSwap({ templateId: "uniswap" }) });
    const heuristic = candidate({
      id: "c2",
      swap: baseSwap({ templateId: "heuristic" }),
    });
    expect(score(template).total).toBeGreaterThan(score(heuristic).total);
  });
});

describe("score (phase)", () => {
  it("ranks response-phase candidates above request-phase candidates", () => {
    const response = candidate({ phase: "response" });
    const request = candidate({ id: "c2", phase: "request" });
    expect(score(response).total).toBeGreaterThan(score(request).total);
  });

  it("treats error-phase candidates the same as request-phase for the bonus", () => {
    const error = candidate({ phase: "error" });
    const request = candidate({ id: "c2", phase: "request" });
    expect(score(error).total).toBe(score(request).total);
  });
});

describe("score (amountOut rank)", () => {
  it("ranks a higher-amountOut candidate above a lower one", () => {
    const small = candidate({
      id: "small",
      swap: baseSwap({ amountOut: "100" }),
    });
    const large = candidate({
      id: "large",
      swap: baseSwap({ amountOut: "1000" }),
    });
    expect(score(large).total).toBeGreaterThan(score(small).total);
  });

  it("handles bigint amountOut values without overflowing Number", () => {
    const huge = candidate({
      id: "huge",
      // 100 ETH in wei — well past 2**53.
      swap: baseSwap({ amountOut: "100000000000000000000" }),
    });
    expect(() => score(huge)).not.toThrow();
  });
});

describe("score (grounding boost)", () => {
  it("adds the grounding boost on top of the scorer output", () => {
    const c = candidate();
    const base = score(c, 0).total;
    const boosted = score(c, 0.5).total;
    expect(boosted).toBeCloseTo(base + 0.5, 6);
  });
});

describe("score (combined ordering)", () => {
  it("lets a strong grounding boost lift a heuristic candidate above a template one", () => {
    // The grounded heuristic should beat the un-grounded template.
    const template = candidate({ swap: baseSwap({ templateId: "uniswap" }) });
    const grounded = candidate({
      id: "c2",
      swap: baseSwap({ templateId: "heuristic" }),
    });
    expect(score(grounded, 0.6).total).toBeGreaterThan(score(template, 0).total);
  });
});
