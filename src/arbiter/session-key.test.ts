import { describe, expect, it } from "vitest";
import type { SwapEvent } from "@/template-engine/types";
import { partialSessionKey, sessionKey } from "./session-key";

const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const baseSwap = (overrides: Partial<SwapEvent> = {}): SwapEvent => ({
  kind: "swap",
  type: "swap",
  templateId: "test",
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

describe("sessionKey", () => {
  it("produces the same key for two swaps with identical fields", () => {
    expect(sessionKey(baseSwap())).toBe(sessionKey(baseSwap()));
  });

  it("includes the trade pair and amount in the key", () => {
    const a = sessionKey(baseSwap());
    const b = sessionKey(baseSwap({ amountIn: "2000000" }));
    expect(a).not.toBe(b);
  });

  it("lower-cases the domain so casing differences don't shard sessions", () => {
    const lower = sessionKey(baseSwap({ domain: "app.example.xyz" }));
    const upper = sessionKey(baseSwap({ domain: "APP.EXAMPLE.xyz" }));
    expect(lower).toBe(upper);
  });

  it("lower-cases token addresses so checksummed vs lower-case match", () => {
    const checksummed = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    const lower = sessionKey(baseSwap({ tokenIn: checksummed }));
    const upper = sessionKey(
      baseSwap({ tokenIn: checksummed.toLowerCase() }),
    );
    expect(lower).toBe(upper);
  });

  it("normalises amountIn via BigInt: '1000' and '1000.0' collapse", () => {
    expect(sessionKey(baseSwap({ amountIn: "1000" }))).toBe(
      sessionKey(baseSwap({ amountIn: "1000.0" })),
    );
  });

  it("normalises amountIn via BigInt: '1000' and '0x3e8' collapse", () => {
    expect(sessionKey(baseSwap({ amountIn: "1000" }))).toBe(
      sessionKey(baseSwap({ amountIn: "0x3e8" })),
    );
  });

  it("treats different chains as separate sessions", () => {
    const a = sessionKey(baseSwap({ chainIn: 1, chainOut: 1 }));
    const b = sessionKey(baseSwap({ chainIn: 137, chainOut: 137 }));
    expect(a).not.toBe(b);
  });

  it("treats swap and bridge with the same tokens as separate sessions", () => {
    const swap = sessionKey(baseSwap({ chainIn: 1, chainOut: 1 }));
    const bridge = sessionKey(baseSwap({ chainIn: 1, chainOut: 137 }));
    expect(swap).not.toBe(bridge);
  });
});

describe("partialSessionKey", () => {
  it("matches across different amountIn values for the same trade pair", () => {
    const a = partialSessionKey(baseSwap({ amountIn: "1000000" }));
    const b = partialSessionKey(baseSwap({ amountIn: "2000000" }));
    expect(a).toBe(b);
  });

  it("differs when tokens differ", () => {
    const a = partialSessionKey(baseSwap({ tokenIn: USDC }));
    const b = partialSessionKey(baseSwap({ tokenIn: WETH }));
    expect(a).not.toBe(b);
  });

  it("differs when domains differ", () => {
    const a = partialSessionKey(baseSwap({ domain: "a.com" }));
    const b = partialSessionKey(baseSwap({ domain: "b.com" }));
    expect(a).not.toBe(b);
  });

  it("never collides with a sessionKey for the same swap", () => {
    const swap = baseSwap();
    expect(partialSessionKey(swap)).not.toBe(sessionKey(swap));
  });
});
