import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing";
import { chainList } from "./chain-list-storage";
import { chainIndexSize, lookupChain } from "./chain-index";
import { CHAIN_LIST_TTL_MS, ensureChainList } from "./ensure-chain-list";
import type { ChainList } from "./types";

const eth = {
  chainId: 1,
  name: "Ethereum Mainnet",
  shortName: "eth",
  iconUrl: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
};

const sample: ChainList = { chains: [eth] };

const responseOf = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

beforeEach(async () => {
  // Reset both the persisted blob and the in-memory index between cases.
  fakeBrowser.reset();
  await chainList.removeValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureChainList: cold install", () => {
  it("fetches, persists, and hydrates on the first call", async () => {
    // The fallback `fetchedAt: 0` is epoch — any realistic `Date.now()` sits
    // well past the TTL relative to it, so the cold install always triggers
    // a refresh.
    const now = 1_700_000_000_000;
    const fetchImpl = vi.fn(async () => responseOf(sample));
    await ensureChainList({ fetchImpl, now: () => now });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const stored = await chainList.getValue();
    expect(stored.fetchedAt).toBe(now);
    expect(stored.data.chains).toHaveLength(1);
    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
    expect(lookupChain(1)?.iconUrl).toBe(
      "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    );
  });
});

describe("ensureChainList: TTL behaviour", () => {
  it("skips the network when the stored copy is fresh", async () => {
    await chainList.setValue({ data: sample, fetchedAt: 100 });
    const fetchImpl = vi.fn(async () => responseOf({ chains: [] }));

    await ensureChainList({ fetchImpl, now: () => 100 + CHAIN_LIST_TTL_MS });

    expect(fetchImpl).not.toHaveBeenCalled();
    // The persisted copy must still hydrate the index — that's the
    // service-worker-restart path.
    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
  });

  it("refreshes when the stored copy is past the TTL", async () => {
    await chainList.setValue({ data: { chains: [] }, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => responseOf(sample));

    await ensureChainList({
      fetchImpl,
      now: () => CHAIN_LIST_TTL_MS + 1,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
    const stored = await chainList.getValue();
    expect(stored.fetchedAt).toBe(CHAIN_LIST_TTL_MS + 1);
  });
});

describe("ensureChainList: failure modes are non-fatal", () => {
  it("falls back to the existing stored copy on an HTTP error", async () => {
    await chainList.setValue({ data: sample, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => responseOf({ error: "down" }, 503));

    await ensureChainList({ fetchImpl, now: () => CHAIN_LIST_TTL_MS + 1 });

    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
    // Persisted timestamp must NOT advance — next call should re-attempt.
    const stored = await chainList.getValue();
    expect(stored.fetchedAt).toBe(0);
  });

  it("falls back on a network error", async () => {
    await chainList.setValue({ data: sample, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    });

    await ensureChainList({ fetchImpl, now: () => CHAIN_LIST_TTL_MS + 1 });

    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
  });

  it("falls back on a malformed response body", async () => {
    await chainList.setValue({ data: sample, fetchedAt: 0 });
    const fetchImpl = vi.fn(async () => responseOf({ not: "a list" }));

    await ensureChainList({ fetchImpl, now: () => CHAIN_LIST_TTL_MS + 1 });

    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
  });

  it("yields an empty index after a failed cold install", async () => {
    // No prior persisted value — the fallback empty list is what hydrates.
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("offline");
    });

    await ensureChainList({ fetchImpl, now: () => 1_000 });

    expect(chainIndexSize()).toBe(0);
    expect(lookupChain(1)).toBeNull();
  });
});

describe("ensureChainList: SW-restart path", () => {
  it("hydrates the in-memory index from storage even when the cache is fresh", async () => {
    // Simulate a previous SW that fetched the list; this run is the post-
    // restart boot — fetch must not be called, but the index must be warm.
    await chainList.setValue({ data: sample, fetchedAt: 100 });
    const fetchImpl = vi.fn();

    await ensureChainList({ fetchImpl, now: () => 200 });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(lookupChain(1)?.name).toBe("Ethereum Mainnet");
  });
});
