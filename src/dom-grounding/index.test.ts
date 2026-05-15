// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Candidate } from "@/arbiter/types";
import type { SwapEvent } from "@/template-engine/build-swap-event";
import { createDomGrounding } from "./index";
import type { TokenMetaResolver } from "./types";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const META: TokenMetaResolver = (_chain, address) => {
  const a = address.toLowerCase();
  if (a === USDC) return { decimals: 6, symbol: "USDC" };
  if (a === WETH) return { decimals: 18, symbol: "WETH" };
  return null;
};

const swap: SwapEvent = {
  kind: "swap",
  type: "swap",
  templateId: "uniswap",
  domain: "app.example.xyz",
  chainIn: 1,
  chainOut: 1,
  tokenIn: USDC,
  tokenOut: WETH,
  amountIn: "1000000000",
  amountOut: "500000000000000000",
  transport: {
    source: "fetch",
    url: "https://api.example.com/quote",
    method: "POST",
  },
};

const candidate: Candidate = {
  id: "c1",
  swap,
  interceptedId: "i1",
  phase: "response",
  source: "fetch",
  url: "https://api.example.com/quote",
  ingestedAt: 0,
};

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createDomGrounding: end-to-end", () => {
  it("returns a non-zero boost when a candidate's amount is rendered with a labelled context", () => {
    document.body.innerHTML = `
      <div class="card">
        <span>You receive</span>
        <span>0.5</span>
        <span>WETH</span>
      </div>
    `;
    const handle = createDomGrounding({ resolveMeta: META });
    expect(handle).not.toBeNull();
    const boosts = handle!.groundCandidates([candidate]);
    expect(boosts.get("c1")).toBeGreaterThan(0);
    handle!.detach();
  });

  it("returns no boost when nothing on the page matches the candidate", () => {
    document.body.innerHTML = `<div>Loading…</div>`;
    const handle = createDomGrounding({ resolveMeta: META })!;
    const boosts = handle.groundCandidates([candidate]);
    expect(boosts.has("c1")).toBe(false);
    handle.detach();
  });
});
