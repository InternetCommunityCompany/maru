import { beforeEach, describe, expect, it } from "vitest";
import { getTokenInfo } from "./get-token-info";
import { hydrateTokenIndex } from "./token-index";

beforeEach(() => {
  hydrateTokenIndex({ tokens: [] });
});

describe("getTokenInfo", () => {
  it("returns the entry for a known (chainId, address)", () => {
    hydrateTokenIndex({
      tokens: [
        {
          chainId: 1,
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          decimals: 6,
          symbol: "USDC",
          name: "USD Coin",
        },
      ],
    });
    const info = getTokenInfo(1, "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48");
    expect(info).not.toBeNull();
    expect(info?.decimals).toBe(6);
    expect(info?.symbol).toBe("USDC");
  });

  it("returns null for unknown tokens — the documented Unknown path", () => {
    expect(getTokenInfo(1, "0xdeadbeef00000000000000000000000000000000")).toBeNull();
  });

  it("returns null before the index has been hydrated", () => {
    // After the beforeEach reset the index is empty.
    expect(getTokenInfo(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBeNull();
  });
});
