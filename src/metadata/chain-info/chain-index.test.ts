import { beforeEach, describe, expect, it } from "vitest";
import { chainIndexSize, hydrateChainIndex, lookupChain } from "./chain-index";
import type { ChainList } from "./types";

const sample: ChainList = {
  chains: [
    {
      chainId: 1,
      name: "Ethereum Mainnet",
      shortName: "eth",
      iconUrl: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    },
    {
      chainId: 42161,
      name: "Arbitrum One",
      shortName: "arb1",
      iconUrl: "https://example.test/arb.png",
    },
    {
      chainId: 999,
      name: "Iconless",
      shortName: "icns",
      iconUrl: null,
    },
  ],
};

beforeEach(() => {
  hydrateChainIndex({ chains: [] });
});

describe("hydrateChainIndex + lookupChain", () => {
  it("indexes entries by chainId and surfaces the backend-resolved icon URL", () => {
    hydrateChainIndex(sample);
    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
    expect(lookupChain(1)?.iconUrl).toBe(
      "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    );
  });

  it("passes a full-URL icon through to iconUrl unchanged", () => {
    hydrateChainIndex(sample);
    expect(lookupChain(42161)?.iconUrl).toBe("https://example.test/arb.png");
  });

  it("yields iconUrl: null for chains the backend marks as icon-less", () => {
    hydrateChainIndex(sample);
    expect(lookupChain(999)?.iconUrl).toBeNull();
  });

  it("returns null for unknown chainIds — the documented unknown path", () => {
    hydrateChainIndex(sample);
    expect(lookupChain(31337)).toBeNull();
  });

  it("re-hydrating with a smaller list drops removed entries", () => {
    hydrateChainIndex(sample);
    expect(lookupChain(42161)).not.toBeNull();
    hydrateChainIndex({ chains: [sample.chains[0]!] });
    expect(lookupChain(42161)).toBeNull();
    expect(lookupChain(1)).not.toBeNull();
    expect(chainIndexSize()).toBe(1);
  });

  it("starts empty so consumers see null before the first hydration", () => {
    // After the beforeEach the index is empty.
    expect(chainIndexSize()).toBe(0);
    expect(lookupChain(1)).toBeNull();
  });
});
