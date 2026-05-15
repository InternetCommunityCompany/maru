import { beforeEach, describe, expect, it } from "vitest";
import { getChainInfo } from "./get-chain-info";
import { hydrateChainIndex } from "./chain-index";

beforeEach(() => {
  hydrateChainIndex({ chains: [] });
});

describe("getChainInfo", () => {
  it("returns the entry for a known chainId", () => {
    hydrateChainIndex({
      chains: [
        {
          chainId: 1,
          name: "Ethereum Mainnet",
          shortName: "eth",
          icon: "ethereum",
        },
      ],
    });
    const info = getChainInfo(1);
    expect(info).not.toBeNull();
    expect(info?.name).toBe("Ethereum Mainnet");
    expect(info?.shortName).toBe("eth");
    expect(info?.iconUrl).toContain("rsz_ethereum.jpg");
  });

  it("returns null for unknown chains — alert overlay omits the badge", () => {
    expect(getChainInfo(31337)).toBeNull();
  });

  it("returns null before the index has been hydrated", () => {
    // After the beforeEach reset the index is empty.
    expect(getChainInfo(1)).toBeNull();
  });
});
