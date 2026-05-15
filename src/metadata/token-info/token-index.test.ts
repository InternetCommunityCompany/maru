import { describe, expect, it } from "vitest";
import { hydrateTokenIndex, lookupToken, tokenKey } from "./token-index";
import type { TokenList } from "./types";

const sample: TokenList = {
  tokens: [
    {
      chainId: 1,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
      logoURI: "https://example.test/usdc.png",
    },
    {
      chainId: 42161,
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
      symbol: "USDC",
      name: "USD Coin",
    },
  ],
};

describe("hydrateTokenIndex + lookupToken", () => {
  it("indexes entries by chainId + lower-cased address", () => {
    hydrateTokenIndex(sample);
    // Lookup with checksummed casing.
    expect(lookupToken(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")?.symbol)
      .toBe("USDC");
    // Lookup with all-lower casing must hit the same entry.
    expect(lookupToken(1, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")?.symbol)
      .toBe("USDC");
  });

  it("returns null for unknown (chainId, address) pairs", () => {
    hydrateTokenIndex(sample);
    expect(lookupToken(1, "0x0000000000000000000000000000000000000001")).toBeNull();
    // Same address as USDC mainnet, but on a chain we don't have it on.
    expect(lookupToken(137, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBeNull();
  });

  it("re-hydrating with a smaller list drops removed entries", () => {
    hydrateTokenIndex(sample);
    expect(lookupToken(42161, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831")).not.toBeNull();
    hydrateTokenIndex({ tokens: [sample.tokens[0]!] });
    expect(lookupToken(42161, "0xaf88d065e77c8cC2239327C5EDb3A432268e5831")).toBeNull();
    expect(lookupToken(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).not.toBeNull();
  });

  it("tokenKey lower-cases the address", () => {
    expect(tokenKey(1, "0xABCD")).toBe("1:0xabcd");
  });
});
