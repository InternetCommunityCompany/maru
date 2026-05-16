import { beforeEach, describe, expect, it } from "vitest";
import { hydrateChainIndex } from "@/metadata/chain-info/chain-index";
import { getTokenInfo } from "./get-token-info";
import { hydrateTokenIndex } from "./token-index";

const CANONICAL_NATIVE = "0x0000000000000000000000000000000000000000";

beforeEach(() => {
  hydrateTokenIndex({ tokens: [] });
  hydrateChainIndex({ chains: [] });
});

describe("getTokenInfo: ERC-20 path", () => {
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
    expect(info?.decimals).toBe(6);
    expect(info?.symbol).toBe("USDC");
  });

  it("returns null for unknown non-native addresses", () => {
    expect(getTokenInfo(1, "0xdeadbeef00000000000000000000000000000000")).toBeNull();
  });

  it("returns null before any hydration", () => {
    expect(getTokenInfo(1, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")).toBeNull();
  });
});

describe("getTokenInfo: native synthesis", () => {
  const ethChain = {
    chainId: 1,
    name: "Ethereum Mainnet",
    shortName: "eth",
    iconUrl: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  };

  it("synthesises a TokenInfo for the canonical native address from chain.nativeCurrency", () => {
    hydrateChainIndex({ chains: [ethChain] });
    const info = getTokenInfo(1, CANONICAL_NATIVE);
    expect(info).toEqual({
      chainId: 1,
      address: CANONICAL_NATIVE,
      decimals: 18,
      symbol: "ETH",
      name: "Ether",
      logoURI: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    });
  });

  it("accepts the canonical native address case-insensitively", () => {
    hydrateChainIndex({ chains: [ethChain] });
    expect(
      getTokenInfo(1, "0x0000000000000000000000000000000000000000".toUpperCase()),
    ).not.toBeNull();
  });

  it("omits logoURI when the chain has no iconUrl", () => {
    hydrateChainIndex({
      chains: [{ ...ethChain, iconUrl: null }],
    });
    const info = getTokenInfo(1, CANONICAL_NATIVE);
    expect(info?.logoURI).toBeUndefined();
  });

  it("returns null when the chain isn't in the index", () => {
    // Chain 31337 (anvil/hardhat) isn't in chainlist, so no native synthesis.
    expect(getTokenInfo(31337, CANONICAL_NATIVE)).toBeNull();
  });

  it("returns null when the chain is known but nativeCurrency is missing", () => {
    hydrateChainIndex({ chains: [{ ...ethChain, nativeCurrency: null }] });
    expect(getTokenInfo(1, CANONICAL_NATIVE)).toBeNull();
  });

  it("prefers an explicit tokenlist entry over the synthesised native", () => {
    // Defensive: if a tokenlist ever seeds a native entry on purpose, it wins.
    hydrateTokenIndex({
      tokens: [
        {
          chainId: 1,
          address: CANONICAL_NATIVE,
          decimals: 18,
          symbol: "ETH-from-list",
          name: "Ether (from list)",
        },
      ],
    });
    hydrateChainIndex({ chains: [ethChain] });
    expect(getTokenInfo(1, CANONICAL_NATIVE)?.symbol).toBe("ETH-from-list");
  });
});
